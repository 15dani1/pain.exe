"use client";

import { useMemo, useState } from "react";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import {
  backendStubs,
  createPlanRecord,
  demoMessages,
  demoSummary,
  escalationStages,
  integrationStatuses,
  seededPlans,
  type OnboardingPayload,
  type OnboardingResult,
  type PlanRecord,
} from "@/lib/demo-data";

const navItems = [
  { href: "#onboarding", label: "Create Plan" },
  { href: "#plans", label: "My Plans" },
  { href: "#command-center", label: "Today" },
  { href: "#integration-seams", label: "Stubs" },
];

export function HomePage() {
  const [plans, setPlans] = useState<PlanRecord[]>(seededPlans);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(seededPlans[0].id);

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;

  const countdown = useMemo(() => {
    const now = new Date("2026-03-28T07:34:00-04:00").getTime();
    const due = new Date(demoSummary.dueAt).getTime();
    const diff = Math.max(now - due, 0);
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    return `${hours}h ${minutes}m overdue`;
  }, []);

  function handlePlanCreated(
    payload: OnboardingPayload,
    result: OnboardingResult,
  ) {
    const nextPlan = createPlanRecord(payload, result);

    setPlans((current) => [nextPlan, ...current]);
    setSelectedPlanId(nextPlan.id);
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

        <section className="grid gap-6 pb-6 pt-8 xl:grid-cols-[1.18fr_0.82fr]">
          <OnboardingWizard onFinish={handlePlanCreated} />

          <section
            id="plans"
            className="panel rounded-[2rem] p-5 sm:p-6"
          >
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
                  onClick={() => setSelectedPlanId(plan.id)}
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
                  <SettingsCard
                    label="Target date"
                    value={selectedPlan.targetDate}
                  />
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
                  {demoSummary.activeMission}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
                  {selectedPlan?.nextMission ??
                    "Create a plan above to populate your next mission preview."}
                </p>
              </div>

              <div className="metric-ring flex h-36 w-36 items-center justify-center rounded-full">
                <div className="flex h-26 w-26 flex-col items-center justify-center rounded-full bg-[#fff7ea] text-center shadow-inner">
                  <span className="text-3xl font-semibold tracking-[-0.06em]">
                    {demoSummary.completionRate}%
                  </span>
                  <span className="label text-[color:var(--muted)]">Compliance</span>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Countdown"
                value={countdown}
                detail="Workout window already closed"
              />
              <MetricCard
                label="Streak"
                value={`${demoSummary.streakDays} days`}
                detail="Broken if no resolution lands today"
              />
              <MetricCard
                label="Missed debt"
                value={`${demoSummary.debtHours} hrs`}
                detail="Stacking pressure across the day"
              />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[1.75rem] border border-[color:var(--line)] bg-white/68 p-5">
                <p className="label text-[color:var(--muted)]">Recovery action</p>
                <p className="mt-3 text-base leading-7">{demoSummary.redemption}</p>
              </div>

              <div className="rounded-[1.75rem] border border-[color:var(--line)] bg-[#15110d] p-5 text-[#f8f1e5]">
                <p className="label text-[#ffb48f]">Agent memory</p>
                <ul className="mt-4 grid gap-4 text-sm leading-7 text-[#dbc7ba]">
                  <li>Unread morning prompts increase escalation intensity.</li>
                  <li>Back-to-back hard impact sessions are blocked.</li>
                  <li>Calls remain disabled during the sleep window.</li>
                </ul>
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
                {escalationStages.map((stage) => (
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
              <p className="label text-[color:var(--muted)]">Message loop</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Recent interventions
              </h3>
              <div className="mt-5 grid gap-3">
                {demoMessages.map((message) => (
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
            </div>

            <div className="panel rounded-[2rem] p-6">
              <p className="label text-[color:var(--muted)]">Integration status</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Ready for backend wiring
              </h3>
              <div className="mt-5 grid gap-3">
                {integrationStatuses.map((integration) => (
                  <div
                    key={integration.name}
                    className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/68 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{integration.name}</p>
                      <span className="rounded-full bg-[#efe2cf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                        {integration.state}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {integration.detail}
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
                Stubbed surfaces waiting for real services
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
            {backendStubs.map((stub) => (
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
