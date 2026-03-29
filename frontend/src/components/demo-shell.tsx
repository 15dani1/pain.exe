"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import {
  createPlanRecord,
  mapEscalationTimeline,
  type DashboardPayload,
  type DemoApiResponse,
  type IntegrationStatus,
  type OnboardingPayload,
  type OnboardingResult,
  type PlanRecord,
} from "@/lib/demo-data";
import {
  type GarminDemoResponse,
  type GarminDemoScenario,
} from "@/lib/garmin-demo";

const PLAN_STORAGE_KEY = "painexe.created-plans";
const SELECTED_PLAN_STORAGE_KEY = "painexe.selected-plan-id";

const navItems = [
  {
    href: "/create-plan",
    label: "Create Plan",
    eyebrow: "Wizard",
    description: "Build a new accountability plan with the existing flow.",
  },
  {
    href: "/plans",
    label: "My Plans",
    eyebrow: "Library",
    description: "Review every saved plan and the exact settings behind it.",
  },
  {
    href: "/today",
    label: "Today",
    eyebrow: "Command",
    description: "See what matters today, what is overdue, and what to resolve.",
  },
  {
    href: "/integrations",
    label: "Integrations",
    eyebrow: "Signals",
    description: "Show the connected systems that make the demo believable.",
  },
] as const;

type PageKind = "create-plan" | "plans" | "today" | "integrations";

type ApiError = {
  error?: string;
  code?: string;
  detail?: string;
};

type GarminSyncResponse = {
  matched: boolean;
  strikeApplied: boolean;
  feedback: string;
  stage: number;
  debtCount: number;
  matchedActivity?: {
    name: string;
    type: string;
    durationMinutes: number;
    distanceKm?: number;
    averageHeartRate?: number;
    steps?: number;
  } | null;
};

type DemoShellProps = {
  page: PageKind;
};

export function DemoShell({ page }: DemoShellProps) {
  const pathname = usePathname();
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [garminDemo, setGarminDemo] = useState<GarminDemoResponse | null>(null);
  const [garminPending, setGarminPending] = useState<string | null>(null);
  const [garminResult, setGarminResult] = useState<GarminSyncResponse | null>(null);

  const selectedPlan = useMemo(() => {
    if (plans.length === 0) {
      return null;
    }

    return plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;
  }, [plans, selectedPlanId]);

  const escalationTimeline = useMemo(
    () =>
      dashboard
        ? mapEscalationTimeline(
            dashboard.escalation.stage,
            dashboard.escalationEvents,
          )
        : [],
    [dashboard],
  );

  const complianceScore = useMemo(() => {
    if (!dashboard) {
      return 0;
    }

    const stagePenalty = (dashboard.escalation.stage - 1) * 12;
    const debtPenalty = dashboard.debtCount * 10;
    return Math.max(25, 100 - stagePenalty - debtPenalty);
  }, [dashboard]);

  const countdown = useMemo(() => {
    if (!dashboard || !now) {
      return "Calculating...";
    }

    const dueAt = new Date(dashboard.todayTask.dueAt).getTime();
    const diff = dueAt - now;
    const absoluteMinutes = Math.floor(Math.abs(diff) / 60_000);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    const value = `${hours}h ${minutes}m`;

    return diff >= 0 ? `${value} left` : `${value} overdue`;
  }, [dashboard, now]);

  const garminStatus = dashboard?.integrations?.garmin;

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    persistPlans(plans);
  }, [plans]);

  useEffect(() => {
    if (!selectedPlanId) {
      return;
    }

    window.localStorage.setItem(SELECTED_PLAN_STORAGE_KEY, selectedPlanId);
  }, [selectedPlanId]);

  useEffect(() => {
    if (selectedPlan) {
      setCalendarConnected(Boolean(selectedPlan.googleCalendarEmail));
    }
  }, [selectedPlan]);

  async function bootstrap() {
    setError(null);

    try {
      const [demoResponse, garminResponse] = await Promise.all([
        fetch("/api/demo"),
        fetch("/api/garmin-demo"),
      ]);
      const data = (await demoResponse.json()) as DemoApiResponse | ApiError;
      const garminData = (await garminResponse.json()) as GarminDemoResponse | ApiError;

      if (!demoResponse.ok || !("ok" in data)) {
        throw new Error(getApiErrorMessage(data, "Failed to load demo state"));
      }
      if (!garminResponse.ok || !("provider" in garminData)) {
        throw new Error(getApiErrorMessage(garminData, "Failed to load Garmin demo data"));
      }

      const localPlans = readStoredPlans();
      const mergedPlans = mergePlans(data.demoPlan, localPlans);
      const storedSelectedPlanId = readSelectedPlanId();
      const initialSelectedPlanId =
        storedSelectedPlanId &&
        mergedPlans.some((plan) => plan.id === storedSelectedPlanId)
          ? storedSelectedPlanId
          : data.demoPlan.id;

      setPlans(mergedPlans);
      setSelectedPlanId(initialSelectedPlanId);
      setActiveUserId(data.userId);
      setDashboard(data.dashboard);
      setIntegrations(data.integrations);
      setCalendarConnected(
        Boolean(
          mergedPlans.find((plan) => plan.id === initialSelectedPlanId)
            ?.googleCalendarEmail,
        ),
      );
      setGarminDemo(garminData);
    } catch (caughtError) {
      setError(String(caughtError));
    }
  }

  async function loadDashboardForUser(userId: string) {
    const response = await fetch(
      `/api/dashboard?userId=${encodeURIComponent(userId)}`,
    );
    const data = (await response.json()) as DashboardPayload | ApiError;

    if (!response.ok || !("todayTask" in data)) {
      throw new Error(getApiErrorMessage(data, "Failed to load dashboard"));
    }

    setActiveUserId(userId);
    setDashboard(data);
  }

  async function handleSelectPlan(plan: PlanRecord) {
    setSelectedPlanId(plan.id);

    try {
      setActionPending("loading-plan");
      await loadDashboardForUser(plan.userId);
      setError(null);
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setActionPending(null);
    }
  }

  async function handlePlanCreated(
    payload: OnboardingPayload,
    result: OnboardingResult,
  ) {
    const nextPlan = createPlanRecord(payload, result);
    const mergedPlans = mergePlans(undefined, [nextPlan, ...plans]);

    persistPlans(mergedPlans);
    setPlans(mergedPlans);
    setSelectedPlanId(nextPlan.id);
    persistSelectedPlanId(nextPlan.id);

    try {
      setActionPending("creating-plan");
      await loadDashboardForUser(result.userId);
      setError(null);
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setActionPending(null);
    }
  }

  async function runGarminScenario(scenario: GarminDemoScenario) {
    if (!activeUserId) {
      return;
    }

    setGarminPending(scenario.id);
    setGarminResult(null);

    try {
      const response = await fetch("/api/garmin-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: activeUserId,
          scenarioId: scenario.id,
        }),
      });

      const data = (await response.json()) as GarminSyncResponse | ApiError;

      if (!response.ok || !("matched" in data)) {
        throw new Error(getApiErrorMessage(data, "Failed to run Garmin demo sync"));
      }

      setGarminResult(data);
      await loadDashboardForUser(activeUserId);
      setError(null);
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setGarminPending(null);
    }
  }

  async function submitCheckin(status: "done" | "missed") {
    if (!activeUserId || !dashboard) {
      return;
    }

    setActionPending(status);

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: activeUserId,
          status,
          eventId:
            status === "missed"
              ? `missed-${activeUserId}-${dashboard.todayTask.dueAt}`
              : undefined,
        }),
      });

      const data = (await response.json()) as { ok: boolean } | ApiError;

      if (!response.ok || !("ok" in data)) {
        throw new Error(getApiErrorMessage(data, "Failed to update check-in"));
      }

      await loadDashboardForUser(activeUserId);
      setError(null);
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setActionPending(null);
    }
  }

  async function submitRecovery(action: "accept" | "snooze") {
    if (!activeUserId) {
      return;
    }

    setActionPending(action);

    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: activeUserId,
          action,
        }),
      });

      const data = (await response.json()) as { ok: boolean } | ApiError;

      if (!response.ok || !("ok" in data)) {
        throw new Error(
          getApiErrorMessage(data, "Failed to apply recovery action"),
        );
      }

      await loadDashboardForUser(activeUserId);
      setError(null);
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setActionPending(null);
    }
  }

  return (
    <main className="grain relative min-h-screen overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="panel sticky top-4 z-30 rounded-full px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-base font-bold text-white">
                p.
              </div>
              <p className="text-lg font-semibold tracking-[-0.04em]">pain.exe</p>
            </div>

            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-black text-white hover:text-white"
                        : "bg-white/65 text-[color:var(--muted)] hover:bg-white hover:text-black"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        {error ? (
          <section className="mt-6 rounded-[1.75rem] border border-[color:var(--danger)] bg-[#fff0ec] p-4 text-sm text-[color:var(--danger)]">
            <p className="font-semibold">Backend integration issue</p>
            <p className="mt-1 leading-6">{error}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em]">
              Check that the backend is running and `MONGODB_URI` is configured.
            </p>
          </section>
        ) : null}

        {page === "create-plan" ? (
          <section className="pb-6 pt-8">
            <OnboardingWizard onFinish={handlePlanCreated} />
          </section>
        ) : null}

        {page === "plans" ? (
          <section className="grid gap-6 pb-6 pt-8 xl:grid-cols-[0.95fr_1.05fr]">
            <PlansListPanel
              plans={plans}
              selectedPlanId={selectedPlanId}
              actionPending={actionPending}
              onSelectPlan={handleSelectPlan}
            />
            <PlanDetailsPanel selectedPlan={selectedPlan} />
          </section>
        ) : null}

        {page === "today" ? (
          <section className="grid gap-6 pb-6 pt-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <TodayMissionPanel
                dashboard={dashboard}
                selectedPlan={selectedPlan}
                complianceScore={complianceScore}
                countdown={countdown}
                actionPending={actionPending}
                onDone={submitCheckin}
                onRecovery={submitRecovery}
              />
            </div>

            <div className="grid gap-6">
              <ActionItemsPanel dashboard={dashboard} />
              <EscalationTimelinePanel timeline={escalationTimeline} />
            </div>
          </section>
        ) : null}

        {page === "integrations" ? (
          <section className="grid gap-6 pb-6 pt-8 lg:grid-cols-[0.9fr_1.1fr]">
            <IntegrationStatusPanel
              integrations={integrations}
              selectedPlan={selectedPlan}
              calendarConnected={calendarConnected}
              setCalendarConnected={setCalendarConnected}
            />
            <GarminPanel
              garminDemo={garminDemo}
              garminStatus={garminStatus}
              garminPending={garminPending}
              garminResult={garminResult}
              dashboard={dashboard}
              activeUserId={activeUserId}
              onRunScenario={runGarminScenario}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function PlansListPanel({
  plans,
  selectedPlanId,
  actionPending,
  onSelectPlan,
}: {
  plans: PlanRecord[];
  selectedPlanId: string | null;
  actionPending: string | null;
  onSelectPlan: (plan: PlanRecord) => Promise<void>;
}) {
  return (
    <section className="panel rounded-[2rem] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label text-[color:var(--signal)]">Saved plans</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            Every configuration in one place
          </h2>
        </div>
        <span className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
          {plans.length} total
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => void onSelectPlan(plan)}
            className={`rounded-[1.5rem] border p-4 text-left transition ${
              selectedPlanId === plan.id
                ? "border-black bg-black text-white"
                : "border-[color:var(--line)] bg-white/70 hover:border-black/30"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{plan.title}</p>
                <p className="mt-1 text-sm opacity-80">
                  {plan.goalType} / target {plan.targetDate}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                  selectedPlanId === plan.id
                    ? "bg-white/14 text-white"
                    : plan.status === "Completed"
                      ? "bg-[#d9f3e5] text-[color:var(--success)]"
                      : plan.status === "Adjustment Needed"
                        ? "bg-[#ffe2d7] text-[color:var(--danger)]"
                        : "bg-[#efe2cf] text-[color:var(--warning)]"
                }`}
              >
                {plan.status}
              </span>
            </div>
          </button>
        ))}
      </div>

      {actionPending === "loading-plan" ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">Loading plan dashboard...</p>
      ) : null}
    </section>
  );
}

function PlanDetailsPanel({ selectedPlan }: { selectedPlan: PlanRecord | null }) {
  if (!selectedPlan) {
    return (
      <section className="panel rounded-[2rem] p-6">
        <p className="text-sm text-[color:var(--muted)]">Select a plan to inspect its settings.</p>
      </section>
    );
  }

  return (
    <section className="panel rounded-[2rem] p-6 sm:p-7">
      <p className="label text-[color:var(--signal)]">Selected plan</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
        {selectedPlan.title}
      </h2>
      <p className="mt-3 max-w-3xl text-base leading-7 text-[color:var(--muted)]">
        {selectedPlan.summary}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <DetailCard label="Goal" value={selectedPlan.goalType} />
        <DetailCard label="Target date" value={selectedPlan.targetDate} />
        <DetailCard label="Phone" value={selectedPlan.phoneNumber} />
        <DetailCard label="Calendar" value={selectedPlan.googleCalendarEmail} />
        <DetailCard label="Availability" value={selectedPlan.weeklyAvailability} />
        <DetailCard label="Wake window" value={selectedPlan.wakeWindow} />
        <DetailCard label="Baseline" value={selectedPlan.baseline} />
        <DetailCard label="Injury limits" value={selectedPlan.injuryLimit} />
        <DetailCard label="Escalation" value={selectedPlan.escalationTolerance} />
        <DetailCard label="Channels" value={selectedPlan.channels.join(", ")} />
        <DetailCard label="Trigger" value={selectedPlan.trigger} />
        <DetailCard label="Next mission" value={selectedPlan.nextMission} />
      </div>
    </section>
  );
}

function TodayMissionPanel({
  dashboard,
  selectedPlan,
  complianceScore,
  countdown,
  actionPending,
  onDone,
  onRecovery,
}: {
  dashboard: DashboardPayload | null;
  selectedPlan: PlanRecord | null;
  complianceScore: number;
  countdown: string;
  actionPending: string | null;
  onDone: (status: "done" | "missed") => Promise<void>;
  onRecovery: (action: "accept" | "snooze") => Promise<void>;
}) {
  const taskStatus = dashboard?.todayTask.status ?? "pending";

  return (
    <section className="panel rounded-[2rem] p-6 sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="label text-[color:var(--signal)]">Today&apos;s mission</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
            {dashboard?.todayTask.title ?? "No mission loaded"}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
            {selectedPlan?.nextMission ??
              "Select a saved plan or create one to personalize the daily view."}
          </p>
        </div>

        <div className="metric-ring flex h-36 w-36 items-center justify-center rounded-full">
          <div className="flex h-26 w-26 flex-col items-center justify-center rounded-full bg-[#fff7ea] text-center shadow-inner">
            <span className="text-3xl font-semibold tracking-[-0.06em]">
              {complianceScore}%
            </span>
            <span className="label text-[color:var(--muted)]">Compliance</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Countdown"
          value={countdown}
          detail={
            dashboard
              ? `Due ${new Date(dashboard.todayTask.dueAt).toLocaleString()}`
              : "Waiting for backend dashboard"
          }
        />
        <MetricCard
          label="Task status"
          value={taskStatus}
          detail="This is the live state of today's assignment."
        />
        <MetricCard
          label="Debt"
          value={dashboard ? `${dashboard.debtCount}` : "--"}
          detail="Unresolved misses the coach still wants cleared."
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <div className="rounded-[1.75rem] border border-[color:var(--line)] bg-white/68 p-5">
          <p className="label text-[color:var(--muted)]">Action items</p>
          <div className="mt-4 grid gap-3">
            <ActionRow
              title={dashboard?.todayTask.title ?? "Today's assignment"}
              detail={countdown}
              status={dashboard?.todayTask.status ?? "pending"}
            />
            <ActionRow
              title={dashboard?.recoveryAction?.title ?? "Recovery path"}
              detail={
                dashboard?.recoveryAction?.description ??
                "No recovery path is active right now."
              }
              status={dashboard?.recoveryAction ? "active" : "idle"}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void onDone("done")}
              disabled={!dashboard || actionPending !== null}
              className="rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
            >
              {actionPending === "done" ? "Saving..." : "Mark done"}
            </button>
            <button
              type="button"
              onClick={() => void onDone("missed")}
              disabled={!dashboard || actionPending !== null}
              className="rounded-full border border-[color:var(--danger)] px-5 py-3 font-medium text-[color:var(--danger)] disabled:opacity-50"
            >
              {actionPending === "missed" ? "Logging..." : "Mark missed"}
            </button>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[color:var(--line)] bg-[#15110d] p-5 text-[#f8f1e5]">
          <p className="label text-[#ffb48f]">Recovery action</p>
          <p className="mt-3 text-base leading-7">
            {dashboard?.recoveryAction?.description ??
              "No recovery action is currently active."}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void onRecovery("accept")}
              disabled={!dashboard?.recoveryAction || actionPending !== null}
              className="rounded-full bg-[#f8f1e5] px-5 py-3 font-medium text-black disabled:opacity-50"
            >
              {actionPending === "accept" ? "Applying..." : "Accept recovery"}
            </button>
            <button
              type="button"
              onClick={() => void onRecovery("snooze")}
              disabled={!dashboard?.recoveryAction || actionPending !== null}
              className="rounded-full border border-white/20 px-5 py-3 font-medium text-[#f8f1e5] disabled:opacity-50"
            >
              {actionPending === "snooze" ? "Saving..." : "Snooze"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionItemsPanel({ dashboard }: { dashboard: DashboardPayload | null }) {
  const items = [
    {
      title: "Today's mission",
      detail: dashboard?.todayTask.title ?? "Load a plan to see today's assignment.",
      status: dashboard?.todayTask.status ?? "pending",
    },
    {
      title: "Escalation pressure",
      detail: dashboard
        ? `Level ${dashboard.escalation.stage} with ${dashboard.debtCount} unresolved debt`
        : "Awaiting dashboard sync.",
      status: dashboard ? `level-${dashboard.escalation.stage}` : "idle",
    },
    {
      title: "Recovery path",
      detail:
        dashboard?.recoveryAction?.description ??
        "No active recovery task right now.",
      status: dashboard?.recoveryAction ? "active" : "idle",
    },
  ];

  return (
    <section className="panel rounded-[2rem] p-6">
      <p className="label text-[color:var(--muted)]">Daily status</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
        What the user should work on now
      </h3>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <ActionRow
            key={item.title}
            title={item.title}
            detail={item.detail}
            status={item.status}
          />
        ))}
      </div>
    </section>
  );
}

function EscalationTimelinePanel({
  timeline,
}: {
  timeline: ReturnType<typeof mapEscalationTimeline>;
}) {
  return (
    <section className="panel rounded-[2rem] p-6">
      <p className="label text-[color:var(--muted)]">Escalation timeline</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
        Deterministic pressure ladder
      </h3>
      <div className="mt-5 grid gap-3">
        {timeline.map((stage) => (
          <div
            key={stage.id}
            className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/68 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
                  {stage.id}
                </div>
                <div>
                  <p className="font-semibold">{stage.title}</p>
                  <p className="text-sm text-[color:var(--muted)]">{stage.channel}</p>
                </div>
              </div>
              <StatusPill status={stage.status} />
            </div>
            <p className="mt-3 text-sm font-medium">{stage.scheduledFor}</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {stage.note}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function IntegrationStatusPanel({
  integrations,
  selectedPlan,
  calendarConnected,
  setCalendarConnected,
}: {
  integrations: IntegrationStatus[];
  selectedPlan: PlanRecord | null;
  calendarConnected: boolean;
  setCalendarConnected: (value: boolean) => void;
}) {
  const phoneState = selectedPlan?.phoneNumber ? "Configured" : "Needs input";
  const connectionCards = [
    ...integrations,
    {
      name: "SMS number",
      state: phoneState,
      detail: selectedPlan?.phoneNumber
        ? `Messages and calls route to ${selectedPlan.phoneNumber} in the demo setup.`
        : "Create a plan to attach an SMS number for the demo story.",
    },
  ];

  return (
    <section className="panel rounded-[2rem] p-6 sm:p-7">
      <p className="label text-[color:var(--signal)]">Connected systems</p>
      <div className="mt-6 grid gap-4">
        {connectionCards.map((item) => (
          <div
            key={item.name}
            className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/70 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold tracking-[-0.04em]">{item.name}</h3>
              <StateBadge state={item.state} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              {item.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-[color:var(--line)] bg-[#15110d] p-5 text-[#f8f1e5]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label text-[#ffb48f]">Google Calendar</p>
            <p className="mt-2 text-sm leading-6 text-[#dcc8bd]">
              Keep the calendar interaction available, but tucked into its own page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCalendarConnected(true)}
            className="rounded-full bg-[#f8f1e5] px-5 py-3 font-medium text-black"
          >
            {calendarConnected ? "Connected" : "Connect"}
          </button>
        </div>

        <p className="mt-4 text-sm leading-6">
          Calendar target:{" "}
          <span className="font-semibold">
            {selectedPlan?.googleCalendarEmail ?? "Not provided yet"}
          </span>
        </p>
      </div>
    </section>
  );
}

function GarminPanel({
  garminDemo,
  garminStatus,
  garminPending,
  garminResult,
  dashboard,
  activeUserId,
  onRunScenario,
}: {
  garminDemo: GarminDemoResponse | null;
  garminStatus: DashboardPayload["integrations"] extends infer T
    ? T extends { garmin?: infer G }
      ? G
      : never
    : never;
  garminPending: string | null;
  garminResult: GarminSyncResponse | null;
  dashboard: DashboardPayload | null;
  activeUserId: string | null;
  onRunScenario: (scenario: GarminDemoScenario) => Promise<void>;
}) {
  return (
    <section className="panel rounded-[2rem] p-6 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="label text-[color:var(--signal)]">Garmin demo simulator</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            Believable watch metrics without real credentials
          </h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            {garminDemo?.note ??
              "Load Garmin-style steps, sleep, stress, and activity summaries from seeded data."}
          </p>
        </div>

        <div className="rounded-[1.25rem] bg-[#15110d] px-4 py-3 text-sm text-[#f8f1e5]">
          <p className="label text-[#ffb48f]">Backend status</p>
          <p className="mt-2 font-semibold">
            {garminStatus
              ? `${garminStatus.status} / ${garminStatus.strikeCount} strike${garminStatus.strikeCount === 1 ? "" : "s"}`
              : "Not synced yet"}
          </p>
          <p className="mt-1 text-xs text-[#dcc8bd]">
            {garminStatus?.lastSyncAt
              ? `Last sync ${new Date(garminStatus.lastSyncAt).toLocaleString()}`
              : "Run a scenario to populate Garmin state."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Steps"
          value={garminDemo ? garminDemo.dailySnapshot.steps.toLocaleString() : "--"}
          detail="Daily movement total"
        />
        <MetricCard
          label="Body battery"
          value={garminDemo ? `${garminDemo.dailySnapshot.bodyBattery}` : "--"}
          detail="Recovery-style energy signal"
        />
        <MetricCard
          label="Stress"
          value={garminDemo ? `${garminDemo.dailySnapshot.averageStress}` : "--"}
          detail="Average stress score"
        />
        <MetricCard
          label="Expected"
          value={dashboard?.todayTask.title ?? "--"}
          detail="Current workout expectation from the plan."
        />
      </div>

      <div className="mt-5 grid gap-3">
        {garminDemo?.scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="rounded-[1.25rem] border border-[color:var(--line)] bg-white p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{scenario.label}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                      scenario.expectedOutcome === "match"
                        ? "bg-[#d9f3e5] text-[color:var(--success)]"
                        : "bg-[#ffe2d7] text-[color:var(--danger)]"
                    }`}
                  >
                    {scenario.expectedOutcome}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {scenario.summary}
                </p>
                <p className="mt-3 text-sm leading-6">
                  <span className="font-semibold">Judge story:</span>{" "}
                  {scenario.coachExpectation}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void onRunScenario(scenario)}
                disabled={!activeUserId || garminPending !== null}
                className="rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
              >
                {garminPending === scenario.id ? "Syncing..." : "Run scenario"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {garminResult ? (
        <div className="mt-4 rounded-[1.25rem] border border-[color:var(--line)] bg-[#15110d] p-4 text-[#f8f1e5]">
          <p className="label text-[#ffb48f]">Latest Garmin sync result</p>
          <p className="mt-3 text-sm leading-6">{garminResult.feedback}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#dcc8bd]">
            Stage {garminResult.stage} / debt {garminResult.debtCount} /{" "}
            {garminResult.matched
              ? "matched"
              : garminResult.strikeApplied
                ? "strike applied"
                : "no extra strike"}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/68 p-5">
      <p className="label text-[color:var(--muted)]">{label}</p>
      <p
        className={`mt-3 break-words font-semibold tracking-[-0.05em] ${
          value.length > 28
            ? "text-lg sm:text-xl"
            : value.length > 18
              ? "text-2xl"
              : "text-3xl"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{detail}</p>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/72 p-4">
      <p className="label text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-sm leading-6">{value}</p>
    </div>
  );
}

function ActionRow({
  title,
  detail,
  status,
}: {
  title: string;
  detail: string;
  status: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/72 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <StatusPill status={status} />
      </div>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{detail}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className = normalized.includes("done") || normalized.includes("completed")
    ? "bg-[#d9f3e5] text-[color:var(--success)]"
    : normalized.includes("missed") ||
        normalized.includes("active") ||
        normalized.includes("strike") ||
        normalized.includes("level")
      ? "bg-[#ffe2d7] text-[color:var(--danger)]"
      : "bg-[#efe2cf] text-[color:var(--warning)]";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {status}
    </span>
  );
}

function StateBadge({ state }: { state: string }) {
  const normalized = state.toLowerCase();
  const className = normalized.includes("integrated") ||
    normalized.includes("configured")
    ? "bg-[#d9f3e5] text-[color:var(--success)]"
    : normalized.includes("ready")
      ? "bg-[#efe2cf] text-[color:var(--warning)]"
      : "bg-[#ffe2d7] text-[color:var(--danger)]";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {state}
    </span>
  );
}

function readStoredPlans() {
  try {
    const raw = window.localStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PlanRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readSelectedPlanId() {
  try {
    return window.localStorage.getItem(SELECTED_PLAN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistPlans(plans: PlanRecord[]) {
  try {
    const localPlans = plans.filter((plan) => plan.goalType !== "Seeded Demo");
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(localPlans));
  } catch {
    // Ignore storage failures in demo mode.
  }
}

function persistSelectedPlanId(planId: string) {
  try {
    window.localStorage.setItem(SELECTED_PLAN_STORAGE_KEY, planId);
  } catch {
    // Ignore storage failures in demo mode.
  }
}

function mergePlans(demoPlan?: PlanRecord, plans: PlanRecord[] = []) {
  const unique = new Map<string, PlanRecord>();

  if (demoPlan) {
    unique.set(demoPlan.id, demoPlan);
  }

  for (const plan of plans) {
    unique.set(plan.id, plan);
  }

  return Array.from(unique.values()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function getApiErrorMessage(
  value:
    | DemoApiResponse
    | DashboardPayload
    | GarminDemoResponse
    | GarminSyncResponse
    | ApiError
    | { ok: boolean }
    | { role: string; content: string },
  fallback: string,
) {
  if ("error" in value && typeof value.error === "string" && value.error) {
    return value.error;
  }

  return fallback;
}
