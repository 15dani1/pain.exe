import { NextResponse } from "next/server";
import { fetchBackend, getBackendUrl, readBackendResponse } from "@/lib/backend";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const response = await fetchBackend("/api/voice/session/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await readBackendResponse(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to start voice session",
        code: "BACKEND_UNAVAILABLE",
        detail: `${String(error)}. Check BACKEND_BASE_URL and confirm ${getBackendUrl("/api/voice/session/start")} is reachable.`,
      },
      { status: 502 },
    );
  }
}
