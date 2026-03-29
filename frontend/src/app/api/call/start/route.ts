import { NextResponse } from "next/server";
import { fetchBackend, getBackendUrl, readBackendResponse } from "@/lib/backend";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const response = await fetchBackend("/api/call/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await readBackendResponse(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to start trainer call",
        code: "BACKEND_UNAVAILABLE",
        detail: `${String(error)}. Check BACKEND_BASE_URL and confirm ${getBackendUrl("/api/call/start")} is reachable.`,
      },
      { status: 502 },
    );
  }
}
