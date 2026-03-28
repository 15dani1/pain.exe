"use client";

import { startTransition, useMemo, useState } from "react";
import {
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
] as const;

type StepKey = (typeof steps)[number];

type Props = {
  onFinish: (payload: OnboardingPayload, result: OnboardingResult) => void;
};

export function OnboardingWizard({ onFinish }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [form, setForm] = useState<OnboardingPayload>(onboardingDefaults);

  const progress = useMemo(
    () => Math.round(((stepIndex + 1) / steps.length) * 100),
    [stepIndex],
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

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as OnboardingResult;

      startTransition(() => {
        setResult(data);
        onFinish(form, data);
      });
    } finally {
      setSubmitting(false);
    }
  }

  const currentStep: StepKey = steps[stepIndex];

  return (
    <section
      id="onboarding"
      className="panel grain relative overflow-hidden rounded-[2rem] p-5 text-sm text-[color:var(--foreground)] sm:p-6"
    >
      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="label text-[color:var(--signal)]">Create a new plan</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
              Start here
            </h2>
            <p className="mt-2 max-w-xl text-base leading-7 text-[color:var(--muted)]">
              Fill in the essentials, review your settings, and generate a new
              training plan stub.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-[color:var(--line-strong)] bg-white/70 px-4 py-3">
            <p className="label text-[color:var(--muted)]">Step {stepIndex + 1}</p>
            <p className="mt-1 text-lg font-semibold">{currentStep}</p>
            <div className="mt-3 h-2 w-40 rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-[color:var(--signal)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {steps.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setStepIndex(index)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                index === stepIndex
                  ? "border-black bg-black text-white"
                  : "border-[color:var(--line)] bg-white/60 hover:border-black/30"
              }`}
            >
              <p className="label">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-base font-semibold">{step}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[1.75rem] border border-[color:var(--line)] bg-white/72 p-5 sm:p-6">
            {currentStep === "Mission" ? (
              <div className="grid gap-4">
                <Field label="Name">
                  <input
                    value={form.fullName}
                    onChange={(event) => update("fullName", event.target.value)}
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

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                disabled={stepIndex === 0}
                className="rounded-full border border-[color:var(--line-strong)] px-5 py-3 font-medium disabled:opacity-40"
              >
                Back
              </button>

              {stepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setStepIndex((value) => Math.min(steps.length - 1, value + 1))
                  }
                  className="rounded-full bg-black px-6 py-3 font-medium text-white"
                >
                  Next step
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-full bg-[color:var(--signal)] px-6 py-3 font-medium text-white disabled:opacity-60"
                >
                  {submitting ? "Generating..." : "Create plan"}
                </button>
              )}
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-[color:var(--line)] bg-[#1a1714] p-5 text-[#f8f1e5] sm:p-6">
            <p className="label text-[#ffb48f]">Selected settings</p>
            <div className="mt-4 grid gap-3 text-sm">
              <SettingsRow label="Goal" value={form.goalType} />
              <SettingsRow label="Deadline" value={form.targetDate} />
              <SettingsRow
                label="Tolerance"
                value={form.escalationTolerance}
              />
              <SettingsRow label="Channels" value={form.channels.join(", ")} />
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-black/25 p-4">
              <p className="label text-[#ffb48f]">Submission payload</p>
              <pre className="mt-3 overflow-x-auto text-xs leading-6 text-[#f3ddcf]">
                {JSON.stringify(form, null, 2)}
              </pre>
            </div>

            {result ? (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/8 p-4">
                <p className="label text-[#ffb48f]">Created</p>
                <p className="mt-3 font-semibold">{result.nextMission}</p>
                <p className="mt-3 text-sm leading-6 text-[#d8c3b6]">
                  {result.summary}
                </p>
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
    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2">
      <p className="label text-[#c7afa1]">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
