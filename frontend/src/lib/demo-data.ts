export type GoalType =
  | "Half Marathon"
  | "Weight Loss"
  | "Strength Block"
  | "Daily Discipline"
  | "Custom Mission";

export type OnboardingPayload = {
  fullName: string;
  phoneNumber: string;
  googleCalendarEmail: string;
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
  userId: string;
  title: string;
  goalType: GoalType | "Seeded Demo";
  targetDate: string;
  phoneNumber: string;
  googleCalendarEmail: string;
  createdAt: string;
  status: "Active" | "Adjustment Needed" | "Completed";
  nextMission: string;
  summary: string;
  baseline: string;
  weeklyAvailability: string;
  wakeWindow: string;
  injuryLimit: string;
  trigger: string;
  escalationTolerance: OnboardingPayload["escalationTolerance"] | "High";
  channels: string[];
  adherenceSummary?: string;
};

export type TrainingPlanPreviewItem = {
  day: string;
  title: string;
  detail: string;
  intent: string;
};

export type WeeklyOverviewItem = {
  day: string;
  focus: string;
  commitment: string;
};

export type MonthlyOverviewItem = {
  month: string;
  focus: string;
};

export type Message = {
  id: string;
  channel: "In-app" | "SMS" | "Email" | "Call";
  tone: "Controlled" | "Pressure" | "Recovery";
  sender: "Coach" | "System" | "You";
  sentAt: string;
  text: string;
};

export type EscalationStageView = {
  id: number;
  title: string;
  channel: string;
  status: "completed" | "active" | "pending";
  scheduledFor: string;
  note: string;
};

export type IntegrationStatus = {
  name: string;
  state: "Stubbed" | "Ready For Wiring" | "Seeded Demo" | "Integrated";
  detail: string;
};

export type BackendStub = {
  surface: string;
  endpoint: string;
  status: string;
  note: string;
};

export type DashboardPayload = {
  user: { name: string };
  todayTask: {
    title: string;
    dueAt: string;
    status: "pending" | "missed" | "done";
  };
  debtCount: number;
  escalation: {
    stage: 1 | 2 | 3 | 4 | 5;
    lastActionAt: string;
  };
  recentMessages: {
    role: "coach" | "user";
    content: string;
    sentAt: string;
  }[];
  recoveryAction: {
    title: string;
    description: string;
  } | null;
  escalationEvents: {
    type: "reminder_sent" | "sms_sent" | "call_placed";
    label: string;
    at: string;
  }[];
  integrations?: {
    garmin?: {
      connected: boolean;
      lastSyncAt: string | null;
      status: "idle" | "matched" | "strike";
      strikeCount: number;
      lastEvaluation: {
        matched: boolean;
        summary: string;
        matchedActivityType: string | null;
        matchedAt: string | null;
      } | null;
    };
  };
};

export type DemoApiResponse = {
  ok: true;
  userId: string;
  dashboard: DashboardPayload;
  integrations: IntegrationStatus[];
  backendStubs: BackendStub[];
  demoPlan: PlanRecord;
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
  phoneNumber: "(305) 555-0142",
  googleCalendarEmail: "fernando.demo@gmail.com",
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

export const integrationStatuses: IntegrationStatus[] = [
  {
    name: "Google Calendar",
    state: "Ready For Wiring",
    detail: "Workout blocks and reminders can land here.",
  },
  {
    name: "Garmin integration",
    state: "Integrated",
    detail: "Watch activity can verify whether the workout really happened.",
  },
  {
    name: "SMS/Voice Calls",
    state: "Seeded Demo",
    detail: "The coaching tone can be previewed through message and call samples.",
  },
];

export const backendStubs: BackendStub[] = [
  {
    surface: "Frontend proxy onboarding",
    endpoint: "/api/onboarding",
    status: "Integrated",
    note: "Maps trainee onboarding inputs onto Rahul's backend onboarding contract.",
  },
  {
    surface: "Frontend demo bootstrap",
    endpoint: "/api/demo",
    status: "Integrated",
    note: "Loads seeded demo user plus dashboard state from the backend service.",
  },
  {
    surface: "Command center actions",
    endpoint: "/api/chat, /api/checkin, /api/recovery",
    status: "Integrated",
    note: "Frontend actions proxy through Next.js route handlers to Rahul's backend.",
  },
  {
    surface: "Garmin demo sync",
    endpoint: "/api/garmin-demo -> backend /api/integrations/garmin/sync",
    status: "Integrated",
    note: "Runs seeded Garmin-style activity scenarios against the live backend plan and escalation state.",
  },
];

export function createPlanRecord(
  payload: OnboardingPayload,
  result: OnboardingResult,
): PlanRecord {
  return {
    id: result.planId,
    userId: result.userId,
    title: `${payload.goalType} plan`,
    goalType: payload.goalType,
    targetDate: payload.targetDate,
    phoneNumber: payload.phoneNumber,
    googleCalendarEmail: payload.googleCalendarEmail,
    createdAt: new Date().toISOString(),
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

export function createDemoPlan(
  userId: string,
  dashboard: DashboardPayload,
): PlanRecord {
  return {
    id: `seeded-demo-${userId}`,
    userId,
    title: "Seeded demo plan",
    goalType: "Seeded Demo",
    targetDate: new Date(
      Date.now() + 8 * 7 * 24 * 60 * 60 * 1000,
    ).toISOString().slice(0, 10),
    phoneNumber: "(305) 555-0142",
    googleCalendarEmail: "demo@painexe.local",
    createdAt: new Date().toISOString(),
    status: dashboard.todayTask.status === "missed" ? "Adjustment Needed" : "Active",
    nextMission: dashboard.todayTask.title,
    summary:
      "Seeded backend demo user used to validate the missed-workout escalation story and live command center integration.",
    baseline: "Loaded from seeded backend demo user.",
    weeklyAvailability: "Weekdays after 6pm, Saturday morning long run.",
    wakeWindow: "Not captured in backend seed yet.",
    injuryLimit: "Not captured in backend seed yet.",
    trigger: "Direct accountability with visible debt.",
    escalationTolerance: "High",
    channels: ["In-app", "SMS", "Call"],
  };
}

export function mapDashboardMessages(
  messages: DashboardPayload["recentMessages"],
): Message[] {
  return messages.map((message, index) => ({
    id: `${message.sentAt}-${index}`,
    channel: index === messages.length - 1 && message.role === "coach" ? "In-app" : "SMS",
    tone:
      message.role === "user"
        ? "Controlled"
        : message.content.toLowerCase().includes("clear debt")
          ? "Recovery"
          : "Pressure",
    sender: message.role === "coach" ? "Coach" : "You",
    sentAt: new Date(message.sentAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    text: message.content,
  }));
}

export function mapEscalationTimeline(
  stage: DashboardPayload["escalation"]["stage"],
  events: DashboardPayload["escalationEvents"],
): EscalationStageView[] {
  const eventMap = new Map(events.map((event) => [event.type, event]));

  return [
    {
      id: 1,
      title: "Mission Reminder",
      channel: "In-app",
      status: stage > 1 ? "completed" : stage === 1 ? "active" : "pending",
      scheduledFor: formatEventTime(eventMap.get("reminder_sent")?.at),
      note: "Initial accountability ping before the deadline.",
    },
    {
      id: 2,
      title: "Deadline Breach",
      channel: "SMS",
      status: stage > 2 ? "completed" : stage === 2 ? "active" : "pending",
      scheduledFor: formatEventTime(eventMap.get("sms_sent")?.at),
      note: "Missed workout acknowledged and pressure increased.",
    },
    {
      id: 3,
      title: "Coach Follow-Up",
      channel: "In-app",
      status: stage > 3 ? "completed" : stage === 3 ? "active" : "pending",
      scheduledFor: formatEventTime(eventMap.get("call_placed")?.at),
      note: "Recovery action becomes the main path back to compliance.",
    },
    {
      id: 4,
      title: "Voice Pressure",
      channel: "Voice preview / call",
      status: stage > 4 ? "completed" : stage === 4 ? "active" : "pending",
      scheduledFor: "Queued by escalation stage",
      note: "Voice path exists in the backend and can be enabled when desired.",
    },
    {
      id: 5,
      title: "Repeat Follow-Up",
      channel: "SMS + in-app",
      status: stage === 5 ? "active" : "pending",
      scheduledFor: "After no response",
      note: "Continues until the user resolves or snoozes the debt.",
    },
  ];
}

function formatEventTime(value?: string) {
  if (!value) {
    return "Not sent yet";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTrainingPlanPreview(
  goalType: GoalType | "Seeded Demo",
): TrainingPlanPreviewItem[] {
  switch (goalType) {
    case "Half Marathon":
      return [
        {
          day: "Monday",
          title: "Tempo progression run",
          detail: "4 miles with a negative split and a mobility reset after.",
          intent: "Build race pace control without burning the whole week.",
        },
        {
          day: "Wednesday",
          title: "Strength and injury shield",
          detail: "Lower-body lift, calf raises, and single-leg knee stability work.",
          intent: "Keep durability high so the running plan survives real life.",
        },
        {
          day: "Saturday",
          title: "Long run checkpoint",
          detail: "6-8 miles, conversational pace, with a nutrition check-in.",
          intent: "Increase endurance and prove schedule discipline.",
        },
      ];
    case "Weight Loss":
      return [
        {
          day: "Monday",
          title: "Incline walk plus protein check",
          detail: "35-minute walk followed by breakfast accountability.",
          intent: "Create repeatable calorie burn without huge recovery debt.",
        },
        {
          day: "Thursday",
          title: "Strength circuit",
          detail: "Full-body resistance session with a short finishers block.",
          intent: "Preserve muscle while building consistency.",
        },
        {
          day: "Sunday",
          title: "Weekly reset",
          detail: "Meal prep, weigh-in, and plan review before the next week starts.",
          intent: "Turn progress into a system instead of a mood.",
        },
      ];
    case "Strength Block":
      return [
        {
          day: "Tuesday",
          title: "Heavy lower-body day",
          detail: "Squat focus with posterior-chain accessories and recovery notes.",
          intent: "Drive overload while managing fatigue.",
        },
        {
          day: "Thursday",
          title: "Upper-body volume",
          detail: "Press, pull, and carry work with exact rest windows.",
          intent: "Build work capacity and track effort honestly.",
        },
        {
          day: "Saturday",
          title: "Conditioning finisher",
          detail: "Sled or interval work tied to the week's compliance score.",
          intent: "Keep discipline high even outside the main lifts.",
        },
      ];
    case "Daily Discipline":
      return [
        {
          day: "Daily",
          title: "Wake-and-move block",
          detail: "No snooze, hydrate, sunlight, and a 20-minute walk.",
          intent: "Create identity proof before the day can drift.",
        },
        {
          day: "Midday",
          title: "Check-in prompt",
          detail: "One quick progress note and zero excuse language.",
          intent: "Force awareness before momentum disappears.",
        },
        {
          day: "Night",
          title: "Reset sequence",
          detail: "Tomorrow plan, gear staging, and bedtime cutoff.",
          intent: "Make the next morning easier to win.",
        },
      ];
    case "Custom Mission":
      return [
        {
          day: "Block 1",
          title: "Primary mission session",
          detail: "Highest-priority effort scheduled in your freshest window.",
          intent: "Attach serious work to your actual calendar, not wishful thinking.",
        },
        {
          day: "Block 2",
          title: "Recovery or support task",
          detail: "Mobility, admin, or lower-intensity work that keeps the chain intact.",
          intent: "Reduce the chance that one miss collapses the whole plan.",
        },
        {
          day: "Checkpoint",
          title: "Weekly review",
          detail: "Score compliance, review misses, and update the next target.",
          intent: "Turn the mission into a closed feedback loop.",
        },
      ];
    case "Seeded Demo":
      return [
        {
          day: "Overdue now",
          title: "Punishment run",
          detail: "20-minute recovery run tied to missed-workout debt.",
          intent: "Demonstrate the escalation and recovery loop live.",
        },
        {
          day: "Tomorrow",
          title: "Commitment reset",
          detail: "Next scheduled run appears immediately after recovery acceptance.",
          intent: "Show that the app restructures the plan instead of stopping.",
        },
        {
          day: "This week",
          title: "Accountability cadence",
          detail: "Messages, escalation timeline, and optional voice pressure are visible.",
          intent: "Make the overall product experience obvious before the full build exists.",
        },
      ];
  }
}

export function getWeeklyOverview(
  goalType: GoalType | "Seeded Demo",
): WeeklyOverviewItem[] {
  switch (goalType) {
    case "Half Marathon":
      return [
        { day: "Mon", focus: "Easy run", commitment: "35-45 min" },
        { day: "Tue", focus: "Strength", commitment: "30-40 min" },
        { day: "Wed", focus: "Workout run", commitment: "40-50 min" },
        { day: "Thu", focus: "Recovery", commitment: "20-30 min" },
        { day: "Fri", focus: "Off or mobility", commitment: "15 min" },
        { day: "Sat", focus: "Long run", commitment: "60-90 min" },
        { day: "Sun", focus: "Reset", commitment: "20 min" },
      ];
    case "Weight Loss":
      return [
        { day: "Mon", focus: "Walk + nutrition", commitment: "35 min" },
        { day: "Tue", focus: "Strength", commitment: "35 min" },
        { day: "Wed", focus: "Walk", commitment: "30 min" },
        { day: "Thu", focus: "Strength", commitment: "35 min" },
        { day: "Fri", focus: "Recovery", commitment: "20 min" },
        { day: "Sat", focus: "Long walk", commitment: "45 min" },
        { day: "Sun", focus: "Prep + review", commitment: "25 min" },
      ];
    case "Strength Block":
      return [
        { day: "Mon", focus: "Upper", commitment: "50 min" },
        { day: "Tue", focus: "Lower", commitment: "55 min" },
        { day: "Wed", focus: "Recovery", commitment: "20 min" },
        { day: "Thu", focus: "Upper volume", commitment: "50 min" },
        { day: "Fri", focus: "Lower power", commitment: "45 min" },
        { day: "Sat", focus: "Conditioning", commitment: "25 min" },
        { day: "Sun", focus: "Off", commitment: "Rest" },
      ];
    case "Daily Discipline":
      return [
        { day: "Mon", focus: "Wake block", commitment: "20 min" },
        { day: "Tue", focus: "Wake block", commitment: "20 min" },
        { day: "Wed", focus: "Wake block", commitment: "20 min" },
        { day: "Thu", focus: "Wake block", commitment: "20 min" },
        { day: "Fri", focus: "Wake block", commitment: "20 min" },
        { day: "Sat", focus: "Long reset", commitment: "30 min" },
        { day: "Sun", focus: "Review", commitment: "20 min" },
      ];
    case "Custom Mission":
      return [
        { day: "Mon", focus: "Primary block", commitment: "45 min" },
        { day: "Tue", focus: "Support block", commitment: "30 min" },
        { day: "Wed", focus: "Primary block", commitment: "45 min" },
        { day: "Thu", focus: "Recovery", commitment: "20 min" },
        { day: "Fri", focus: "Primary block", commitment: "45 min" },
        { day: "Sat", focus: "Catch-up", commitment: "30 min" },
        { day: "Sun", focus: "Weekly review", commitment: "20 min" },
      ];
    case "Seeded Demo":
      return [
        { day: "Mon", focus: "Recovery run", commitment: "20 min" },
        { day: "Tue", focus: "Reset workout", commitment: "30 min" },
        { day: "Wed", focus: "Easy movement", commitment: "20 min" },
        { day: "Thu", focus: "Workout", commitment: "35 min" },
        { day: "Fri", focus: "Mobility", commitment: "15 min" },
        { day: "Sat", focus: "Long effort", commitment: "50 min" },
        { day: "Sun", focus: "Plan reset", commitment: "15 min" },
      ];
  }
}

export function getMonthlyOverview(
  goalType: GoalType | "Seeded Demo",
): MonthlyOverviewItem[] {
  switch (goalType) {
    case "Half Marathon":
      return [
        { month: "Month 1", focus: "Consistency and base mileage" },
        { month: "Month 2", focus: "Longer runs and threshold work" },
        { month: "Month 3", focus: "Peak volume and taper" },
      ];
    case "Weight Loss":
      return [
        { month: "Month 1", focus: "Habit consistency and calorie control" },
        { month: "Month 2", focus: "Strength and weekly adherence" },
        { month: "Month 3", focus: "Body comp momentum and review" },
      ];
    case "Strength Block":
      return [
        { month: "Month 1", focus: "Technique and volume base" },
        { month: "Month 2", focus: "Progressive overload" },
        { month: "Month 3", focus: "Peak lifts and consolidation" },
      ];
    case "Daily Discipline":
      return [
        { month: "Month 1", focus: "Morning routine lock-in" },
        { month: "Month 2", focus: "Midday and evening consistency" },
        { month: "Month 3", focus: "Identity reinforcement and streaks" },
      ];
    case "Custom Mission":
      return [
        { month: "Month 1", focus: "Define cadence and remove friction" },
        { month: "Month 2", focus: "Sustain deep work blocks" },
        { month: "Month 3", focus: "Review progress and raise the target" },
      ];
    case "Seeded Demo":
      return [
        { month: "Month 1", focus: "Recovery and accountability loop" },
        { month: "Month 2", focus: "Consistency after reset" },
        { month: "Month 3", focus: "Stable training rhythm" },
      ];
  }
}

export type WorkoutDayStripMarker = "done" | "missed" | "empty";

export type WorkoutDayStripDay = {
  key: string;
  weekday: string;
  dateLabel: string;
  marker: WorkoutDayStripMarker;
};

/** Demo outcomes for the calendar days immediately before today, oldest to newest. */
const DEMO_WORKOUT_STRIP_PAST: Array<"done" | "missed"> = [
  "done",
  "missed",
  "done",
  "done",
  "missed",
  "done",
];

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addLocalDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Rolling last-seven-days strip: prior days use seeded done/missed, today uses live status. */
export function getWorkoutWeekStrip(
  nowMs: number,
  todayTaskStatus: "pending" | "done" | "missed" | null,
): WorkoutDayStripDay[] {
  const today = startOfLocalDay(new Date(nowMs));
  const out: WorkoutDayStripDay[] = [];

  for (let offset = -6; offset <= 0; offset++) {
    const d = addLocalDays(today, offset);
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    const dateLabel = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    let marker: WorkoutDayStripMarker = "empty";
    if (offset < 0) {
      const seed = DEMO_WORKOUT_STRIP_PAST[offset + 6];
      marker = seed ?? "empty";
    } else if (offset === 0) {
      if (todayTaskStatus === "done") {
        marker = "done";
      } else if (todayTaskStatus === "missed") {
        marker = "missed";
      }
    }

    out.push({ key, weekday, dateLabel, marker });
  }

  return out;
}
