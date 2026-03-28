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

function localCoachReply(message: string, stage: EscalationStage, debtCount: number) {
  const trimmed = message.trim();
  return `You said you wanted this. Stage ${stage}, debt ${debtCount}. No drama, just action: complete the recovery run today and confirm when done. ${trimmed ? `You said: "${trimmed}".` : ""}`.trim();
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

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend", at: nowIso() });
});

app.post("/api/onboarding", async (req, res) => {
  try {
    const { name, goalTitle, targetDate, scheduleConstraints, escalationTolerance } = req.body as {
      name?: string;
      goalTitle?: string;
      targetDate?: string;
      scheduleConstraints?: string;
      escalationTolerance?: string;
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
    const userInsert = await users.insertOne({ name, createdAt: now });

    await goals.insertOne({
      userId: userInsert.insertedId,
      title: goalTitle,
      targetDate,
      scheduleConstraints: scheduleConstraints ?? "",
      escalationTolerance: escalationTolerance ?? "medium",
      createdAt: now
    });

    await plans.insertOne({
      userId: userInsert.insertedId,
      todayTask: {
        title: "30-min run",
        dueAt: toIso(new Date(now.getTime() + 6 * 60 * 60 * 1000)),
        status: "pending" as TaskStatus
      },
      debtCount: 0,
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

app.get("/api/dashboard", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    if (!ObjectId.isValid(userId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Valid userId query param is required");
    }

    const oid = new ObjectId(userId);
    const [user, plan, escalation] = await withMongoRetry(async () => {
      const db = await getDb();
      return Promise.all([
        db.collection("users").findOne({ _id: oid }),
        db.collection("plans").findOne({ userId: oid }),
        db.collection("escalations").findOne({ userId: oid })
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
      escalationEvents: (escalation.events ?? fakeEscalationLog(boundedStage(Number(escalation.stage ?? 1)))) as EscalationEvent[]
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

    const db = await withMongoRetry(async () => getDb());
    const oid = new ObjectId(userId);

    const [plan, escalation] = await withMongoRetry(async () =>
      Promise.all([
        db.collection("plans").findOne({ userId: oid }),
        db.collection("escalations").findOne({ userId: oid })
      ])
    );

    const currentDebt = Number(plan?.debtCount ?? 0);
    const currentStage = boundedStage(Number(escalation?.stage ?? 1));
    const explicitKey = String(req.header("x-idempotency-key") ?? eventId ?? "").trim();
    const fallbackTaskKey = `task:${String(plan?.todayTask?.dueAt ?? "unknown")}:missed`;
    const missedEventKey = status === "missed" ? (explicitKey || fallbackTaskKey) : "";
    const nextDebt = status === "missed" ? currentDebt + 1 : Math.max(0, currentDebt - 1);
    const nextStage = status === "missed" ? boundedStage(currentStage + 1) : boundedStage(currentStage - 1);

    const recoveryAction =
      status === "missed"
        ? {
            title: "20-min punishment run + commitment to tomorrow",
            description: "Do this instead today to clear debt and stay on track."
          }
        : null;

    if (status === "missed") {
      const escalationResult = await db.collection("escalations").updateOne(
        { userId: oid, processedMissedEvents: { $ne: missedEventKey } },
        {
          $set: {
            stage: nextStage,
            lastActionAt: new Date(),
            recoveryAction,
            events: fakeEscalationLog(nextStage),
            updatedAt: new Date()
          },
          $addToSet: { processedMissedEvents: missedEventKey }
        }
      );

      if (escalationResult.modifiedCount === 0) {
        const [latestPlan, latestEscalation] = await withMongoRetry(async () =>
          Promise.all([
            db.collection("plans").findOne({ userId: oid }),
            db.collection("escalations").findOne({ userId: oid })
          ])
        );

        return res.json({
          ok: true,
          status,
          debtCount: Number(latestPlan?.debtCount ?? currentDebt),
          stage: boundedStage(Number(latestEscalation?.stage ?? currentStage)),
          recoveryAction: (latestEscalation?.recoveryAction ?? recoveryAction) as typeof recoveryAction,
          idempotentReplay: true,
          eventKey: missedEventKey
        });
      }

      await db.collection("plans").updateOne(
        { userId: oid },
        {
          $set: {
            "todayTask.status": status,
            debtCount: nextDebt,
            updatedAt: new Date()
          }
        }
      );

      return res.json({
        ok: true,
        status,
        debtCount: nextDebt,
        stage: nextStage,
        recoveryAction,
        idempotentReplay: false,
        eventKey: missedEventKey
      });
    }

    await db.collection("plans").updateOne(
      { userId: oid },
      {
        $set: {
          "todayTask.status": status,
          debtCount: nextDebt,
          updatedAt: new Date()
        }
      }
    );

    await db.collection("escalations").updateOne(
      { userId: oid },
      {
        $set: {
          stage: nextStage,
          lastActionAt: new Date(),
          recoveryAction,
          events: fakeEscalationLog(nextStage),
          updatedAt: new Date()
        }
      }
    );

    return res.json({ ok: true, status, debtCount: nextDebt, stage: nextStage, recoveryAction, idempotentReplay: false });
  } catch (error) {
    return sendError(res, 500, "DB_ERROR", "Failed to check in", String(error));
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
