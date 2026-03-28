export type GoalType =
  | "Half Marathon"
  | "Weight Loss"
  | "Strength Block"
  | "Daily Discipline"
  | "Custom Mission";

export type OnboardingPayload = {
  fullName: string;
  goalType: GoalType;
  targetDate: string;
  baseline: string;
  weeklyAvailability: string;
  wakeWindow: string;
  injuryLimit: string;
  trigger: string;
  escalationTolerance: "Measured" | "Relentless" | "Unhinged";
  channels: string[];
};

export type OnboardingResult = {
  userId: string;
  goalId: string;
  planId: string;
  summary: string;
  nextMission: string;
  caution: string;
};

export type PlanRecord = {
  id: string;
  title: string;
  goalType: GoalType;
  targetDate: string;
  createdAt: string;
  status: "Active" | "Adjustment Needed" | "Completed";
  nextMission: string;
  summary: string;
  baseline: string;
  weeklyAvailability: string;
  wakeWindow: string;
  injuryLimit: string;
  trigger: string;
  escalationTolerance: OnboardingPayload["escalationTolerance"];
  channels: string[];
};

export type Message = {
  id: string;
  channel: "In-app" | "SMS" | "Email" | "Call";
  tone: "Controlled" | "Pressure" | "Recovery";
  sender: "Coach" | "System" | "You";
  sentAt: string;
  text: string;
};

export type EscalationStage = {
  id: number;
  title: string;
  channel: string;
  status: "completed" | "active" | "pending";
  scheduledFor: string;
  note: string;
};

export type IntegrationStatus = {
  name: string;
  state: "Stubbed" | "Ready For Wiring" | "Seeded Demo";
  detail: string;
};

export type BackendStub = {
  surface: string;
  endpoint: string;
  status: string;
  note: string;
};

export const goalOptions: GoalType[] = [
  "Half Marathon",
  "Weight Loss",
  "Strength Block",
  "Daily Discipline",
  "Custom Mission",
];

export const onboardingDefaults: OnboardingPayload = {
  fullName: "Fernando",
  goalType: "Half Marathon",
  targetDate: "2026-06-20",
  baseline: "Runs 2x/week, longest recent run 4 miles, lifting twice weekly.",
  weeklyAvailability: "Weekdays at 6:00 AM, longer effort on Saturday morning.",
  wakeWindow: "Wake 5:30 AM, sleep by 10:30 PM, no calls after 9:00 PM.",
  injuryLimit: "Avoid back-to-back high-impact sessions. Mild right knee tightness.",
  trigger: "Call out avoidance, compare actions to stated identity, reward earned effort.",
  escalationTolerance: "Relentless",
  channels: ["In-app", "SMS", "Email"],
};

export const demoSummary = {
  coachName: "Goggins-mode / Inspired-by fallback",
  activeMission: "6.2 mile threshold run before 7:15 AM",
  dueAt: "2026-03-28T07:15:00-04:00",
  completionRate: 82,
  streakDays: 11,
  debtHours: 19,
  redemption:
    "If the run is missed, complete a 45-minute incline walk plus 200 weighted step-ups before lights out.",
  complianceNote:
    "The agent has detected a pattern: excuses spike after poor sleep and unread calendar blocks.",
};

export const seededPlans: PlanRecord[] = [
  {
    id: "plan_week_zero_001",
    title: "Half marathon base block",
    goalType: "Half Marathon",
    targetDate: "2026-06-20",
    createdAt: "2026-03-20",
    status: "Adjustment Needed",
    nextMission: "Tomorrow 6:00 AM: 4-mile tempo progression plus mobility reset.",
    summary:
      "Primary race-prep block focused on speed endurance, consistency, and early-morning compliance.",
    baseline: onboardingDefaults.baseline,
    weeklyAvailability: onboardingDefaults.weeklyAvailability,
    wakeWindow: onboardingDefaults.wakeWindow,
    injuryLimit: onboardingDefaults.injuryLimit,
    trigger: onboardingDefaults.trigger,
    escalationTolerance: "Relentless",
    channels: ["In-app", "SMS", "Email"],
  },
  {
    id: "plan_reset_002",
    title: "Discipline reset week",
    goalType: "Daily Discipline",
    targetDate: "2026-04-05",
    createdAt: "2026-03-12",
    status: "Completed",
    nextMission: "5:30 AM wake, no snooze, 20-minute outdoor walk.",
    summary:
      "Short reset block used to rebuild morning follow-through after two missed workouts.",
    baseline: "Low energy week, reduced running volume, still capable of daily low-impact sessions.",
    weeklyAvailability: "Daily mornings before work, 25-45 minutes available.",
    wakeWindow: "Wake 5:30 AM, lights out 10:15 PM.",
    injuryLimit: "Keep impact light. Prioritize consistency over intensity.",
    trigger: "Use identity language and visible debt tracking.",
    escalationTolerance: "Measured",
    channels: ["In-app", "Email"],
  },
];

export const demoMessages: Message[] = [
  {
    id: "m1",
    channel: "In-app",
    tone: "Controlled",
    sender: "Coach",
    sentAt: "05:40 AM",
    text: "Your run starts in 20 minutes. The door is open. Your excuse window is closing.",
  },
  {
    id: "m2",
    channel: "SMS",
    tone: "Pressure",
    sender: "System",
    sentAt: "07:24 AM",
    text: "Workout overdue. Calendar block ended nine minutes ago. Reply DONE, SNOOZE, or OWN IT.",
  },
  {
    id: "m3",
    channel: "In-app",
    tone: "Pressure",
    sender: "Coach",
    sentAt: "07:31 AM",
    text: "You asked for discipline, not comfort. This gets harder until you answer.",
  },
  {
    id: "m4",
    channel: "Call",
    tone: "Recovery",
    sender: "Coach",
    sentAt: "07:40 AM",
    text: "Voicemail fallback queued. Redemption plan drafted and waiting for confirmation.",
  },
];

export const escalationStages: EscalationStage[] = [
  {
    id: 1,
    title: "Mission Reminder",
    channel: "In-app",
    status: "completed",
    scheduledFor: "05:40 AM",
    note: "Sent 20 minutes before the run with identity-based framing.",
  },
  {
    id: 2,
    title: "Deadline Breach",
    channel: "SMS",
    status: "completed",
    scheduledFor: "07:24 AM",
    note: "Triggered exactly once after the workout window elapsed.",
  },
  {
    id: 3,
    title: "Full-Screen Interrupt",
    channel: "In-app modal",
    status: "active",
    scheduledFor: "07:31 AM",
    note: "Active now. User must resolve, snooze, or accept redemption.",
  },
  {
    id: 4,
    title: "Voice Pressure Call",
    channel: "Twilio + ElevenLabs",
    status: "pending",
    scheduledFor: "07:40 AM",
    note: "Stubbed for now, wired later through worker jobs and consent gates.",
  },
  {
    id: 5,
    title: "Recovery Follow-Up",
    channel: "SMS + in-app",
    status: "pending",
    scheduledFor: "08:05 AM",
    note: "Queues only if the user still has not acknowledged the miss.",
  },
];

export const integrationStatuses: IntegrationStatus[] = [
  {
    name: "Google Calendar",
    state: "Ready For Wiring",
    detail: "Workout events, pre-run nudges, and overdue timers will connect here.",
  },
  {
    name: "Wearable Verification",
    state: "Stubbed",
    detail: "Future imported workout signals can suppress redundant reminders.",
  },
  {
    name: "Twilio SMS + Calls",
    state: "Seeded Demo",
    detail: "Escalation stages already expose the delivery states and call-summary UI.",
  },
  {
    name: "ElevenLabs Voice",
    state: "Stubbed",
    detail: "Voice stage is modeled with fallback-safe persona controls.",
  },
];

export const backendStubs: BackendStub[] = [
  {
    surface: "Onboarding submission",
    endpoint: "/api/onboarding",
    status: "Implemented as local stub",
    note: "Returns normalized IDs, a mission summary, and a caution for future server action wiring.",
  },
  {
    surface: "Seeded agent state",
    endpoint: "/api/demo",
    status: "Implemented as local stub",
    note: "Supplies dashboard, messaging, integration, escalation, and saved-plan data.",
  },
  {
    surface: "Plan generation",
    endpoint: "server action placeholder",
    status: "UI stubbed",
    note: "Onboarding completion simulates a generated first mission while keeping the contract obvious.",
  },
];

export function buildOnboardingResponse(
  payload: OnboardingPayload,
): OnboardingResult {
  const missionByGoal: Record<GoalType, string> = {
    "Half Marathon": "Tomorrow 6:00 AM: 4-mile tempo progression plus mobility reset.",
    "Weight Loss": "Tomorrow 6:15 AM: 35-minute incline walk plus protein-first breakfast check-in.",
    "Strength Block": "Tomorrow 5:45 AM: lower-body strength session with recovery walk finisher.",
    "Daily Discipline": "Tomorrow 5:30 AM: wake, hydrate, journal, 20-minute outdoor walk, no snooze.",
    "Custom Mission": "Tomorrow 6:00 AM: first custom mission block scheduled and locked in.",
  };

  return {
    userId: "user_demo_fernando",
    goalId: `goal_${payload.goalType.toLowerCase().replace(/\s+/g, "_")}_001`,
    planId: `plan_${payload.goalType.toLowerCase().replace(/\s+/g, "_")}_${payload.targetDate}`,
    summary: `${payload.fullName} committed to ${payload.goalType.toLowerCase()} by ${payload.targetDate} with ${payload.escalationTolerance.toLowerCase()} accountability across ${payload.channels.join(", ")}.`,
    nextMission: missionByGoal[payload.goalType],
    caution:
      "Backend not wired yet: this response is a local contract stub standing in for user, goal, escalation, and plan creation.",
  };
}

export function createPlanRecord(
  payload: OnboardingPayload,
  result: OnboardingResult,
): PlanRecord {
  return {
    id: result.planId,
    title: `${payload.goalType} plan`,
    goalType: payload.goalType,
    targetDate: payload.targetDate,
    createdAt: "2026-03-28",
    status: "Active",
    nextMission: result.nextMission,
    summary: result.summary,
    baseline: payload.baseline,
    weeklyAvailability: payload.weeklyAvailability,
    wakeWindow: payload.wakeWindow,
    injuryLimit: payload.injuryLimit,
    trigger: payload.trigger,
    escalationTolerance: payload.escalationTolerance,
    channels: payload.channels,
  };
}
