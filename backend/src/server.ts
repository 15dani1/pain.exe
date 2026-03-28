import "dotenv/config";
import cors from "cors";
import express from "express";
import { ObjectId } from "mongodb";
import { config } from "./config.js";
import { getDb, withMongoRetry } from "./db.js";
import type { DashboardResponse, EscalationEvent, EscalationStage, MessageRole, TaskStatus } from "./types.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: config.frontendOrigin }));

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
      return res.status(400).json({ error: "name, goalTitle, and targetDate are required" });
    }

    const db = await getDb();
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
      events: fakeEscalationLog(1),
      updatedAt: now
    });

    return res.status(201).json({ userId: userInsert.insertedId.toString() });
  } catch (error) {
    return res.status(500).json({ error: "Failed to onboard user", detail: String(error) });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Valid userId query param is required" });
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
      return res.status(404).json({ error: "Dashboard data not found for user" });
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
    return res.status(500).json({ error: "Failed to load dashboard", detail: String(error) });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { userId, message } = req.body as { userId?: string; message?: string };
    if (!userId || !ObjectId.isValid(userId) || !message) {
      return res.status(400).json({ error: "userId and message are required" });
    }

    const db = await getDb();
    const oid = new ObjectId(userId);
    const plan = await db.collection("plans").findOne({ userId: oid });
    const escalation = await db.collection("escalations").findOne({ userId: oid });

    const stage = boundedStage(Number(escalation?.stage ?? 1));
    const debtCount = Number(plan?.debtCount ?? 0);
    const coachReply = await maybeOpenAIReply(message, { stage, debtCount });
    const sentAt = nowIso();

    await db.collection("escalations").updateOne(
      { userId: oid },
      {
        $set: { updatedAt: new Date() },
        $push: {
          recentMessages: {
            $each: [
              { role: "user", content: message, sentAt },
              { role: "coach", content: coachReply, sentAt: nowIso() }
            ],
            $slice: -20
          }
        }
      } as any
    );

    return res.json({ role: "coach", content: coachReply, sentAt });
  } catch (error) {
    return res.status(500).json({ error: "Failed to process chat", detail: String(error) });
  }
});

app.post("/api/checkin", async (req, res) => {
  try {
    const { userId, status } = req.body as { userId?: string; status?: TaskStatus };
    if (!userId || !ObjectId.isValid(userId) || !status || !["pending", "missed", "done"].includes(status)) {
      return res.status(400).json({ error: "Valid userId and status are required" });
    }

    const db = await getDb();
    const oid = new ObjectId(userId);

    const plan = await db.collection("plans").findOne({ userId: oid });
    const escalation = await db.collection("escalations").findOne({ userId: oid });

    const currentDebt = Number(plan?.debtCount ?? 0);
    const currentStage = boundedStage(Number(escalation?.stage ?? 1));

    const nextDebt = status === "missed" ? currentDebt + 1 : Math.max(0, currentDebt - 1);
    const nextStage = status === "missed" ? boundedStage(currentStage + 1) : boundedStage(currentStage - 1);

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

    const recoveryAction =
      status === "missed"
        ? {
            title: "20-min punishment run + commitment to tomorrow",
            description: "Do this instead today to clear debt and stay on track."
          }
        : null;

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

    return res.json({ ok: true, status, debtCount: nextDebt, stage: nextStage, recoveryAction });
  } catch (error) {
    return res.status(500).json({ error: "Failed to check in", detail: String(error) });
  }
});

app.post("/api/recovery", async (req, res) => {
  try {
    const { userId, action } = req.body as { userId?: string; action?: "accept" | "snooze" };
    if (!userId || !ObjectId.isValid(userId) || !action || !["accept", "snooze"].includes(action)) {
      return res.status(400).json({ error: "Valid userId and action are required" });
    }

    const db = await getDb();
    const oid = new ObjectId(userId);
    const now = new Date();

    const plan = await db.collection("plans").findOne({ userId: oid });
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
    return res.status(500).json({ error: "Failed to apply recovery", detail: String(error) });
  }
});

app.listen(config.port, () => {
  console.log(`[backend] listening on http://localhost:${config.port}`);
});
