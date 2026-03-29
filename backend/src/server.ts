import "dotenv/config";
import cors from "cors";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { config } from "./config.js";
import { getDb, withMongoRetry } from "./db.js";
import type { DashboardResponse, EscalationEvent, EscalationStage, MessageRole, TaskStatus } from "./types.js";

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(cors({ origin: config.frontendOrigin }));

const MAX_CHAT_MESSAGE_LENGTH = 1200;
const MAX_VOICE_TEXT_LENGTH = 400;
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
type GarminActivityInput = {
  activityId?: string;
  name?: string;
  type?: string;
  startTime?: string;
  durationMinutes?: number;
  distanceKm?: number;
  averageHeartRate?: number;
  steps?: number;
  calories?: number;
};
type ErrorCode =
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DB_ERROR"
  | "VOICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

function sendError(res: Response, status: number, code: ErrorCode, error: string, detail?: string) {
  return res.status(status).json({ error, code, detail });
}

function getClientKey(req: Request) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function rateLimit(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.path}:${getClientKey(req)}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      rateLimitStore.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - entry.windowStart)) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      return sendError(res, 429, "RATE_LIMITED", "Rate limit exceeded. Try again soon.");
    }

    entry.count += 1;
    rateLimitStore.set(key, entry);
    return next();
  };
}

function toIso(date: Date) {
  return date.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function boundedStage(stage: number): EscalationStage {
  if (stage <= 1) return 1;
  if (stage >= 5) return 5;
  return stage as EscalationStage;
}

function fakeEscalationLog(stage: EscalationStage): EscalationEvent[] {
  const base = Date.now();
  const events: EscalationEvent[] = [
    { type: "reminder_sent", label: "Reminder sent", at: new Date(base - 2 * 60 * 60 * 1000).toISOString() },
    { type: "sms_sent", label: "SMS sent", at: new Date(base - 60 * 60 * 1000).toISOString() },
    { type: "call_placed", label: "Call placed", at: new Date(base - 20 * 60 * 1000).toISOString() }
  ];

  if (stage === 1) return events.slice(0, 1);
  if (stage === 2) return events.slice(0, 2);
  return events;
}

function normalizeActivityType(value: string | undefined) {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("run") || raw.includes("jog") || raw.includes("treadmill")) return "run";
  if (raw.includes("walk") || raw.includes("hike")) return "walk";
  if (raw.includes("ride") || raw.includes("bike") || raw.includes("cycling")) return "ride";
  if (raw.includes("strength") || raw.includes("lift") || raw.includes("gym")) return "strength";
  if (raw.includes("mobility") || raw.includes("stretch") || raw.includes("yoga")) return "mobility";
  return "unknown";
}

function inferTaskType(taskTitle: string) {
  return normalizeActivityType(taskTitle);
}

function parseDurationMinutes(taskTitle: string) {
  const exact = taskTitle.match(/(\d+)\s*min/i);
  if (exact) return Number(exact[1]);
  const hourMatch = taskTitle.match(/(\d+)\s*hour/i);
  if (hourMatch) return Number(hourMatch[1]) * 60;
  return null;
}

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function sanitizeGarminActivity(input: GarminActivityInput, index: number) {
  const startTime = String(input.startTime ?? "").trim();
  const parsedStart = startTime ? new Date(startTime) : null;

  return {
    activityId: String(input.activityId ?? `garmin-${index}`).trim() || `garmin-${index}`,
    name: String(input.name ?? "Garmin activity").trim() || "Garmin activity",
    type: String(input.type ?? "unknown").trim() || "unknown",
    normalizedType: normalizeActivityType(input.type),
    startTime: parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart.toISOString() : "",
    durationMinutes: toNumber(input.durationMinutes) ?? 0,
    distanceKm: toNumber(input.distanceKm),
    averageHeartRate: toNumber(input.averageHeartRate),
    steps: toNumber(input.steps),
    calories: toNumber(input.calories)
  };
}

function evaluateGarminMatch(
  task: { title?: string; dueAt?: string; status?: TaskStatus } | undefined,
  activities: ReturnType<typeof sanitizeGarminActivity>[]
) {
  const taskTitle = String(task?.title ?? "").trim() || "Planned workout";
  const dueAt = String(task?.dueAt ?? "").trim();
  const expectedType = inferTaskType(taskTitle);
  const expectedDurationMinutes = parseDurationMinutes(taskTitle);
  const dueAtMs = dueAt ? new Date(dueAt).getTime() : NaN;

  const candidates = activities
    .filter((activity) => activity.startTime)
    .map((activity) => {
      const activityStart = new Date(activity.startTime).getTime();
      const timeDeltaHours = Number.isFinite(dueAtMs) ? Math.abs(activityStart - dueAtMs) / (60 * 60 * 1000) : 999;
      const typeMatches = expectedType === "unknown" || activity.normalizedType === expectedType;
      const durationMatches =
        expectedDurationMinutes == null ||
        activity.durationMinutes >= Math.max(10, Math.floor(expectedDurationMinutes * 0.7));
      const withinWindow = timeDeltaHours <= 24;
      const score =
        (typeMatches ? 3 : 0) +
        (durationMatches ? 2 : 0) +
        (withinWindow ? 2 : 0) +
        Math.min(2, Math.floor(activity.durationMinutes / 20));

      return { activity, score, typeMatches, durationMatches, withinWindow };
    })
    .sort((left, right) => right.score - left.score);

  const bestCandidate = candidates[0];
  const matched = Boolean(
    bestCandidate && bestCandidate.typeMatches && bestCandidate.durationMatches && bestCandidate.withinWindow
  );

  return {
    matched,
    taskTitle,
    dueAt,
    expectedType,
    expectedDurationMinutes,
    activityCount: activities.length,
    bestCandidate: matched ? bestCandidate.activity : null
  };
}

function formatGarminActivitySummary(activity: ReturnType<typeof sanitizeGarminActivity>) {
  const metrics = [
    activity.durationMinutes ? `${Math.round(activity.durationMinutes)} min` : null,
    activity.distanceKm ? `${activity.distanceKm.toFixed(1)} km` : null,
    activity.averageHeartRate ? `${Math.round(activity.averageHeartRate)} bpm avg HR` : null,
    activity.steps ? `${Math.round(activity.steps)} steps` : null
  ].filter(Boolean);

  return `${activity.name} (${metrics.join(", ") || "activity logged"})`;
}

function localCoachReply(message: string, stage: EscalationStage, debtCount: number) {
  const trimmed = message.trim();
  return `You said you wanted this. Stage ${stage}, debt ${debtCount}. No drama, just action: complete the recovery run today and confirm when done. ${trimmed ? `You said: "${trimmed}".` : ""}`.trim();
}

function localGarminFeedback(args: {
  matched: boolean;
  stage: EscalationStage;
  debtCount: number;
  taskTitle: string;
  bestCandidateSummary?: string;
  activityCount: number;
}) {
  if (args.matched) {
    return `Garmin verified the work: ${args.bestCandidateSummary ?? args.taskTitle}. Good. That counts. Debt is now ${args.debtCount}. Stay on the plan and be ready for the next session.`;
  }

  const stageLines: Record<EscalationStage, string> = {
    1: "You are already flirting with drift.",
    2: "This is the second time the receipts do not match the promise.",
    3: "Now we're into excuses territory.",
    4: "You're stacking avoidance on top of avoidance.",
    5: "This is full shutdown behavior unless you interrupt it right now."
  };

  return `${stageLines[args.stage]} Garmin found ${args.activityCount} activities, but none matched "${args.taskTitle}". That's a strike. Debt is ${args.debtCount}. Complete the recovery workout today or expect the next escalation.`;
}

function demoRecoveryAction() {
  return {
    title: "20-min punishment run + commitment to tomorrow",
    description: "Complete this today to clear debt and reset momentum."
  };
}

async function maybeOpenAIReply(userMessage: string, context: { stage: EscalationStage; debtCount: number }) {
  if (!config.openAiApiKey) {
    return localCoachReply(userMessage, context.stage, context.debtCount);
  }

  const system = [
    "You are a strict but constructive fitness accountability coach for a hackathon demo.",
    "Persona: direct, concise, no insults, high urgency, action-oriented.",
    "Always return 1-3 short paragraphs and one clear next action."
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: system }]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Escalation stage: ${context.stage}. Debt count: ${context.debtCount}. User message: ${userMessage}`
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    return localCoachReply(userMessage, context.stage, context.debtCount);
  }

  const data = (await response.json()) as { output_text?: string };
  return data.output_text?.trim() || localCoachReply(userMessage, context.stage, context.debtCount);
}

async function maybeOpenAIGarminFeedback(context: {
  matched: boolean;
  stage: EscalationStage;
  debtCount: number;
  taskTitle: string;
  activityCount: number;
  bestCandidateSummary?: string;
}) {
  if (!config.openAiApiKey) {
    return localGarminFeedback(context);
  }

  const system = [
    "You are a strict but constructive fitness accountability coach for a hackathon demo.",
    "You are reacting to a Garmin workout sync.",
    "If work was completed, be brief and approving.",
    "If no Garmin activity matches the plan, escalate urgency based on stage and call it a strike.",
    "Do not insult the user. Be direct. End with one clear next action."
  ].join(" ");

  const userText = context.matched
    ? `Garmin matched the planned task "${context.taskTitle}". Best matched activity: ${context.bestCandidateSummary ?? "completed activity"}. Stage ${context.stage}. Debt count after match: ${context.debtCount}.`
    : `Garmin found ${context.activityCount} activities but none matched the planned task "${context.taskTitle}". This should count as a strike. Stage ${context.stage}. Debt count after strike: ${context.debtCount}.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: system }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userText }]
        }
      ]
    })
  });

  if (!response.ok) {
    return localGarminFeedback(context);
  }

  const data = (await response.json()) as { output_text?: string };
  return data.output_text?.trim() || localGarminFeedback(context);
}

async function generateVoiceBase64(text: string) {
  if (!config.elevenLabsApiKey || !config.elevenLabsVoiceId) {
    throw new Error("ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required for voice preview");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.elevenLabsVoiceId)}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": config.elevenLabsApiKey
      },
      body: JSON.stringify({
        text,
        model_id: config.elevenLabsModelId
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs request failed: ${detail}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return audioBuffer.toString("base64");
}

async function applyTaskStatusTransition(args: {
  userId: ObjectId;
  status: TaskStatus;
  eventKey?: string;
  coachMessage?: string;
}) {
  const db = await withMongoRetry(async () => getDb());
  const { userId, status, eventKey, coachMessage } = args;
  const [plan, escalation] = await withMongoRetry(async () =>
    Promise.all([
      db.collection("plans").findOne({ userId }),
      db.collection("escalations").findOne({ userId })
    ])
  );

  if (!plan || !escalation) {
    return { error: sendError, notFound: true as const };
  }

  const currentDebt = Number(plan.debtCount ?? 0);
  const currentStage = boundedStage(Number(escalation.stage ?? 1));
  const nextDebt = status === "missed" ? currentDebt + 1 : Math.max(0, currentDebt - 1);
  const nextStage = status === "missed" ? boundedStage(currentStage + 1) : boundedStage(currentStage - 1);
  const recoveryAction =
    status === "missed"
      ? {
          title: "20-min punishment run + commitment to tomorrow",
          description: "Do this instead today to clear debt and stay on track."
        }
      : null;
  const safeEventKey = String(eventKey ?? "").trim();

  if (status === "missed") {
    const update: Record<string, unknown> = {
      $set: {
        stage: nextStage,
        lastActionAt: new Date(),
        recoveryAction,
        events: fakeEscalationLog(nextStage),
        updatedAt: new Date()
      }
    };

    if (safeEventKey) {
      update.$addToSet = { processedMissedEvents: safeEventKey };
    }

    if (coachMessage) {
      update.$push = {
        recentMessages: {
          $each: [{ role: "coach", content: coachMessage, sentAt: nowIso() }],
          $slice: -20
        }
      };
    }

    const escalationResult = await db.collection("escalations").updateOne(
      safeEventKey ? { userId, processedMissedEvents: { $ne: safeEventKey } } : { userId },
      update as any
    );

    if (safeEventKey && escalationResult.modifiedCount === 0) {
      const [latestPlan, latestEscalation] = await withMongoRetry(async () =>
        Promise.all([
          db.collection("plans").findOne({ userId }),
          db.collection("escalations").findOne({ userId })
        ])
      );

      return {
        ok: true,
        status,
        debtCount: Number(latestPlan?.debtCount ?? currentDebt),
        stage: boundedStage(Number(latestEscalation?.stage ?? currentStage)),
        recoveryAction: (latestEscalation?.recoveryAction ?? recoveryAction) as typeof recoveryAction,
        idempotentReplay: true,
        eventKey: safeEventKey
      };
    }

    await db.collection("plans").updateOne(
      { userId },
      {
        $set: {
          "todayTask.status": status,
          debtCount: nextDebt,
          updatedAt: new Date()
        }
      }
    );

    return {
      ok: true,
      status,
      debtCount: nextDebt,
      stage: nextStage,
      recoveryAction,
      idempotentReplay: false,
      eventKey: safeEventKey
    };
  }

  await db.collection("plans").updateOne(
    { userId },
    {
      $set: {
        "todayTask.status": status,
        debtCount: nextDebt,
        updatedAt: new Date()
      }
    }
  );

  const escalationUpdate: Record<string, unknown> = {
    $set: {
      stage: nextStage,
      lastActionAt: new Date(),
      recoveryAction,
      events: fakeEscalationLog(nextStage),
      updatedAt: new Date()
    }
  };

  if (coachMessage) {
    escalationUpdate.$push = {
      recentMessages: {
        $each: [{ role: "coach", content: coachMessage, sentAt: nowIso() }],
        $slice: -20
      }
    };
  }

  await db.collection("escalations").updateOne({ userId }, escalationUpdate as any);

  return { ok: true, status, debtCount: nextDebt, stage: nextStage, recoveryAction, idempotentReplay: false, eventKey: safeEventKey };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend", at: nowIso() });
});

app.post("/api/onboarding", async (req, res) => {
  try {
    const {
      name,
      goalTitle,
      targetDate,
      scheduleConstraints,
      escalationTolerance,
      phoneNumber,
      googleCalendarEmail,
      goalType,
      baseline,
      weeklyAvailability,
      wakeWindow,
      injuryLimit,
      trigger,
      channels
    } = req.body as {
      name?: string;
      goalTitle?: string;
      targetDate?: string;
      scheduleConstraints?: string;
      escalationTolerance?: string;
      phoneNumber?: string;
      googleCalendarEmail?: string;
      goalType?: string;
      baseline?: string;
      weeklyAvailability?: string;
      wakeWindow?: string;
      injuryLimit?: string;
      trigger?: string;
      channels?: string[];
    };

    if (!name || !goalTitle || !targetDate) {
      return sendError(res, 400, "VALIDATION_ERROR", "name, goalTitle, and targetDate are required");
    }

    const db = await withMongoRetry(async () => getDb());
    const users = db.collection("users");
    const goals = db.collection("goals");
    const plans = db.collection("plans");
    const escalations = db.collection("escalations");

    const now = new Date();
    const userInsert = await users.insertOne({
      name,
      phoneNumber: phoneNumber ?? "",
      googleCalendarEmail: googleCalendarEmail ?? "",
      timezone: "America/New_York",
      createdAt: now,
      updatedAt: now
    });

    await goals.insertOne({
      userId: userInsert.insertedId,
      title: goalTitle,
      goalType: goalType ?? goalTitle,
      targetDate,
      scheduleConstraints: scheduleConstraints ?? "",
      escalationTolerance: escalationTolerance ?? "medium",
      baseline: baseline ?? "",
      weeklyAvailability: weeklyAvailability ?? "",
      wakeWindow: wakeWindow ?? "",
      injuryLimit: injuryLimit ?? "",
      trigger: trigger ?? "",
      channels: Array.isArray(channels) ? channels : [],
      createdAt: now
    });

    await plans.insertOne({
      userId: userInsert.insertedId,
      title: `${goalTitle} plan`,
      goalType: goalType ?? goalTitle,
      targetDate,
      phoneNumber: phoneNumber ?? "",
      googleCalendarEmail: googleCalendarEmail ?? "",
      todayTask: {
        title: "30-min run",
        dueAt: toIso(new Date(now.getTime() + 6 * 60 * 60 * 1000)),
        status: "pending" as TaskStatus
      },
      baseline: baseline ?? "",
      weeklyAvailability: weeklyAvailability ?? "",
      wakeWindow: wakeWindow ?? "",
      injuryLimit: injuryLimit ?? "",
      trigger: trigger ?? "",
      channels: Array.isArray(channels) ? channels : [],
      debtCount: 0,
      status: "Active",
      summary: `${name} committed to ${goalTitle} by ${targetDate}.`,
      nextMission: "30-min run",
      updatedAt: now
    });

    await escalations.insertOne({
      userId: userInsert.insertedId,
      stage: 1,
      lastActionAt: now,
      recentMessages: [],
      recoveryAction: null,
      processedMissedEvents: [],
      events: fakeEscalationLog(1),
      updatedAt: now
    });

    return res.status(201).json({ userId: userInsert.insertedId.toString() });
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to onboard user", String(error));
  }
});

app.get("/api/plan-library", async (_req, res) => {
  try {
    const db = await withMongoRetry(async () => getDb());
    const [users, goals, workouts, checkIns] = await withMongoRetry(async () =>
      Promise.all([
        db.collection("users").find({}).toArray(),
        db.collection("goals").find({}).sort({ createdAt: -1 }).toArray(),
        db.collection("plans").find({}).toArray(),
        db.collection("check_ins").find({}).toArray()
      ])
    );

    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const workoutsByUserId = new Map(workouts.map((workout) => [String(workout.userId), workout]));
    const checkInsByUserId = new Map<string, number>();

    for (const checkIn of checkIns) {
      const key = String(checkIn.userId);
      checkInsByUserId.set(key, (checkInsByUserId.get(key) ?? 0) + 1);
    }

    const mapped = goals.map((goal) => {
      const userId = String(goal.userId);
      const user = usersById.get(userId);
      const workout = workoutsByUserId.get(userId);
      const completedEvidence = checkInsByUserId.get(userId) ?? 0;

      return {
        id: `goal_${userId}`,
        userId,
        title: `${String(goal.title ?? "Training goal")} plan`,
        goalType: String(goal.goalType ?? goal.title ?? "Custom Mission"),
        targetDate: String(goal.targetDate ?? ""),
        phoneNumber: String(user?.phoneNumber ?? workout?.phoneNumber ?? ""),
        googleCalendarEmail: String(user?.googleCalendarEmail ?? workout?.googleCalendarEmail ?? ""),
        createdAt: goal.createdAt?.toISOString?.() ?? new Date().toISOString(),
        status:
          workout?.todayTask?.status === "done"
            ? "Completed"
            : workout?.todayTask?.status === "missed"
              ? "Adjustment Needed"
              : "Active",
        nextMission: String(workout?.todayTask?.title ?? workout?.nextMission ?? "Workout to be scheduled"),
        summary:
          String(workout?.summary ?? `${user?.name ?? "Trainee"} is working toward ${goal.title ?? "their goal"}.`),
        baseline: String(goal.baseline ?? workout?.baseline ?? ""),
        weeklyAvailability: String(goal.weeklyAvailability ?? workout?.weeklyAvailability ?? ""),
        wakeWindow: String(goal.wakeWindow ?? workout?.wakeWindow ?? ""),
        injuryLimit: String(goal.injuryLimit ?? workout?.injuryLimit ?? ""),
        trigger: String(goal.trigger ?? workout?.trigger ?? ""),
        escalationTolerance: String(goal.escalationTolerance ?? "Measured"),
        channels: Array.isArray(goal.channels)
          ? goal.channels
          : Array.isArray(workout?.channels)
            ? workout.channels
            : [],
        adherenceSummary:
          completedEvidence > 0
            ? `${completedEvidence} verified workout${completedEvidence === 1 ? "" : "s"}`
            : "No verified workouts yet",
      };
    });

    const goalUserIds = new Set(mapped.map((item) => item.userId));
    const orphanWorkouts = workouts
      .filter((workout) => !goalUserIds.has(String(workout.userId)))
      .map((workout) => {
        const userId = String(workout.userId);
        const user = usersById.get(userId);

        return {
          id: `goal_${userId}`,
          userId,
          title: `${String(workout.goalType ?? workout.title ?? "Training goal")} plan`,
          goalType: String(workout.goalType ?? "Custom Mission"),
          targetDate: String(workout.targetDate ?? ""),
          phoneNumber: String(user?.phoneNumber ?? workout.phoneNumber ?? ""),
          googleCalendarEmail: String(user?.googleCalendarEmail ?? workout.googleCalendarEmail ?? ""),
          createdAt: workout.updatedAt?.toISOString?.() ?? new Date().toISOString(),
          status:
            workout.todayTask?.status === "done"
              ? "Completed"
              : workout.todayTask?.status === "missed"
                ? "Adjustment Needed"
                : "Active",
          nextMission: String(workout.todayTask?.title ?? workout.nextMission ?? "Workout to be scheduled"),
          summary: String(workout.summary ?? `${user?.name ?? "Trainee"} is progressing through the demo workout flow.`),
          baseline: String(workout.baseline ?? ""),
          weeklyAvailability: String(workout.weeklyAvailability ?? ""),
          wakeWindow: String(workout.wakeWindow ?? ""),
          injuryLimit: String(workout.injuryLimit ?? ""),
          trigger: String(workout.trigger ?? ""),
          escalationTolerance: String(workout.escalationTolerance ?? "Measured"),
          channels: Array.isArray(workout.channels) ? workout.channels : [],
          adherenceSummary: "Demo workout state",
        };
      });

    const plans = [...mapped, ...orphanWorkouts].sort((left, right) =>
      String(right.createdAt).localeCompare(String(left.createdAt))
    );

    return res.json({ ok: true, plans });
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to load plan library", String(error));
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    if (!ObjectId.isValid(userId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Valid userId query param is required");
    }

    const oid = new ObjectId(userId);
    const [user, plan, escalation, garminIntegration] = await withMongoRetry(async () => {
      const db = await getDb();
      return Promise.all([
        db.collection("users").findOne({ _id: oid }),
        db.collection("plans").findOne({ userId: oid }),
        db.collection("escalations").findOne({ userId: oid }),
        db.collection("integrations").findOne({ userId: oid, provider: "garmin" })
      ]);
    });

    if (!user || !plan || !escalation) {
      return sendError(res, 404, "NOT_FOUND", "Dashboard data not found for user");
    }

    const response: DashboardResponse & { escalationEvents: EscalationEvent[] } = {
      user: { name: user.name ?? "Demo User" },
      todayTask: {
        title: plan.todayTask?.title ?? "20-min recovery run",
        dueAt: plan.todayTask?.dueAt ?? nowIso(),
        status: (plan.todayTask?.status ?? "pending") as TaskStatus
      },
      debtCount: Number(plan.debtCount ?? 0),
      escalation: {
        stage: boundedStage(Number(escalation.stage ?? 1)),
        lastActionAt: escalation.lastActionAt?.toISOString?.() ?? nowIso()
      },
      recentMessages: (escalation.recentMessages ?? []) as {
        role: MessageRole;
        content: string;
        sentAt: string;
      }[],
      recoveryAction: (escalation.recoveryAction ?? null) as DashboardResponse["recoveryAction"],
      escalationEvents: (escalation.events ?? fakeEscalationLog(boundedStage(Number(escalation.stage ?? 1)))) as EscalationEvent[],
      integrations: {
        garmin: {
          connected: Boolean(garminIntegration),
          lastSyncAt: garminIntegration?.lastSyncAt?.toISOString?.() ?? null,
          status: (garminIntegration?.status ?? "idle") as "idle" | "matched" | "strike",
          strikeCount: Number(garminIntegration?.strikeCount ?? 0),
          lastEvaluation: garminIntegration?.lastEvaluation
            ? {
                matched: Boolean(garminIntegration.lastEvaluation.matched),
                summary: String(garminIntegration.lastEvaluation.summary ?? ""),
                matchedActivityType: garminIntegration.lastEvaluation.matchedActivityType ?? null,
                matchedAt: garminIntegration.lastEvaluation.matchedAt ?? null
              }
            : null
        }
      }
    };

    return res.json(response);
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to load dashboard", String(error));
  }
});

app.post("/api/chat", rateLimit(30, 60_000), async (req, res) => {
  try {
    const { userId, message, includeVoice } = req.body as {
      userId?: string;
      message?: string;
      includeVoice?: boolean;
    };
    const trimmedMessage = String(message ?? "").trim();
    if (!userId || !ObjectId.isValid(userId) || !trimmedMessage) {
      return sendError(res, 400, "VALIDATION_ERROR", "userId and message are required");
    }
    if (trimmedMessage.length > MAX_CHAT_MESSAGE_LENGTH) {
      return sendError(res, 400, "VALIDATION_ERROR", `message must be <= ${MAX_CHAT_MESSAGE_LENGTH} characters`);
    }

    const db = await withMongoRetry(async () => getDb());
    const oid = new ObjectId(userId);
    const [plan, escalation] = await withMongoRetry(async () =>
      Promise.all([
        db.collection("plans").findOne({ userId: oid }),
        db.collection("escalations").findOne({ userId: oid })
      ])
    );

    const stage = boundedStage(Number(escalation?.stage ?? 1));
    const debtCount = Number(plan?.debtCount ?? 0);
    const coachReply = await maybeOpenAIReply(trimmedMessage, { stage, debtCount });
    const sentAt = nowIso();

    await db.collection("escalations").updateOne(
      { userId: oid },
      {
        $set: { updatedAt: new Date() },
        $push: {
          recentMessages: {
            $each: [
              { role: "user", content: trimmedMessage, sentAt },
              { role: "coach", content: coachReply, sentAt: nowIso() }
            ],
            $slice: -20
          }
        }
      } as any
    );

    if (includeVoice) {
      if (coachReply.length > MAX_VOICE_TEXT_LENGTH) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          `coach reply is too long for voice preview (max ${MAX_VOICE_TEXT_LENGTH} chars)`
        );
      }

      try {
        const audioBase64 = await generateVoiceBase64(coachReply);
        return res.json({ role: "coach", content: coachReply, sentAt, voice: { mimeType: "audio/mpeg", audioBase64 } });
      } catch (voiceError) {
        return res.json({
          role: "coach",
          content: coachReply,
          sentAt,
          voice: null,
          voiceError: {
            error: "Failed to generate chat voice preview",
            code: "VOICE_UNAVAILABLE",
            detail: String(voiceError)
          }
        });
      }
    }

    return res.json({ role: "coach", content: coachReply, sentAt });
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to process chat", String(error));
  }
});

app.post("/api/checkin", async (req, res) => {
  try {
    const { userId, status, eventId } = req.body as { userId?: string; status?: TaskStatus; eventId?: string };
    if (!userId || !ObjectId.isValid(userId) || !status || !["pending", "missed", "done"].includes(status)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Valid userId and status are required");
    }
    const oid = new ObjectId(userId);
    const explicitKey = String(req.header("x-idempotency-key") ?? eventId ?? "").trim();
    const db = await withMongoRetry(async () => getDb());
    const plan = status === "missed" ? await db.collection("plans").findOne({ userId: oid }) : null;
    const result = await applyTaskStatusTransition({
      userId: oid,
      status,
      eventKey:
        status === "missed" ? explicitKey || `task:${String(plan?.todayTask?.dueAt ?? "unknown")}:missed` : undefined
    });

    if ("notFound" in result) {
      return sendError(res, 404, "NOT_FOUND", "Dashboard data not found for user");
    }

    return res.json(result);
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to check in", String(error));
  }
});

app.post("/api/integrations/garmin/sync", async (req, res) => {
  try {
    const { userId, activities } = req.body as { userId?: string; activities?: GarminActivityInput[] };
    if (!userId || !ObjectId.isValid(userId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Valid userId is required");
    }
    if (!Array.isArray(activities)) {
      return sendError(res, 400, "VALIDATION_ERROR", "activities array is required");
    }

    const oid = new ObjectId(userId);
    const db = await withMongoRetry(async () => getDb());
    const [plan, escalation] = await withMongoRetry(async () =>
      Promise.all([
        db.collection("plans").findOne({ userId: oid }),
        db.collection("escalations").findOne({ userId: oid })
      ])
    );

    if (!plan || !escalation) {
      return sendError(res, 404, "NOT_FOUND", "Plan or escalation data not found for user");
    }

    const sanitizedActivities = activities.map((activity, index) => sanitizeGarminActivity(activity, index));
    const evaluation = evaluateGarminMatch(plan.todayTask, sanitizedActivities);
    const currentStage = boundedStage(Number(escalation.stage ?? 1));
    const currentDebt = Number(plan.debtCount ?? 0);
    const projectedStage = evaluation.matched ? boundedStage(currentStage - 1) : boundedStage(currentStage + 1);
    const projectedDebt = evaluation.matched ? Math.max(0, currentDebt - 1) : currentDebt + 1;
    const bestCandidateSummary = evaluation.bestCandidate ? formatGarminActivitySummary(evaluation.bestCandidate) : undefined;
    const feedback = await maybeOpenAIGarminFeedback({
      matched: evaluation.matched,
      stage: projectedStage,
      debtCount: projectedDebt,
      taskTitle: evaluation.taskTitle,
      activityCount: evaluation.activityCount,
      bestCandidateSummary
    });

    const transition = await applyTaskStatusTransition({
      userId: oid,
      status: evaluation.matched ? "done" : "missed",
      eventKey: evaluation.matched ? undefined : `garmin:${evaluation.dueAt || "unknown"}:no-match`,
      coachMessage: feedback
    });

    if ("notFound" in transition) {
      return sendError(res, 404, "NOT_FOUND", "Plan or escalation data not found for user");
    }

    const responseFeedback =
      !evaluation.matched && transition.idempotentReplay
        ? `Garmin already recorded a strike for "${evaluation.taskTitle}". No additional strike was applied. Debt stays ${transition.debtCount}. Complete the recovery workout to reset momentum.`
        : feedback;

    const integrationUpdate =
      evaluation.matched || !transition.idempotentReplay
        ? {
            $set: {
              userId: oid,
              provider: "garmin",
              status: evaluation.matched ? "matched" : "strike",
              lastSyncAt: new Date(),
              lastEvaluation: {
                matched: evaluation.matched,
                summary: evaluation.matched
                  ? `Matched ${evaluation.taskTitle} against ${bestCandidateSummary ?? "Garmin activity"}`
                  : `No Garmin activity matched ${evaluation.taskTitle}; strike applied`,
                matchedActivityType: evaluation.bestCandidate?.normalizedType ?? null,
                matchedAt: evaluation.bestCandidate?.startTime ?? null
              },
              updatedAt: new Date()
            },
            $inc: {
              syncCount: 1,
              ...(evaluation.matched ? {} : { strikeCount: 1 })
            }
          }
        : {
            $set: {
              userId: oid,
              provider: "garmin",
              lastSyncAt: new Date(),
              updatedAt: new Date()
            },
            $inc: { syncCount: 1 }
          };

    await db.collection("integrations").updateOne({ userId: oid, provider: "garmin" }, integrationUpdate as any, {
      upsert: true
    });

    await db.collection("check_ins").insertOne({
      userId: oid,
      source: "garmin",
      provider: "garmin",
      matched: evaluation.matched,
      plannedTask: {
        title: evaluation.taskTitle,
        dueAt: evaluation.dueAt || null,
        expectedType: evaluation.expectedType,
        expectedDurationMinutes: evaluation.expectedDurationMinutes
      },
      matchedActivity: evaluation.bestCandidate
        ? {
            activityId: evaluation.bestCandidate.activityId,
            name: evaluation.bestCandidate.name,
            type: evaluation.bestCandidate.normalizedType,
            startTime: evaluation.bestCandidate.startTime,
            durationMinutes: evaluation.bestCandidate.durationMinutes,
            distanceKm: evaluation.bestCandidate.distanceKm,
            averageHeartRate: evaluation.bestCandidate.averageHeartRate,
            steps: evaluation.bestCandidate.steps
          }
        : null,
      activityCount: evaluation.activityCount,
      strikeApplied: !evaluation.matched && !transition.idempotentReplay,
      feedback: responseFeedback,
      createdAt: new Date()
    });

    return res.json({
      ok: true,
      matched: evaluation.matched,
      taskTitle: evaluation.taskTitle,
      expectedType: evaluation.expectedType,
      expectedDurationMinutes: evaluation.expectedDurationMinutes,
      activityCount: evaluation.activityCount,
      matchedActivity: evaluation.bestCandidate
        ? {
            name: evaluation.bestCandidate.name,
            type: evaluation.bestCandidate.normalizedType,
            startTime: evaluation.bestCandidate.startTime,
            durationMinutes: evaluation.bestCandidate.durationMinutes,
            distanceKm: evaluation.bestCandidate.distanceKm,
            averageHeartRate: evaluation.bestCandidate.averageHeartRate,
            steps: evaluation.bestCandidate.steps
          }
        : null,
      strikeApplied: !evaluation.matched && !transition.idempotentReplay,
      feedback: responseFeedback,
      status: transition.status,
      debtCount: transition.debtCount,
      stage: transition.stage,
      recoveryAction: transition.recoveryAction,
      idempotentReplay: transition.idempotentReplay
    });
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to sync Garmin activities", String(error));
  }
});

app.post("/api/recovery", async (req, res) => {
  try {
    const { userId, action } = req.body as { userId?: string; action?: "accept" | "snooze" };
    if (!userId || !ObjectId.isValid(userId) || !action || !["accept", "snooze"].includes(action)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Valid userId and action are required");
    }

    const db = await withMongoRetry(async () => getDb());
    const oid = new ObjectId(userId);
    const now = new Date();

    const plan = await withMongoRetry(async () => db.collection("plans").findOne({ userId: oid }));
    const debtCount = Number(plan?.debtCount ?? 0);

    const nextDebt = action === "accept" ? Math.max(0, debtCount - 1) : debtCount;

    await db.collection("plans").updateOne(
      { userId: oid },
      {
        $set: {
          debtCount: nextDebt,
          "todayTask.status": action === "accept" ? "pending" : "missed",
          updatedAt: now
        }
      }
    );

    const coachMessage =
      action === "accept"
        ? "Good. Debt cleared. Next step: complete tomorrow's run at the planned time."
        : "Snooze logged. Timer is still running. Check in again before tonight.";

    await db.collection("escalations").updateOne(
      { userId: oid },
      {
        $set: {
          recoveryAction:
            action === "accept"
              ? null
              : {
                  title: "Recovery snoozed",
                  description: "You postponed the recovery action."
                },
          stage: action === "accept" ? 1 : 3,
          lastActionAt: now,
          events: fakeEscalationLog(action === "accept" ? 1 : 3),
          updatedAt: now
        },
        $push: {
          recentMessages: {
            role: "coach",
            content: coachMessage,
            sentAt: nowIso()
          }
        }
      } as any
    );

    return res.json({ ok: true, action, debtCount: nextDebt });
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to apply recovery", String(error));
  }
});

app.post("/api/voice/preview", rateLimit(20, 60_000), async (req, res) => {
  try {
    const { text } = req.body as { text?: string };
    const trimmed = String(text ?? "").trim();
    if (!trimmed) {
      return sendError(res, 400, "VALIDATION_ERROR", "text is required");
    }
    if (trimmed.length > MAX_VOICE_TEXT_LENGTH) {
      return sendError(res, 400, "VALIDATION_ERROR", `text must be <= ${MAX_VOICE_TEXT_LENGTH} characters`);
    }

    const audioBase64 = await generateVoiceBase64(trimmed);
    return res.json({
      mimeType: "audio/mpeg",
      audioBase64
    });
  } catch (error) {
    const code = String(error).toLowerCase().includes("elevenlabs") ? "VOICE_UNAVAILABLE" : "INTERNAL_ERROR";
    return sendError(res, 500, code, "Failed to generate voice preview", String(error));
  }
});

app.get("/api/demo/state", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    const db = await withMongoRetry(async () => getDb());
    const users = db.collection("users");
    const plans = db.collection("plans");
    const escalations = db.collection("escalations");

    let oid: ObjectId;
    if (userId) {
      if (!ObjectId.isValid(userId)) {
        return sendError(res, 400, "VALIDATION_ERROR", "If provided, userId must be a valid ObjectId");
      }
      oid = new ObjectId(userId);
    } else {
      const demoUser = await withMongoRetry(async () => users.findOne({ email: "demo@painexe.local" }));
      if (!demoUser?._id) {
        return sendError(res, 404, "NOT_FOUND", "Demo user not found. Run npm run seed first.");
      }
      oid = demoUser._id as ObjectId;
    }

    const [user, plan, escalation] = await withMongoRetry(async () =>
      Promise.all([
        users.findOne({ _id: oid }),
        plans.findOne({ userId: oid }),
        escalations.findOne({ userId: oid })
      ])
    );

    if (!user || !plan || !escalation) {
      return sendError(res, 404, "NOT_FOUND", "Demo state not found for user");
    }

    return res.json({
      ok: true,
      userId: oid.toString(),
      user: { name: user.name ?? "Demo User" },
      taskStatus: plan.todayTask?.status ?? "pending",
      debtCount: Number(plan.debtCount ?? 0),
      stage: boundedStage(Number(escalation.stage ?? 1)),
      recoveryAction: escalation.recoveryAction ?? null,
      updatedAt: nowIso()
    });
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to load demo state", String(error));
  }
});

app.post("/api/demo/reset", async (req, res) => {
  try {
    const { userId } = req.body as { userId?: string };
    const db = await withMongoRetry(async () => getDb());
    const users = db.collection("users");
    const plans = db.collection("plans");
    const escalations = db.collection("escalations");

    let oid: ObjectId;
    if (userId && ObjectId.isValid(userId)) {
      oid = new ObjectId(userId);
    } else {
      const demoUser = await withMongoRetry(async () => users.findOne({ email: "demo@painexe.local" }));
      if (!demoUser?._id) {
        return sendError(res, 404, "NOT_FOUND", "Demo user not found. Run npm run seed first.");
      }
      oid = demoUser._id as ObjectId;
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await withMongoRetry(async () =>
      Promise.all([
        plans.updateOne(
          { userId: oid },
          {
            $set: {
              userId: oid,
              todayTask: {
                title: "20-min punishment run + commitment to tomorrow",
                dueAt: tomorrow.toISOString(),
                status: "missed"
              },
              yesterdayTask: {
                title: "45-min zone 2 run",
                dueAt: yesterday.toISOString(),
                status: "missed"
              },
              debtCount: 1,
              updatedAt: now
            }
          },
          { upsert: true }
        ),
        escalations.updateOne(
          { userId: oid },
          {
            $set: {
              userId: oid,
              stage: 2,
              lastActionAt: now,
              processedMissedEvents: [],
              recentMessages: [
                {
                  role: "coach",
                  content: "You said Thursday. It's Saturday.",
                  sentAt: now.toISOString()
                }
              ],
              recoveryAction: demoRecoveryAction(),
              events: fakeEscalationLog(2),
              updatedAt: now
            }
          },
          { upsert: true }
        )
      ])
    );

    return res.json({ ok: true, userId: oid.toString(), debtCount: 1, stage: 2 });
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to reset demo state", String(error));
  }
});

app.listen(config.port, () => {
  console.log(`[backend] listening on http://localhost:${config.port}`);
});
