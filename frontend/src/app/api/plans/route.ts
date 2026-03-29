import { NextResponse } from "next/server";
import { fetchBackend, getBackendUrl, readBackendResponse } from "@/lib/backend";

export async function GET() {
  try {
    const response = await fetchBackend("/api/plan-library");
    const data = await readBackendResponse(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load plans",
        code: "BACKEND_UNAVAILABLE",
        detail: `${String(error)}. Check BACKEND_BASE_URL and confirm ${getBackendUrl("/api/plan-library")} is reachable.`,
      },
      { status: 502 },
    );
  }
}
