export type GarminDemoDailySnapshot = {
  steps: number;
  intensityMinutes: number;
  activeCalories: number;
  restingHeartRate: number;
  averageStress: number;
  bodyBattery: number;
  sleepHours: number;
  sleepQuality: string;
  respirationBrpm: number;
  pulseOx: number;
};

export type GarminDemoScenario = {
  id: string;
  label: string;
  expectedOutcome: "match" | "strike";
  summary: string;
  coachExpectation: string;
  highlights: string[];
  activityTemplates: GarminDemoActivityTemplate[];
};

export type GarminDemoActivityTemplate = {
  activityId: string;
  name: string;
  type: string;
  startOffsetMinutes: number;
  durationMinutes: number;
  distanceKm?: number;
  averageHeartRate?: number;
  steps?: number;
  calories?: number;
  averageCadence?: number;
  elevationGainMeters?: number;
};

export type GarminDemoActivity = {
  activityId: string;
  name: string;
  type: string;
  startTime: string;
  durationMinutes: number;
  distanceKm?: number;
  averageHeartRate?: number;
  steps?: number;
  calories?: number;
  averageCadence?: number;
  elevationGainMeters?: number;
};

export type GarminDemoResponse = {
  provider: "Garmin Demo Simulator";
  note: string;
  dailySnapshot: GarminDemoDailySnapshot;
  scenarios: GarminDemoScenario[];
};

const baseSnapshot: GarminDemoDailySnapshot = {
  steps: 14382,
  intensityMinutes: 76,
  activeCalories: 914,
  restingHeartRate: 48,
  averageStress: 29,
  bodyBattery: 41,
  sleepHours: 7.7,
  sleepQuality: "7h 42m, 1h 38m deep sleep",
  respirationBrpm: 13,
  pulseOx: 97,
};

export const garminDemoScenarios: GarminDemoScenario[] = [
  {
    id: "threshold-run-match",
    label: "Threshold run nailed",
    expectedOutcome: "match",
    summary:
      "A believable Garmin running activity with pace-worthy effort, elevated heart rate, and enough duration to clearly satisfy the plan.",
    coachExpectation:
      "The AI should acknowledge verified work, clear debt if present, and keep the user moving toward the next session.",
    highlights: ["7.4 km", "42 min", "156 avg HR", "168 cadence"],
    activityTemplates: [
      {
        activityId: "garmin-run-001",
        name: "Evening Threshold Run",
        type: "running",
        startOffsetMinutes: -55,
        durationMinutes: 42,
        distanceKm: 7.4,
        averageHeartRate: 156,
        steps: 8920,
        calories: 612,
        averageCadence: 168,
        elevationGainMeters: 58,
      },
    ],
  },
  {
    id: "mixed-day-match",
    label: "Busy day, plan still completed",
    expectedOutcome: "match",
    summary:
      "Multiple activities exist, but one running session clearly lines up with the assigned workout. This demonstrates best-candidate matching instead of naive ingestion.",
    coachExpectation:
      "The AI should recognize the matching run even with extra noise from walking and strength work.",
    highlights: ["Walk + strength + run", "best-candidate match", "verified effort"],
    activityTemplates: [
      {
        activityId: "garmin-walk-001",
        name: "Lunch Walk",
        type: "walking",
        startOffsetMinutes: -420,
        durationMinutes: 24,
        distanceKm: 1.8,
        averageHeartRate: 102,
        steps: 3100,
        calories: 154,
      },
      {
        activityId: "garmin-strength-001",
        name: "Garage Strength Circuit",
        type: "strength_training",
        startOffsetMinutes: -180,
        durationMinutes: 28,
        averageHeartRate: 118,
        calories: 208,
      },
      {
        activityId: "garmin-run-002",
        name: "Sunset Progression Run",
        type: "running",
        startOffsetMinutes: -48,
        durationMinutes: 36,
        distanceKm: 6.1,
        averageHeartRate: 149,
        steps: 7240,
        calories: 497,
        averageCadence: 164,
        elevationGainMeters: 41,
      },
    ],
  },
  {
    id: "no-match-strike",
    label: "Looks active, still a strike",
    expectedOutcome: "strike",
    summary:
      "The user moved, but not in a way that satisfies the planned workout. This makes the accountability story much sharper in a demo.",
    coachExpectation:
      "The AI should call out that Garmin showed activity, but none of it matched the planned run, so the user still gets a strike.",
    highlights: ["11.2k steps", "walk only", "stress elevated", "plan still missed"],
    activityTemplates: [
      {
        activityId: "garmin-walk-002",
        name: "Parking Deck Walk",
        type: "walking",
        startOffsetMinutes: -130,
        durationMinutes: 18,
        distanceKm: 1.3,
        averageHeartRate: 96,
        steps: 2204,
        calories: 102,
      },
      {
        activityId: "garmin-walk-003",
        name: "Late Errands Walk",
        type: "walking",
        startOffsetMinutes: -40,
        durationMinutes: 16,
        distanceKm: 1.1,
        averageHeartRate: 101,
        steps: 1910,
        calories: 94,
      },
    ],
  },
];

export function getGarminDemoPayload(): GarminDemoResponse {
  return {
    provider: "Garmin Demo Simulator",
    note:
      "Demo-safe Garmin-style metrics shaped around official Garmin developer categories like steps, heart rate, sleep, stress, pulse ox, body battery, respiration, and activity summaries.",
    dailySnapshot: baseSnapshot,
    scenarios: garminDemoScenarios,
  };
}

export function buildGarminDemoActivities(
  scenarioId: string,
  dueAtIso: string,
): GarminDemoActivity[] {
  const scenario =
    garminDemoScenarios.find((item) => item.id === scenarioId) ??
    garminDemoScenarios[0];
  const dueAt = new Date(dueAtIso).getTime();

  return scenario.activityTemplates.map((activity) => ({
    activityId: activity.activityId,
    name: activity.name,
    type: activity.type,
    startTime: new Date(dueAt + activity.startOffsetMinutes * 60_000).toISOString(),
    durationMinutes: activity.durationMinutes,
    distanceKm: activity.distanceKm,
    averageHeartRate: activity.averageHeartRate,
    steps: activity.steps,
    calories: activity.calories,
    averageCadence: activity.averageCadence,
    elevationGainMeters: activity.elevationGainMeters,
  }));
}
