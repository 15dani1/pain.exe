import { NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const response = await fetchBackend(
      `/api/dashboard?userId=${encodeURIComponent(userId)}`,
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load dashboard",
        code: "BACKEND_UNAVAILABLE",
        detail: String(error),
      },
      { status: 502 },
    );
  }
}
