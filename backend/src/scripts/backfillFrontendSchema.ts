import "dotenv/config";
import { ObjectId } from "mongodb";
import { getDb } from "../db.js";

async function run() {
  const db = await getDb();
  const users = db.collection("users");
  const goals = db.collection("goals");
  const plans = db.collection("plans");

  const demoUser = await users.findOne({ email: "demo@painexe.local" });
  if (!demoUser?._id) {
    console.log("No demo user found. Skipping backfill.");
    return;
  }

  const userId = demoUser._id as ObjectId;
  const now = new Date();

  await users.updateOne(
    { _id: userId },
    {
      $set: {
        phoneNumber: demoUser.phoneNumber ?? "(305) 555-0142",
        googleCalendarEmail: demoUser.googleCalendarEmail ?? "demo@painexe.local",
        timezone: demoUser.timezone ?? "America/New_York",
        updatedAt: now
      }
    }
  );

  await goals.updateOne(
    { userId },
    {
      $set: {
        goalType: "Half Marathon",
        baseline: "Runs 2x/week, longest recent run 4 miles.",
        weeklyAvailability: "Weekdays at 6:00 AM, longer effort on Saturday morning.",
        wakeWindow: "Wake 5:30 AM, no calls after 9:00 PM.",
        injuryLimit: "Avoid back-to-back high-impact sessions.",
        trigger: "Direct accountability with visible debt.",
        channels: ["In-app", "SMS", "Call"],
        updatedAt: now
      }
    }
  );

  await plans.updateOne(
    { userId },
    {
      $set: {
        title: "Seeded demo plan",
        goalType: "Seeded Demo",
        targetDate: new Date(now.getTime() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        phoneNumber: "(305) 555-0142",
        googleCalendarEmail: "demo@painexe.local",
        baseline: "Loaded from seeded backend demo user.",
        weeklyAvailability: "Weekdays after 6pm, Saturday morning long run.",
        wakeWindow: "Not captured in backend seed yet.",
        injuryLimit: "Not captured in backend seed yet.",
        trigger: "Direct accountability with visible debt.",
        channels: ["In-app", "SMS", "Call"],
        status: "Adjustment Needed",
        summary: "Seeded backend demo user for missed-workout escalation flow.",
        nextMission: "20-min punishment run + commitment to tomorrow",
        updatedAt: now
      }
    }
  );

  console.log(`Backfill complete for demo user: ${userId.toString()}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
