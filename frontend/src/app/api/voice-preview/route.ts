import { NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const response = await fetchBackend("/api/voice/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate voice preview",
        code: "BACKEND_UNAVAILABLE",
        detail: String(error),
      },
      { status: 502 },
    );
  }
}
