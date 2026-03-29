import { NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";
import { type OnboardingPayload } from "@/lib/demo-data";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as OnboardingPayload;

    const response = await fetchBackend("/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        name: payload.fullName,
        goalTitle: payload.goalType,
        goalType: payload.goalType,
        targetDate: payload.targetDate,
        phoneNumber: payload.phoneNumber,
        googleCalendarEmail: payload.googleCalendarEmail,
        baseline: payload.baseline,
        weeklyAvailability: payload.weeklyAvailability,
        wakeWindow: payload.wakeWindow,
        injuryLimit: payload.injuryLimit,
        trigger: payload.trigger,
        channels: payload.channels,
        scheduleConstraints: [
          payload.weeklyAvailability,
          payload.wakeWindow,
          payload.injuryLimit,
        ]
          .filter(Boolean)
          .join(" | "),
        escalationTolerance: payload.escalationTolerance,
      }),
    });

    const data = (await response.json()) as
      | { userId: string }
      | { error?: string; code?: string; detail?: string };

    if (!response.ok || !("userId" in data)) {
      return NextResponse.json(data, { status: response.status || 500 });
    }

    const dashboardResponse = await fetchBackend(
      `/api/dashboard?userId=${encodeURIComponent(data.userId)}`,
    );

    const dashboardData = (await dashboardResponse.json()) as
      | {
          todayTask?: {
            title?: string;
          };
        }
      | { error?: string; code?: string; detail?: string };

    const nextMission =
      "todayTask" in dashboardData && dashboardData.todayTask?.title
        ? dashboardData.todayTask.title
        : "First task created on backend. Dashboard fetch will populate live details.";

    return NextResponse.json({
      userId: data.userId,
      goalId: `goal_${payload.goalType.toLowerCase().replace(/\s+/g, "_")}_${payload.targetDate}`,
      planId: `plan_${payload.goalType.toLowerCase().replace(/\s+/g, "_")}_${payload.targetDate}`,
      summary: `${payload.fullName} committed to ${payload.goalType.toLowerCase()} by ${payload.targetDate} with ${payload.escalationTolerance.toLowerCase()} accountability across ${payload.channels.join(", ")}.`,
      nextMission,
      caution:
        "Core plan creation is now using Rahul's backend. Full settings history still stays in the frontend until the backend exposes plan and goal listing endpoints.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create plan",
        code: "BACKEND_UNAVAILABLE",
        detail: String(error),
      },
      { status: 502 },
    );
  }
}
