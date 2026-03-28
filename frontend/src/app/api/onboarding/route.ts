import { NextResponse } from "next/server";
import {
  buildOnboardingResponse,
  type OnboardingPayload,
} from "@/lib/demo-data";

export async function POST(request: Request) {
  const payload = (await request.json()) as OnboardingPayload;
  const response = buildOnboardingResponse(payload);

  return NextResponse.json(response);
}
