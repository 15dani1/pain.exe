import "dotenv/config";
import { ObjectId } from "mongodb";
import { getDb } from "../db.js";

async function run() {
  const db = await getDb();
  const users = db.collection("users");
  const goals = db.collection("goals");
  const plans = db.collection("plans");
  const escalations = db.collection("escalations");

  const existing = await users.findOne({ email: "demo@painexe.local" });

  if (existing) {
    console.log(`Seed user already exists: ${existing._id.toString()}`);
    return;
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const userId = new ObjectId();

  await users.insertOne({
    _id: userId,
    name: "Demo User",
    email: "demo@painexe.local",
    createdAt: now
  });

  await goals.insertOne({
    userId,
    title: "Run a 10k in 8 weeks",
    targetDate: new Date(now.getTime() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    scheduleConstraints: "Weekdays after 6pm, Saturday morning long run",
    escalationTolerance: "high",
    createdAt: now
  });

  await plans.insertOne({
    userId,
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
  });

  await escalations.insertOne({
    userId,
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
    recoveryAction: {
      title: "20-min punishment run + commitment to tomorrow",
      description: "Complete this today to clear debt and reset momentum."
    },
    events: [
      {
        type: "reminder_sent",
        label: "Reminder sent",
        at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        type: "sms_sent",
        label: "SMS sent",
        at: new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      }
    ],
    updatedAt: now
  });

  console.log(`Seeded demo data. userId=${userId.toString()}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
