import { NextResponse } from "next/server";
import {
  backendStubs,
  demoMessages,
  demoSummary,
  escalationStages,
  integrationStatuses,
  seededPlans,
} from "@/lib/demo-data";

export function GET() {
  return NextResponse.json({
    summary: demoSummary,
    plans: seededPlans,
    messages: demoMessages,
    escalations: escalationStages,
    integrations: integrationStatuses,
    backendStubs,
  });
}
