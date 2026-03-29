import { NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";
import {
  buildGarminDemoActivities,
  getGarminDemoPayload,
} from "@/lib/garmin-demo";
import type { DashboardPayload } from "@/lib/demo-data";

type ApiError = {
  error?: string;
  code?: string;
  detail?: string;
};

export async function GET() {
  return NextResponse.json(getGarminDemoPayload());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      scenarioId?: string;
    };

    const userId = String(body.userId ?? "").trim();
    const scenarioId = String(body.scenarioId ?? "").trim();

    if (!userId || !scenarioId) {
      return NextResponse.json(
        {
          error: "userId and scenarioId are required",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const dashboardResponse = await fetchBackend(
      `/api/dashboard?userId=${encodeURIComponent(userId)}`,
      {
        headers: { Accept: "application/json" },
      },
    );

    const dashboard = (await dashboardResponse.json()) as
      | DashboardPayload
      | ApiError;

    if (!dashboardResponse.ok || !("todayTask" in dashboard)) {
      return NextResponse.json(
        dashboard,
        { status: dashboardResponse.status || 500 },
      );
    }

    const activities = buildGarminDemoActivities(
      scenarioId,
      dashboard.todayTask.dueAt,
    );

    const syncResponse = await fetchBackend("/api/integrations/garmin/sync", {
      method: "POST",
      body: JSON.stringify({
        userId,
        activities,
      }),
    });

    const syncResult = (await syncResponse.json()) as Record<string, unknown>;

    return NextResponse.json(syncResult, {
      status: syncResponse.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to run Garmin demo sync",
        code: "BACKEND_UNAVAILABLE",
        detail: String(error),
      },
      { status: 502 },
    );
  }
}
