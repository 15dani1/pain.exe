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
    phoneNumber: "(305) 555-0142",
    googleCalendarEmail: "demo@painexe.local",
    timezone: "America/New_York",
    createdAt: now
  });

  await goals.insertOne({
    userId,
    title: "Run a 10k in 8 weeks",
    goalType: "Half Marathon",
    targetDate: new Date(now.getTime() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    scheduleConstraints: "Weekdays after 6pm, Saturday morning long run",
    escalationTolerance: "high",
    baseline: "Runs 2x/week, longest recent run 4 miles.",
    weeklyAvailability: "Weekdays at 6:00 AM, longer effort on Saturday morning.",
    wakeWindow: "Wake 5:30 AM, no calls after 9:00 PM.",
    injuryLimit: "Avoid back-to-back high-impact sessions.",
    trigger: "Direct accountability with visible debt.",
    channels: ["In-app", "SMS", "Call"],
    createdAt: now
  });

  await plans.insertOne({
    userId,
    title: "Seeded demo plan",
    goalType: "Seeded Demo",
    targetDate: new Date(now.getTime() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    phoneNumber: "(305) 555-0142",
    googleCalendarEmail: "demo@painexe.local",
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
    baseline: "Loaded from seeded backend demo user.",
    weeklyAvailability: "Weekdays after 6pm, Saturday morning long run.",
    wakeWindow: "Not captured in backend seed yet.",
    injuryLimit: "Not captured in backend seed yet.",
    trigger: "Direct accountability with visible debt.",
    channels: ["In-app", "SMS", "Call"],
    debtCount: 1,
    status: "Adjustment Needed",
    summary: "Seeded backend demo user for missed-workout escalation flow.",
    nextMission: "20-min punishment run + commitment to tomorrow",
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
