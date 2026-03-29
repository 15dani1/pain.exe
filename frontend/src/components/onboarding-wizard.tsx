"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import {
  getMonthlyOverview,
  getWeeklyOverview,
  goalOptions,
  onboardingDefaults,
  type OnboardingPayload,
  type OnboardingResult,
} from "@/lib/demo-data";

const steps = [
  "Mission",
  "Baseline",
  "Schedule",
  "Escalation",
  "Preview",
] as const;

type StepKey = (typeof steps)[number];

type Props = {
  onFinish: (payload: OnboardingPayload, result: OnboardingResult) => void;
};

export function OnboardingWizard({ onFinish }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<OnboardingPayload>(onboardingDefaults);

  const progress = useMemo(
    () => Math.round(((stepIndex + 1) / steps.length) * 100),
    [stepIndex],
  );

  const weeklyOverview = useMemo(
    () => getWeeklyOverview(form.goalType),
    [form.goalType],
  );

  const monthlyOverview = useMemo(
    () => getMonthlyOverview(form.goalType),
    [form.goalType],
  );

  function update<K extends keyof OnboardingPayload>(
    key: K,
    value: OnboardingPayload[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(channel: string) {
    const exists = form.channels.includes(channel);
    update(
      "channels",
      exists
        ? form.channels.filter((item) => item !== channel)
        : [...form.channels, channel],
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as
        | OnboardingResult
        | { error?: string; code?: string; detail?: string };

      if (!response.ok || !("userId" in data)) {
        throw new Error(
          "error" in data && typeof data.error === "string" && data.error
            ? data.error
            : "Failed to create plan",
        );
      }

      startTransition(() => {
        setResult(data);
        onFinish(form, data);
      });
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  const currentStep: StepKey = steps[stepIndex];

  return (
    <section
      id="onboarding"
      className="panel grain relative overflow-hidden rounded-[1.75rem] p-4 text-sm text-[color:var(--foreground)] sm:p-5"
    >
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="label text-[color:var(--signal)]">Create a new plan</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
              Build the plan
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[color:var(--muted)]">
              Define the goal, schedule, and outreach style.
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-[color:var(--line-strong)] bg-white/70 px-3 py-2">
            <p className="label text-[color:var(--muted)]">Step {stepIndex + 1}</p>
            <p className="mt-1 text-base font-semibold">{currentStep}</p>
            <div className="mt-2 h-2 w-28 rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-[color:var(--signal)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-5">
          {steps.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setStepIndex(index)}
              className={`rounded-[1.25rem] border px-3 py-2.5 text-left transition ${
                index === stepIndex
                  ? "border-black bg-black text-white"
                  : "border-[color:var(--line)] bg-white/60 hover:border-black/30"
              }`}
            >
              <p className="label">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-1 text-sm font-semibold">{step}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/72 p-4 sm:p-5">
            {currentStep === "Mission" ? (
              <div className="grid gap-4">
                <Field label="Name">
                  <input
                    value={form.fullName}
                    onChange={(event) => update("fullName", event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
                <Field label="Phone number for SMS and call previews">
                  <input
                    value={form.phoneNumber}
                    onChange={(event) => update("phoneNumber", event.target.value)}
                    placeholder="(555) 555-5555"
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
                <Field label="Goal type">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {goalOptions.map((goal) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => update("goalType", goal)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          form.goalType === goal
                            ? "border-black bg-black text-white"
                            : "border-[color:var(--line)] bg-[#fffaf1] hover:border-black/30"
                        }`}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Target date">
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={(event) => update("targetDate", event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
              </div>
            ) : null}

            {currentStep === "Baseline" ? (
              <div className="grid gap-4">
                <Field label="Current baseline">
                  <textarea
                    value={form.baseline}
                    onChange={(event) => update("baseline", event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
                <Field label="Injury or risk limits">
                  <textarea
                    value={form.injuryLimit}
                    onChange={(event) => update("injuryLimit", event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
              </div>
            ) : null}

            {currentStep === "Schedule" ? (
              <div className="grid gap-4">
                <Field label="Weekly availability">
                  <textarea
                    value={form.weeklyAvailability}
                    onChange={(event) =>
                      update("weeklyAvailability", event.target.value)
                    }
                    rows={4}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
                <Field label="Wake and sleep window">
                  <textarea
                    value={form.wakeWindow}
                    onChange={(event) => update("wakeWindow", event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
                <Field label="Google Calendar email">
                  <input
                    value={form.googleCalendarEmail}
                    onChange={(event) =>
                      update("googleCalendarEmail", event.target.value)
                    }
                    placeholder="you@gmail.com"
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
              </div>
            ) : null}

            {currentStep === "Escalation" ? (
              <div className="grid gap-4">
                <Field label="Motivational triggers">
                  <textarea
                    value={form.trigger}
                    onChange={(event) => update("trigger", event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none focus:border-black/50"
                  />
                </Field>
                <Field label="Escalation tolerance">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["Measured", "Relentless", "Unhinged"] as const).map(
                      (level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => update("escalationTolerance", level)}
                          className={`rounded-2xl border px-4 py-3 transition ${
                            form.escalationTolerance === level
                              ? "border-black bg-black text-white"
                              : "border-[color:var(--line)] bg-[#fffaf1] hover:border-black/30"
                          }`}
                        >
                          {level}
                        </button>
                      ),
                    )}
                  </div>
                </Field>
                <Field label="Allowed channels">
                  <div className="flex flex-wrap gap-3">
                    {["In-app", "SMS", "Email", "Call"].map((channel) => {
                      const selected = form.channels.includes(channel);

                      return (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => toggleChannel(channel)}
                          className={`rounded-full border px-4 py-2 transition ${
                            selected
                              ? "border-[color:var(--signal)] bg-[color:var(--signal)] text-white"
                              : "border-[color:var(--line)] bg-white"
                          }`}
                        >
                          {channel}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            ) : null}

            {currentStep === "Preview" ? (
              <div className="grid gap-3">
                <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-[#fffaf1] p-3">
                  <p className="label text-[color:var(--signal)]">What the cadence looks like</p>
                  <p className="mt-2 text-sm leading-6">
                    A typical week, the time commitment, and how the plan evolves over time.
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Next 7 days</p>
                    <span className="rounded-full bg-[#efe2cf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                      Weekly view
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {weeklyOverview.map((item) => (
                      <div
                        key={`${item.day}-${item.focus}`}
                        className="rounded-[1rem] border border-[color:var(--line)] bg-[#fffaf1] p-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--signal)]">
                          {item.day}
                        </p>
                        <p className="mt-1 text-sm font-semibold">{item.focus}</p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                          {item.commitment}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Plan progression</p>
                    <span className="rounded-full bg-[#efe2cf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                      Monthly view
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {monthlyOverview.map((item) => (
                      <div
                        key={item.month}
                        className="flex items-center justify-between gap-3 rounded-[1rem] border border-[color:var(--line)] bg-[#fffaf1] px-3 py-2"
                      >
                        <p className="text-sm font-semibold">{item.month}</p>
                        <p className="text-xs leading-5 text-[color:var(--muted)]">
                          {item.focus}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Your setup</p>
                    <span className="rounded-full bg-[#efe2cf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                      Ready
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <PreviewFact label="Goal" value={form.goalType} />
                    <PreviewFact label="Target" value={form.targetDate} />
                    <PreviewFact label="Availability" value={form.weeklyAvailability} />
                    <PreviewFact label="Channels" value={form.channels.join(", ")} />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                disabled={stepIndex === 0}
                className="rounded-full border border-[color:var(--line-strong)] px-4 py-2.5 text-sm font-medium disabled:opacity-40"
              >
                Back
              </button>

              {stepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setStepIndex((value) => Math.min(steps.length - 1, value + 1))
                  }
                  className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white"
                >
                  Next step
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-full bg-[color:var(--signal)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submitting ? "Generating..." : "Create plan"}
                </button>
              )}
            </div>
          </div>

          <aside className="rounded-[1.5rem] border border-[color:var(--line)] bg-[#1a1714] p-4 text-[#f8f1e5] sm:p-5">
            <p className="label text-[#ffb48f]">Selected settings</p>
            <div className="mt-3 grid gap-2 text-sm">
              <SettingsRow label="Goal" value={form.goalType} />
              <SettingsRow label="Phone" value={form.phoneNumber} />
              <SettingsRow label="Calendar" value={form.googleCalendarEmail} />
              <SettingsRow label="Deadline" value={form.targetDate} />
              <SettingsRow label="Tolerance" value={form.escalationTolerance} />
              <SettingsRow label="Channels" value={form.channels.join(", ")} />
            </div>

            {result ? (
              <div className="mt-4 rounded-[1.25rem] border border-[#ffb48f]/25 bg-[#2a1d15] p-3">
                <p className="label text-[#ffb48f]">Plan created</p>
                <p className="mt-2 text-sm font-semibold">
                  {form.goalType} is now live.
                </p>
                <p className="mt-2 text-xs leading-5 text-[#d8c3b6]">
                  {result.nextMission}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/plans"
                    className="rounded-full bg-[#f8f1e5] px-3 py-2 text-xs font-semibold text-black"
                  >
                    View My Plans
                  </Link>
                  <Link
                    href="/today"
                    className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-[#f8f1e5]"
                  >
                    Go To Today
                  </Link>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-[1.25rem] border border-[#ffb48f]/20 bg-[#44261a] p-3 text-sm text-[#ffd8c7]">
                <p className="font-semibold">Could not create plan</p>
                <p className="mt-2 leading-6">{error}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="label text-[color:var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-white/6 px-3 py-2">
      <p className="label text-[#c7afa1]">{label}</p>
      <p className="mt-1 text-xs font-medium">{value}</p>
    </div>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[color:var(--line)] bg-[#fffaf1] px-3 py-2">
      <p className="label text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-xs leading-5">{value || "--"}</p>
    </div>
  );
}
