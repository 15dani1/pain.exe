import { NextResponse } from "next/server";
import { fetchBackend, getBackendUrl, readBackendResponse } from "@/lib/backend";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  try {
    const payload = await request.json().catch(() => ({}));
    const response = await fetchBackend(
      `/api/voice/session/${encodeURIComponent(sessionId)}/end`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    const data = await readBackendResponse(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to end voice session",
        code: "BACKEND_UNAVAILABLE",
        detail: `${String(error)}. Check BACKEND_BASE_URL and confirm ${getBackendUrl(`/api/voice/session/${encodeURIComponent(sessionId)}/end`)} is reachable.`,
      },
      { status: 502 },
    );
  }
}
