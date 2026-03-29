import { NextResponse } from "next/server";
import {
  backendStubs,
  createDemoPlan,
  integrationStatuses,
  type DashboardPayload,
} from "@/lib/demo-data";
import { fetchBackend } from "@/lib/backend";

type DemoStateResponse = {
  ok: true;
  userId: string;
};

export async function GET() {
  try {
    const demoStateResponse = await fetchBackend("/api/demo/state");
    const demoState = (await demoStateResponse.json()) as
      | DemoStateResponse
      | { error?: string; code?: string; detail?: string };

    if (!demoStateResponse.ok || !("userId" in demoState)) {
      return NextResponse.json(
        demoState,
        { status: demoStateResponse.status || 500 },
      );
    }

    const dashboardResponse = await fetchBackend(
      `/api/dashboard?userId=${encodeURIComponent(demoState.userId)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const dashboard = (await dashboardResponse.json()) as
      | DashboardPayload
      | { error?: string; code?: string; detail?: string };

    if (!dashboardResponse.ok) {
      return NextResponse.json(
        dashboard,
        { status: dashboardResponse.status || 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      userId: demoState.userId,
      dashboard,
      integrations: integrationStatuses,
      backendStubs,
      demoPlan: createDemoPlan(demoState.userId, dashboard as DashboardPayload),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load backend demo state",
        code: "BACKEND_UNAVAILABLE",
        detail: String(error),
      },
      { status: 502 },
    );
  }
}
