"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { WearableInsightsPanel } from "@/components/wearable-insights";
import {
  createPlanRecord,
  getMonthlyOverview,
  getWeeklyOverview,
  getWorkoutWeekStrip,
  type DashboardPayload,
  type DemoApiResponse,
  type IntegrationStatus,
  type OnboardingPayload,
  type OnboardingResult,
  type PlanRecord,
} from "@/lib/demo-data";
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

type PlanLibraryResponse = {
  ok: true;
  plans: PlanRecord[];
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
  const [callOverlayOpen, setCallOverlayOpen] = useState(false);
  const [callPhase, setCallPhase] = useState<"dialing" | "connected">("dialing");
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);

  const selectedPlan = useMemo(() => {
    if (plans.length === 0) {
      return null;
    }

    return plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;
  }, [plans, selectedPlanId]);

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

  const weeklyOverview = useMemo(
    () => getWeeklyOverview(selectedPlan?.goalType ?? "Seeded Demo"),
    [selectedPlan],
  );
  const monthlyOverview = useMemo(
    () => getMonthlyOverview(selectedPlan?.goalType ?? "Seeded Demo"),
    [selectedPlan],
  );

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

  useEffect(() => {
    if (!callOverlayOpen) {
      setCallPhase("dialing");
      setCallElapsedSeconds(0);
      return;
    }

    const connectTimeout = window.setTimeout(() => {
      setCallPhase("connected");
    }, 1800);

    return () => window.clearTimeout(connectTimeout);
  }, [callOverlayOpen]);

  useEffect(() => {
    if (!callOverlayOpen || callPhase !== "connected") {
      return;
    }

    const interval = window.setInterval(() => {
      setCallElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [callOverlayOpen, callPhase]);

  async function bootstrap() {
    setError(null);

    try {
      const [demoResponse, plansResponse] = await Promise.all([
        fetch("/api/demo"),
        fetch("/api/plans"),
      ]);
      const data = (await demoResponse.json()) as DemoApiResponse | ApiError;
      const plansData = (await plansResponse.json()) as PlanLibraryResponse | ApiError;

      if (!demoResponse.ok || !("ok" in data)) {
        throw new Error(getApiErrorMessage(data, "Failed to load demo state"));
      }
      if (!plansResponse.ok || !("plans" in plansData)) {
        throw new Error(getApiErrorMessage(plansData, "Failed to load plans"));
      }

      const localPlans = readStoredPlans();
      const mergedPlans = mergePlans(data.demoPlan, [
        ...plansData.plans,
        ...localPlans,
      ]);
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

  function openCallOverlay() {
    setCallPhase("dialing");
    setCallElapsedSeconds(0);
    setCallOverlayOpen(true);
  }

  function closeCallOverlay() {
    setCallOverlayOpen(false);
  }

  return (
    <main className="grain relative min-h-screen overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-4 sm:px-5 lg:px-6">
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
          <section className="mt-4 rounded-[1.5rem] border border-[color:var(--danger)] bg-[#fff0ec] p-3 text-sm text-[color:var(--danger)]">
            <p className="font-semibold">Backend integration issue</p>
            <p className="mt-1 leading-5">{error}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em]">
              Check that the backend is running and `MONGODB_URI` is configured.
            </p>
          </section>
        ) : null}

        {page === "create-plan" ? (
          <section className="pb-4 pt-5">
            <OnboardingWizard onFinish={handlePlanCreated} />
          </section>
        ) : null}

        {page === "plans" ? (
          <section className="grid gap-4 pb-4 pt-5 xl:grid-cols-[0.9fr_1.1fr]">
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
          <section className="grid gap-4 pb-4 pt-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <TodayMissionPanel
                dashboard={dashboard}
                selectedPlan={selectedPlan}
                stripClock={now ?? Date.now()}
                countdown={countdown}
                actionPending={actionPending}
                onDone={submitCheckin}
                onRecovery={submitRecovery}
                onCallTrainer={openCallOverlay}
              />
            </div>

            <div className="grid gap-4">
              <ActionItemsPanel dashboard={dashboard} />
              <WeeklyPlanPanel items={weeklyOverview} />
              <MonthlyPlanPanel items={monthlyOverview} />
            </div>
          </section>
        ) : null}

        {page === "integrations" ? (
          <section className="grid gap-4 pb-4 pt-5 lg:grid-cols-[0.9fr_1.1fr]">
            <IntegrationStatusPanel
              integrations={integrations}
              selectedPlan={selectedPlan}
              calendarConnected={calendarConnected}
              setCalendarConnected={setCalendarConnected}
            />
            <WearableInsightsPanel goalType={selectedPlan?.goalType} />
          </section>
        ) : null}
      </div>

      {callOverlayOpen ? (
        <TrainerCallModal
          selectedPlan={selectedPlan}
          phase={callPhase}
          elapsedSeconds={callElapsedSeconds}
          onClose={closeCallOverlay}
        />
      ) : null}
    </main>
  );
}

const PLANS_PAGE_SIZE = 5;

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
  const [listPage, setListPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(plans.length / PLANS_PAGE_SIZE));

  useEffect(() => {
    setListPage((page) => Math.min(page, totalPages - 1));
  }, [totalPages, plans.length]);

  useEffect(() => {
    if (!selectedPlanId || plans.length === 0) {
      return;
    }

    const index = plans.findIndex((plan) => plan.id === selectedPlanId);

    if (index >= 0) {
      setListPage(Math.floor(index / PLANS_PAGE_SIZE));
    }
  }, [selectedPlanId, plans]);

  const pageOffset = listPage * PLANS_PAGE_SIZE;
  const pagePlans = plans.slice(pageOffset, pageOffset + PLANS_PAGE_SIZE);
  const rangeLabel =
    plans.length === 0
      ? "0"
      : `${pageOffset + 1}–${Math.min(pageOffset + PLANS_PAGE_SIZE, plans.length)}`;

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label text-[color:var(--signal)]">Saved plans</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.05em]">
            Plan library
          </h2>
        </div>
        <span className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">
          {plans.length} total
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {pagePlans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => void onSelectPlan(plan)}
            className={`rounded-[1.25rem] border p-3 text-left transition ${
              selectedPlanId === plan.id
                ? "border-black bg-black text-white"
                : "border-[color:var(--line)] bg-white/70 hover:border-black/30"
            }`}
            >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-semibold">{plan.title}</p>
                <p className="mt-1 text-xs opacity-80">
                  {plan.goalType} / {plan.targetDate}
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

      {plans.length > PLANS_PAGE_SIZE ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-4">
          <p className="text-xs text-[color:var(--muted)]">
            Showing {rangeLabel} of {plans.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={listPage <= 0}
              onClick={() => setListPage((p) => Math.max(0, p - 1))}
              className="rounded-full border border-[color:var(--line)] bg-white/80 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs tabular-nums text-[color:var(--muted)]">
              {listPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={listPage >= totalPages - 1}
              onClick={() => setListPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-full border border-[color:var(--line)] bg-white/80 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {actionPending === "loading-plan" ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">Loading plan dashboard...</p>
      ) : null}
    </section>
  );
}

function PlanDetailsPanel({ selectedPlan }: { selectedPlan: PlanRecord | null }) {
      if (!selectedPlan) {
    return (
      <section className="panel rounded-[1.75rem] p-4">
        <p className="text-sm text-[color:var(--muted)]">Select a plan to inspect its settings.</p>
      </section>
    );
  }

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-5">
      <p className="label text-[color:var(--signal)]">Selected plan</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-[-0.05em]">
        {selectedPlan.title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
        {selectedPlan.summary}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
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
        <DetailCard label="Current workout" value={selectedPlan.nextMission} />
      </div>
    </section>
  );
}

function TodayMissionPanel({
  dashboard,
  selectedPlan,
  stripClock,
  countdown,
  actionPending,
  onDone,
  onRecovery,
  onCallTrainer,
}: {
  dashboard: DashboardPayload | null;
  selectedPlan: PlanRecord | null;
  stripClock: number;
  countdown: string;
  actionPending: string | null;
  onDone: (status: "done" | "missed") => Promise<void>;
  onRecovery: (action: "accept" | "snooze") => Promise<void>;
  onCallTrainer: () => void;
}) {
  const taskStatus = dashboard?.todayTask.status ?? "pending";
  const weekStrip = useMemo(
    () =>
      getWorkoutWeekStrip(
        stripClock,
        dashboard?.todayTask.status ?? null,
      ),
    [stripClock, dashboard?.todayTask.status],
  );

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-5">
      <div>
        <p className="label text-[color:var(--signal)]">Today&apos;s workout</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em]">
          {dashboard?.todayTask.title ?? "No mission loaded"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
          {selectedPlan?.nextMission ??
            "Select a saved plan or create one to personalize the daily view."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Countdown" value={countdown} />
        <MetricCard label="Task status" value={taskStatus} />
        <MetricCard
          label="Debt"
          value={dashboard ? `${dashboard.debtCount}` : "--"}
        />
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-[color:var(--line)] bg-white/68 p-3">
        <p className="label text-[color:var(--muted)]">Seven-day check-in</p>
        <div className="mt-3 flex justify-between gap-1 sm:gap-2">
          {weekStrip.map((day) => (
            <div
              key={day.key}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                {day.weekday}
              </span>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-base leading-none"
                aria-label={
                  day.marker === "done"
                    ? `${day.weekday}: completed`
                    : day.marker === "missed"
                      ? `${day.weekday}: missed`
                      : `${day.weekday}: no result yet`
                }
              >
                {day.marker === "done" ? (
                  <span className="text-[color:var(--success)]">✓</span>
                ) : day.marker === "missed" ? (
                  <span className="text-[color:var(--danger)]">✗</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_0.95fr]">
        <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/68 p-4">
          <p className="label text-[color:var(--muted)]">Action items</p>
          <div className="mt-3 grid gap-2">
            <ActionRow
              title={dashboard?.todayTask.title ?? "Today's workout"}
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

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onDone("done")}
              disabled={!dashboard || actionPending !== null}
              className="rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {actionPending === "done" ? "Saving..." : "Mark done"}
            </button>
            <button
              type="button"
              onClick={() => void onDone("missed")}
              disabled={!dashboard || actionPending !== null}
              className="rounded-full border border-[color:var(--danger)] px-4 py-2.5 text-sm font-medium text-[color:var(--danger)] disabled:opacity-50"
            >
              {actionPending === "missed" ? "Logging..." : "Mark missed"}
            </button>
            <button
              type="button"
              onClick={onCallTrainer}
              className="rounded-full border border-black/20 bg-white px-5 py-3 font-medium text-black transition hover:border-black/40 hover:bg-black hover:text-white"
            >
              Call trainer
            </button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-[#15110d] p-4 text-[#f8f1e5]">
          <p className="label text-[#ffb48f]">Recovery action</p>
          <p className="mt-2 text-sm leading-6">
            {dashboard?.recoveryAction?.description ??
              "No recovery action is currently active."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onRecovery("accept")}
              disabled={!dashboard?.recoveryAction || actionPending !== null}
              className="rounded-full bg-[#f8f1e5] px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
            >
              {actionPending === "accept" ? "Applying..." : "Accept recovery"}
            </button>
            <button
              type="button"
              onClick={() => void onRecovery("snooze")}
              disabled={!dashboard?.recoveryAction || actionPending !== null}
              className="rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-[#f8f1e5] disabled:opacity-50"
            >
              {actionPending === "snooze" ? "Saving..." : "Snooze"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrainerCallModal({
  selectedPlan,
  phase,
  elapsedSeconds,
  onClose,
}: {
  selectedPlan: PlanRecord | null;
  phase: "dialing" | "connected";
  elapsedSeconds: number;
  onClose: () => void;
}) {
  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const ss = String(elapsedSeconds % 60).padStart(2, "0");
  const callTime = `${mm}:${ss}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-[2.2rem] bg-[#0e1218] p-4 text-white shadow-2xl ring-1 ring-white/10">
        <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-white/20" />
        <div className="rounded-[1.8rem] border border-white/10 bg-gradient-to-b from-[#121824] to-[#0a0f15] p-6 text-center">
          <p className="label text-[#8fb2ff]">Trainer line</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Coach Goggins</h3>
          <p className="mt-1 text-sm text-white/70">
            {selectedPlan?.phoneNumber ? `Calling ${selectedPlan.phoneNumber}` : "Live demo call"}
          </p>

          <div className="mt-6 flex justify-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[#1b2333]">
              <span
                className={`absolute inset-0 rounded-full ${
                  phase === "dialing" ? "animate-ping bg-[#4a7aff]/30" : "bg-[#3fbf7f]/20"
                }`}
              />
              <div className="relative h-20 w-20 rounded-full bg-[#2d3f64]" />
            </div>
          </div>

          <p className="mt-5 text-sm font-medium tracking-[0.12em] uppercase text-white/70">
            {phase === "dialing" ? "Dialing..." : `Connected • ${callTime}`}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {phase === "dialing"
              ? "Connecting trainer line and preparing voice stream."
              : "Two-way trainer conversation is active for demo preview."}
          </p>

          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[#ff5e5e] px-6 py-3 font-semibold text-white transition hover:bg-[#e54f4f]"
            >
              End call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionItemsPanel({ dashboard }: { dashboard: DashboardPayload | null }) {
  const items = [
    {
      title: "Today's workout",
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
    <section className="panel rounded-[1.75rem] p-4">
      <p className="label text-[color:var(--muted)]">Daily status</p>
      <div className="mt-3 grid gap-2">
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

function WeeklyPlanPanel({
  items,
}: {
  items: ReturnType<typeof getWeeklyOverview>;
}) {
  return (
    <section className="panel rounded-[1.75rem] p-4">
      <p className="label text-[color:var(--muted)]">Next 7 Days</p>
      <div className="mt-3 grid max-h-[11rem] grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={`${item.day}-${item.focus}`}
            className="rounded-lg border border-[color:var(--line)] bg-white/72 p-2"
          >
            <div className="flex items-start justify-between gap-1">
              <p className="text-[11px] font-semibold leading-tight">{item.day}</p>
              <p className="shrink-0 text-[10px] text-[color:var(--muted)]">
                {item.commitment}
              </p>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[color:var(--muted)]">
              {item.focus}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MonthlyPlanPanel({
  items,
}: {
  items: ReturnType<typeof getMonthlyOverview>;
}) {
  return (
    <section className="panel rounded-[1.75rem] p-4">
      <p className="label text-[color:var(--muted)]">Plan Progression</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div
            key={item.month}
            className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-[color:var(--line)] bg-white/72 px-3 py-2.5"
          >
            <p className="text-sm font-semibold">{item.month}</p>
            <p className="text-xs leading-5 text-[color:var(--muted)]">
              {item.focus}
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
    <section className="panel rounded-[1.75rem] p-4 sm:p-5">
      <p className="label text-[color:var(--signal)]">Connected systems</p>
      <div className="mt-4 grid gap-3">
        {connectionCards.map((item) => (
          <div
            key={item.name}
            className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/70 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold tracking-[-0.04em]">{item.name}</h3>
              <StateBadge state={item.state} />
            </div>
            <p className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
              {item.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-[color:var(--line)] bg-[#15110d] p-4 text-[#f8f1e5]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label text-[#ffb48f]">Google Calendar</p>
          </div>
          <button
            type="button"
            onClick={() => setCalendarConnected(true)}
            className="rounded-full bg-[#f8f1e5] px-4 py-2 text-sm font-medium text-black"
          >
            {calendarConnected ? "Connected" : "Connect"}
          </button>
        </div>

        <p className="mt-3 text-xs leading-5">
          Calendar target:{" "}
          <span className="font-semibold">
            {selectedPlan?.googleCalendarEmail ?? "Not provided yet"}
          </span>
        </p>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/68 p-3">
      <p className="label text-[color:var(--muted)]">{label}</p>
      <p
        className={`mt-2 break-words font-semibold tracking-[-0.05em] ${
          value.length > 28
            ? "text-base sm:text-lg"
            : value.length > 18
              ? "text-xl"
              : "text-2xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/72 p-3">
      <p className="label text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-xs leading-5">{value}</p>
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
    <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/72 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <StatusPill status={status} />
      </div>
      <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{detail}</p>
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
    | PlanLibraryResponse
    | DashboardPayload
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
