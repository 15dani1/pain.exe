"use client";

import { useEffect, useMemo, useState } from "react";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import {
  createPlanRecord,
  getTrainingPlanPreview,
  mapDashboardMessages,
  mapEscalationTimeline,
  type BackendStub,
  type DashboardPayload,
  type DemoApiResponse,
  type OnboardingPayload,
  type OnboardingResult,
  type PlanRecord,
} from "@/lib/demo-data";

const navItems = [
  { href: "#onboarding", label: "Create Plan" },
  { href: "#plans", label: "My Plans" },
  { href: "#command-center", label: "Today" },
  { href: "#integration-seams", label: "Integration" },
];

const STORAGE_KEY = "painexe.created-plans";

type ApiError = {
  error?: string;
  code?: string;
  detail?: string;
};

type VoicePreviewResponse = {
  mimeType: string;
  audioBase64: string;
};

export function HomePage() {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [backendEdges, setBackendEdges] = useState<BackendStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [voicePending, setVoicePending] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;

  const trainingPreview = useMemo(
    () => getTrainingPlanPreview(selectedPlan?.goalType ?? "Seeded Demo"),
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
    if (plans.length === 0) {
      return;
    }

    const localPlans = plans.filter((plan) => plan.goalType !== "Seeded Demo");
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localPlans));
  }, [plans]);

  useEffect(() => {
    return () => {
      if (voiceUrl) {
        URL.revokeObjectURL(voiceUrl);
      }
    };
  }, [voiceUrl]);

  const messages = useMemo(
    () => (dashboard ? mapDashboardMessages(dashboard.recentMessages) : []),
    [dashboard],
  );

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

    if (diff >= 0) {
      return `${value} left`;
    }

    return `${value} overdue`;
  }, [dashboard, now]);

  async function bootstrap() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/demo");
      const data = (await response.json()) as DemoApiResponse | ApiError;

      if (!response.ok || !("ok" in data)) {
        throw new Error(getApiErrorMessage(data, "Failed to load demo state"));
      }

      const localPlans = readStoredPlans();
      const mergedPlans = mergePlans(data.demoPlan, localPlans);

      setPlans(mergedPlans);
      setSelectedPlanId((current) => current ?? data.demoPlan.id);
      setActiveUserId(data.userId);
      setDashboard(data.dashboard);
      setBackendEdges(data.backendStubs);
      setCalendarConnected(Boolean(data.demoPlan.googleCalendarEmail));
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setLoading(false);
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
    setCalendarConnected(Boolean(plan.googleCalendarEmail));

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

    setPlans((current) => mergePlans(undefined, [nextPlan, ...current]));
    setSelectedPlanId(nextPlan.id);
    setCalendarConnected(Boolean(nextPlan.googleCalendarEmail));

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

  async function sendChatMessage() {
    if (!activeUserId || !chatInput.trim()) {
      return;
    }

    setChatPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: activeUserId,
          message: chatInput,
        }),
      });

      const data = (await response.json()) as
        | { role: string; content: string }
        | ApiError;

      if (!response.ok || !("role" in data)) {
        throw new Error(getApiErrorMessage(data, "Failed to send message"));
      }

      setChatInput("");
      await loadDashboardForUser(activeUserId);
      setError(null);
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setChatPending(false);
    }
  }

  async function generateVoicePreview() {
    const text =
      messages[0]?.text ??
      dashboard?.recoveryAction?.description ??
      "You said you wanted discipline. The next action is simple. Move now.";

    setVoicePending(true);
    setVoiceError(null);

    try {
      const response = await fetch("/api/voice-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data = (await response.json()) as VoicePreviewResponse | ApiError;

      if (!response.ok || !("audioBase64" in data)) {
        throw new Error(
          getApiErrorMessage(data, "Failed to generate voice preview"),
        );
      }

      if (voiceUrl) {
        URL.revokeObjectURL(voiceUrl);
      }

      const blob = base64ToBlob(data.audioBase64, data.mimeType);
      const url = URL.createObjectURL(blob);
      setVoiceUrl(url);
    } catch (caughtError) {
      setVoiceError(String(caughtError));
    } finally {
      setVoicePending(false);
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-lg font-bold text-white">
                p.
              </div>
              <div>
                <p className="label text-[color:var(--signal)]">Trainee console</p>
                <p className="text-lg font-semibold tracking-[-0.04em]">pain.exe</p>
              </div>
            </div>

            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-[color:var(--line)] bg-white/55 px-4 py-2 text-sm font-medium transition hover:border-black/30 hover:bg-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        {error ? (
          <section className="mt-6 rounded-[1.75rem] border border-[color:var(--danger)] bg-[#fff0ec] p-4 text-sm text-[color:var(--danger)]">
            <p className="font-semibold">Backend integration issue</p>
            <p className="mt-1 leading-6">{error}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em]">
              Check that Rahul&apos;s backend is running and `MONGODB_URI` is configured.
            </p>
          </section>
        ) : null}

        <section className="grid gap-6 pb-6 pt-8 xl:grid-cols-[1.18fr_0.82fr]">
          <OnboardingWizard onFinish={handlePlanCreated} />

          <section id="plans" className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label text-[color:var(--signal)]">My plans</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                  Created plans and saved settings
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
                  onClick={() => void handleSelectPlan(plan)}
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

            {selectedPlan ? (
              <div className="mt-6 rounded-[1.75rem] border border-[color:var(--line)] bg-[#15110d] p-5 text-[#f8f1e5]">
                <p className="label text-[#ffb48f]">Selected plan details</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {selectedPlan.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#dbc7ba]">
                  {selectedPlan.summary}
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <SettingsCard label="Goal" value={selectedPlan.goalType} />
                  <SettingsCard label="Target date" value={selectedPlan.targetDate} />
                  <SettingsCard label="Phone" value={selectedPlan.phoneNumber} />
                  <SettingsCard label="Calendar" value={selectedPlan.googleCalendarEmail} />
                  <SettingsCard
                    label="Availability"
                    value={selectedPlan.weeklyAvailability}
                  />
                  <SettingsCard
                    label="Wake and sleep"
                    value={selectedPlan.wakeWindow}
                  />
                  <SettingsCard
                    label="Escalation"
                    value={selectedPlan.escalationTolerance}
                  />
                  <SettingsCard
                    label="Channels"
                    value={selectedPlan.channels.join(", ")}
                  />
                  <SettingsCard
                    label="Injury limits"
                    value={selectedPlan.injuryLimit}
                  />
                  <SettingsCard
                    label="Motivational trigger"
                    value={selectedPlan.trigger}
                  />
                </div>

                <div className="mt-5 rounded-[1.5rem] bg-white/7 p-4">
                  <p className="label text-[#ffb48f]">Next mission</p>
                  <p className="mt-2 text-base leading-7">{selectedPlan.nextMission}</p>
                </div>
              </div>
            ) : null}
          </section>
        </section>

        <section
          id="command-center"
          className="grid gap-6 py-2 lg:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="panel rounded-[2rem] p-6 sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="label text-[color:var(--signal)]">Today&apos;s mission</p>
                <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
                  {dashboard?.todayTask.title ?? (loading ? "Loading..." : "No task loaded")}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
                  {selectedPlan?.nextMission ??
                    "Create a plan above or load the seeded demo user to populate your mission preview."}
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
                label="Stage"
                value={dashboard ? `Level ${dashboard.escalation.stage}` : "--"}
                detail="Live from Rahul's escalation state"
              />
              <MetricCard
                label="Missed debt"
                value={dashboard ? `${dashboard.debtCount}` : "--"}
                detail="Live unresolved workout debt"
              />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[1.75rem] border border-[color:var(--line)] bg-white/68 p-5">
                <p className="label text-[color:var(--muted)]">Task status</p>
                <p className="mt-3 text-base leading-7">
                  {dashboard
                    ? `Current backend status: ${dashboard.todayTask.status}`
                    : "No dashboard loaded yet."}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void submitCheckin("done")}
                    disabled={!dashboard || actionPending !== null}
                    className="rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
                  >
                    {actionPending === "done" ? "Saving..." : "Mark done"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitCheckin("missed")}
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
                    onClick={() => void submitRecovery("accept")}
                    disabled={!dashboard?.recoveryAction || actionPending !== null}
                    className="rounded-full bg-[#f8f1e5] px-5 py-3 font-medium text-black disabled:opacity-50"
                  >
                    {actionPending === "accept" ? "Applying..." : "Accept recovery"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitRecovery("snooze")}
                    disabled={!dashboard?.recoveryAction || actionPending !== null}
                    className="rounded-full border border-white/20 px-5 py-3 font-medium text-[#f8f1e5] disabled:opacity-50"
                  >
                    {actionPending === "snooze" ? "Saving..." : "Snooze"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[1.75rem] border border-[color:var(--line)] bg-white/68 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="label text-[color:var(--signal)]">AI voice preview</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      Demonstrate the ElevenLabs-enabled coach voice directly from the UI.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generateVoicePreview()}
                    disabled={voicePending}
                    className="rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
                  >
                    {voicePending ? "Generating..." : "Play coach voice"}
                  </button>
                </div>

                {voiceUrl ? (
                  <audio className="mt-4 w-full" controls src={voiceUrl}>
                    Your browser does not support audio playback.
                  </audio>
                ) : null}

                {voiceError ? (
                  <p className="mt-4 text-sm leading-6 text-[color:var(--danger)]">
                    {voiceError}
                  </p>
                ) : null}
              </div>

              <div className="rounded-[1.75rem] border border-[color:var(--line)] bg-white/68 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="label text-[color:var(--signal)]">Google Calendar</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      Demo-friendly calendar connection and population preview.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalendarConnected(true)}
                    className="rounded-full bg-black px-5 py-3 font-medium text-white"
                  >
                    {calendarConnected ? "Connected" : "Connect Google Calendar"}
                  </button>
                </div>

                <p className="mt-4 text-sm leading-6">
                  Calendar target:{" "}
                  <span className="font-semibold">
                    {selectedPlan?.googleCalendarEmail ?? "Not provided yet"}
                  </span>
                </p>

                <div className="mt-4 grid gap-3">
                  {trainingPreview.map((item) => (
                    <div
                      key={`${item.day}-${item.title}`}
                      className="rounded-[1.25rem] border border-[color:var(--line)] bg-[#fffaf1] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{item.day}</p>
                        <span className="rounded-full bg-[#efe2cf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                          {calendarConnected ? "Queued" : "Preview"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{item.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="panel rounded-[2rem] p-6">
              <p className="label text-[color:var(--muted)]">Escalation timeline</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Deterministic pressure ladder
              </h3>
              <div className="mt-5 grid gap-3">
                {escalationTimeline.map((stage) => (
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
                          <p className="text-sm text-[color:var(--muted)]">
                            {stage.channel}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          stage.status === "completed"
                            ? "bg-[#d9f3e5] text-[color:var(--success)]"
                            : stage.status === "active"
                              ? "bg-[#ffe2d7] text-[color:var(--danger)]"
                              : "bg-[#efe2cf] text-[color:var(--warning)]"
                        }`}
                      >
                        {stage.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium">{stage.scheduledFor}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {stage.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel rounded-[2rem] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label text-[color:var(--muted)]">Message loop</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                    Live coach thread
                  </h3>
                </div>
                <span className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white">
                  {activeUserId ? "Backend linked" : "Waiting"}
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/72 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      <span>
                        {message.channel} / {message.tone}
                      </span>
                      <span>{message.sentAt}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{message.sender}</p>
                    <p className="mt-2 text-base leading-7">{message.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  rows={3}
                  placeholder="Reply to the coach..."
                  className="w-full rounded-[1.5rem] border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                />
                <button
                  type="button"
                  onClick={() => void sendChatMessage()}
                  disabled={!activeUserId || chatPending || !chatInput.trim()}
                  className="self-end rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
                >
                  {chatPending ? "Sending..." : "Send message"}
                </button>
              </div>
            </div>

            <div className="panel rounded-[2rem] p-6">
              <p className="label text-[color:var(--muted)]">What you&apos;ll get</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Sample training plan blocks
              </h3>
              <div className="mt-5 grid gap-3">
                {trainingPreview.map((item) => (
                  <div
                    key={`${item.day}-${item.title}-sidecar`}
                    className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/68 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{item.day}</p>
                      <span className="rounded-full bg-[#efe2cf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                        Sample
                      </span>
                    </div>
                    <p className="mt-2 text-base font-medium">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {item.detail}
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      <span className="font-semibold">Experience:</span> {item.intent}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="integration-seams"
          className="panel mt-6 rounded-[2rem] p-6 sm:p-8"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="label text-[color:var(--signal)]">Backend seams</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                Live proxy surfaces between frontend and Rahul&apos;s service
              </h2>
            </div>
            <a
              href="/api/demo"
              className="rounded-full border border-[color:var(--line-strong)] px-5 py-3 text-sm font-medium"
              target="_blank"
              rel="noreferrer"
            >
              Inspect /api/demo
            </a>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {backendEdges.map((stub) => (
              <div
                key={stub.surface}
                className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/70 p-5"
              >
                <p className="label text-[color:var(--muted)]">{stub.status}</p>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
                  {stub.surface}
                </h3>
                <p className="mt-2 font-mono text-sm text-[color:var(--signal)]">
                  {stub.endpoint}
                </p>
                <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
                  {stub.note}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
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
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{detail}</p>
    </div>
  );
}

function SettingsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-white/7 p-4">
      <p className="label text-[#c7afa1]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#f8f1e5]">{value}</p>
    </div>
  );
}

function readStoredPlans() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PlanRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
    | ApiError
    | { ok: boolean }
    | { role: string; content: string }
    | VoicePreviewResponse,
  fallback: string,
) {
  if ("error" in value && typeof value.error === "string" && value.error) {
    return value.error;
  }

  return fallback;
}

function base64ToBlob(base64: string, mimeType: string) {
  const bytes = window.atob(base64);
  const array = Uint8Array.from(bytes, (char) => char.charCodeAt(0));
  return new Blob([array], { type: mimeType });
}
