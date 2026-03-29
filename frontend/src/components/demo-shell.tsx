"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import gogginsPic from "@/app/assets/goggins_pic.jpg";
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

type CallStartResponse = {
  ok: true;
  sessionId: string;
  userId: string;
  provider: "twilio" | "fallback_in_app";
  status: string;
  callSid?: string;
  to?: string;
  from?: string;
  stage?: number;
  debtCount?: number;
  note?: string;
};

type VoiceSessionStartResponse = {
  ok: true;
  sessionId: string;
  userId: string;
  stage: number;
  debtCount: number;
  greeting: {
    text: string;
    voice: {
      mimeType: string;
      audioBase64: string;
    } | null;
  };
};

type VoiceSessionTurnResponse = {
  ok: true;
  coachReply: string;
  voice: {
    mimeType: string;
    audioBase64: string;
  } | null;
  voiceError?: {
    code?: string;
    error?: string;
    detail?: string;
  };
};

type CallConversationTurn = {
  id: string;
  role: "coach" | "user" | "system";
  text: string;
};

type VoicePlayback = {
  mimeType: string;
  audioBase64: string;
};

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  0?: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  results?: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop?: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type BrowserSpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
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
  const [callStartPending, setCallStartPending] = useState(false);
  const [callSessionNote, setCallSessionNote] = useState<string | null>(null);
  const [callProviderLabel, setCallProviderLabel] = useState<string>("Demo call");
  const [callVoiceSessionId, setCallVoiceSessionId] = useState<string | null>(null);
  const [callConversation, setCallConversation] = useState<CallConversationTurn[]>([]);
  const [callTurnPending, setCallTurnPending] = useState(false);
  const [callCoachSpeaking, setCallCoachSpeaking] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

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
      setCallSessionNote(null);
      setCallProviderLabel("Demo call");
      setCallConversation([]);
      setCallTurnPending(false);
      setCallCoachSpeaking(false);
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

  function stopCoachAudioPlayback() {
    const player = audioPlayerRef.current;
    if (!player) {
      return;
    }

    player.pause();
    player.currentTime = 0;
    player.onended = null;
    player.onerror = null;
    setCallCoachSpeaking(false);
  }

  async function playReturnedVoice(voice: VoicePlayback | null) {
    if (!voice?.audioBase64) {
      setCallCoachSpeaking(false);
      return;
    }

    try {
      const src = `data:${voice.mimeType || "audio/mpeg"};base64,${voice.audioBase64}`;
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
      }
      const player = audioPlayerRef.current;
      stopCoachAudioPlayback();
      player.src = src;
      player.currentTime = 0;
      player.onended = () => {
        setCallCoachSpeaking(false);
      };
      player.onerror = () => {
        setCallCoachSpeaking(false);
      };
      setCallCoachSpeaking(true);
      await player.play();
    } catch {
      setCallCoachSpeaking(false);
      // Browser autoplay can fail if no recent user gesture; transcript still updates.
    }
  }

  async function startVoiceSessionForCall(userId: string) {
    const response = await fetch("/api/voice/session/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        includeGreetingAudio: false,
      }),
    });
    const data = (await response.json()) as VoiceSessionStartResponse | ApiError;
    if (!response.ok || !("ok" in data)) {
      throw new Error(getApiErrorMessage(data, "Failed to start voice session"));
    }

    setCallVoiceSessionId(data.sessionId);

    const kickoffResponse = await fetch(
      `/api/voice/session/${encodeURIComponent(data.sessionId)}/turn`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userText:
            "Start this call with your default opening accountability question for the user. Keep it short.",
          includeVoice: true,
        }),
      },
    );
    const kickoffData = (await kickoffResponse.json()) as VoiceSessionTurnResponse | ApiError;
    if (!kickoffResponse.ok || !("ok" in kickoffData)) {
      throw new Error(getApiErrorMessage(kickoffData, "Failed to load agent opening line"));
    }

    setCallConversation((prev) => [
      ...prev,
      {
        id: `coach-opening-${Date.now()}`,
        role: "coach",
        text: kickoffData.coachReply,
      },
    ]);
    await playReturnedVoice(kickoffData.voice);
  }

  async function submitCallTurn(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed || !callVoiceSessionId || callTurnPending) {
      return;
    }

    stopCoachAudioPlayback();
    setCallTurnPending(true);
    setCallConversation((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
      },
    ]);

    try {
      const response = await fetch(`/api/voice/session/${encodeURIComponent(callVoiceSessionId)}/turn`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userText: trimmed,
          includeVoice: true,
        }),
      });
      const data = (await response.json()) as VoiceSessionTurnResponse | ApiError;
      if (!response.ok || !("ok" in data)) {
        throw new Error(getApiErrorMessage(data, "Failed to send voice turn"));
      }

      setCallConversation((prev) => [
        ...prev,
        {
          id: `coach-${Date.now()}`,
          role: "coach",
          text: data.coachReply,
        },
      ]);

      if (data.voiceError?.error) {
        setCallSessionNote(`Voice degraded: ${data.voiceError.error}`);
      }
      await playReturnedVoice(data.voice);
    } catch (caughtError) {
      setCallConversation((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          role: "system",
          text: `Turn failed: ${String(caughtError)}`,
        },
      ]);
      setError(String(caughtError));
    } finally {
      setCallTurnPending(false);
    }
  }

  async function endVoiceSession(reason: string) {
    if (!callVoiceSessionId) {
      return;
    }

    try {
      await fetch(`/api/voice/session/${encodeURIComponent(callVoiceSessionId)}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });
    } catch {
      // Best-effort cleanup.
    } finally {
      setCallVoiceSessionId(null);
    }
  }

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

  async function openCallOverlay() {
    if (!activeUserId || callStartPending) {
      return;
    }

    setCallStartPending(true);
    setCallPhase("dialing");
    setCallElapsedSeconds(0);
    setCallSessionNote(null);
    setCallProviderLabel("Connecting");
    setCallOverlayOpen(true);
    setCallConversation([
      {
        id: `system-start-${Date.now()}`,
        role: "system",
        text: "Starting trainer session...",
      },
    ]);

    try {
      const response = await fetch("/api/call/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: activeUserId,
          phoneNumber: selectedPlan?.phoneNumber || undefined,
          includeGreetingAudio: true,
        }),
      });

      const data = (await response.json()) as CallStartResponse | ApiError;
      if (!response.ok || !("ok" in data)) {
        throw new Error(getApiErrorMessage(data, "Failed to start call"));
      }

      if (data.provider === "fallback_in_app") {
        setCallProviderLabel("In-app fallback");
        setCallSessionNote(
          data.note ??
            "Twilio is not configured yet. Coach fallback message was posted to escalation timeline.",
        );
      } else {
        setCallProviderLabel("Twilio outbound");
        setCallSessionNote(
          data.callSid
            ? `Live call requested. SID ${data.callSid}.`
            : "Live call request submitted.",
        );
      }

      await startVoiceSessionForCall(activeUserId);
      await loadDashboardForUser(activeUserId);
      setError(null);
    } catch (caughtError) {
      setCallProviderLabel("Demo fallback");
      setCallSessionNote("Unable to start provider call. Keeping demo overlay active.");
      setError(String(caughtError));
    } finally {
      setCallStartPending(false);
    }
  }

  function closeCallOverlay() {
    stopCoachAudioPlayback();
    void endVoiceSession("user_hangup");
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
                callStartPending={callStartPending}
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
          providerLabel={callProviderLabel}
          sessionNote={callSessionNote}
          pending={callStartPending}
          transcript={callConversation}
          coachSpeaking={callCoachSpeaking}
          turnPending={callTurnPending}
          onSendTurn={submitCallTurn}
          onInterruptCoach={stopCoachAudioPlayback}
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
  const [manualPage, setManualPage] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(plans.length / PLANS_PAGE_SIZE));
  const selectedIndex = selectedPlanId
    ? plans.findIndex((plan) => plan.id === selectedPlanId)
    : -1;
  const selectedPage = selectedIndex >= 0 ? Math.floor(selectedIndex / PLANS_PAGE_SIZE) : 0;
  const listPage = Math.min(manualPage ?? selectedPage, totalPages - 1);
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
            onClick={() => {
              setManualPage(null);
              void onSelectPlan(plan);
            }}
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
              onClick={() => setManualPage(Math.max(0, listPage - 1))}
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
              onClick={() => setManualPage(Math.min(totalPages - 1, listPage + 1))}
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
  callStartPending,
}: {
  dashboard: DashboardPayload | null;
  selectedPlan: PlanRecord | null;
  stripClock: number;
  countdown: string;
  actionPending: string | null;
  onDone: (status: "done" | "missed") => Promise<void>;
  onRecovery: (action: "accept" | "snooze") => Promise<void>;
  onCallTrainer: () => Promise<void>;
  callStartPending: boolean;
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
              <span className="text-[10px] leading-none text-[color:var(--muted)]">
                {day.dateLabel}
              </span>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-base leading-none"
                aria-label={
                  day.marker === "done"
                    ? `${day.weekday} ${day.dateLabel}: completed`
                    : day.marker === "missed"
                      ? `${day.weekday} ${day.dateLabel}: missed`
                      : `${day.weekday} ${day.dateLabel}: no result yet`
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
              onClick={() => void onCallTrainer()}
              disabled={callStartPending}
              className="rounded-full border border-black/20 bg-white px-5 py-3 font-medium text-black transition hover:border-black/40 hover:bg-black hover:text-white disabled:opacity-50"
            >
              {callStartPending ? "Starting call..." : "Call trainer"}
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
  providerLabel,
  sessionNote,
  pending,
  transcript,
  coachSpeaking,
  turnPending,
  onSendTurn,
  onInterruptCoach,
  onClose,
}: {
  selectedPlan: PlanRecord | null;
  phase: "dialing" | "connected";
  elapsedSeconds: number;
  providerLabel: string;
  sessionNote: string | null;
  pending: boolean;
  transcript: CallConversationTurn[];
  coachSpeaking: boolean;
  turnPending: boolean;
  onSendTurn: (text: string) => Promise<void>;
  onInterruptCoach: () => void;
  onClose: () => void;
}) {
  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const ss = String(elapsedSeconds % 60).padStart(2, "0");
  const callTime = `${mm}:${ss}`;
  const [recognizing, setRecognizing] = useState(false);
  const [draftTranscript, setDraftTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldSendOnEndRef = useRef(false);
  const transcriptDraftRef = useRef("");
  const speechWindow =
    typeof window === "undefined" ? null : (window as BrowserSpeechWindow);

  const micSupported =
    Boolean(speechWindow?.SpeechRecognition || speechWindow?.webkitSpeechRecognition);

  function finishMicCapture(options?: { cancel?: boolean }) {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    shouldSendOnEndRef.current = !options?.cancel;
    try {
      recognition.stop?.();
    } catch {
      setRecognizing(false);
    }
  }

  function handleMicCapture() {
    setMicError(null);
    const SpeechRecognitionCtor =
      speechWindow?.SpeechRecognition || speechWindow?.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setMicError("Mic dictation is not supported in this browser (Chrome recommended).");
      return;
    }

    try {
      if (recognizing) {
        finishMicCapture();
        return;
      }

      if (coachSpeaking) {
        onInterruptCoach();
      }
      if (recognitionRef.current) {
        finishMicCapture({ cancel: true });
      }
      const recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      shouldSendOnEndRef.current = true;
      transcriptDraftRef.current = "";
      setDraftTranscript("");
      setRecognizing(true);

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let nextDraft = "";
        const results = event?.results;
        if (!results) {
          return;
        }

        for (let index = 0; index < results.length; index += 1) {
          nextDraft += `${String(results[index]?.[0]?.transcript ?? "")} `;
        }

        const cleaned = nextDraft.trim();
        transcriptDraftRef.current = cleaned;
        setDraftTranscript(cleaned);
      };
      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const code = String(event?.error ?? "unknown");
        shouldSendOnEndRef.current = false;
        if (code === "not-allowed") {
          setMicError("Microphone permission was denied. Allow mic access in browser settings.");
        } else if (code === "no-speech") {
          setMicError("No speech detected. Try again and speak closer to the mic.");
        } else if (code === "aborted") {
          setMicError(null);
        } else {
          setMicError("Mic capture failed. Try again or type your message.");
        }
      };
      recognition.onend = () => {
        const transcriptText = transcriptDraftRef.current.trim();
        const shouldSend = shouldSendOnEndRef.current;
        setRecognizing(false);
        recognitionRef.current = null;
        shouldSendOnEndRef.current = false;
        transcriptDraftRef.current = "";
        setDraftTranscript("");

        if (!shouldSend) {
          return;
        }

        if (transcriptText) {
          void onSendTurn(transcriptText);
        } else {
          setMicError("No speech was detected. Try again and speak clearly.");
        }
      };
      recognition.start();
    } catch {
      setRecognizing(false);
      setMicError("Unable to start mic capture in this browser.");
    }
  }

  useEffect(() => {
    return () => {
      try {
        shouldSendOnEndRef.current = false;
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, draftTranscript]);

  const statusLine =
    phase === "dialing"
      ? "Connecting trainer line and preparing voice stream."
      : turnPending
        ? "Coach is thinking through your update."
        : recognizing
          ? "Listening now. Tap again when you want to send your turn."
          : coachSpeaking
            ? "Coach is talking. You can interrupt if you want to jump in."
            : "Your turn. Start speaking when you're ready.";

  const micButtonLabel = !micSupported
    ? "Mic unavailable"
    : turnPending || pending
      ? "Sending..."
      : recognizing
        ? "Stop and send"
        : coachSpeaking
          ? "Interrupt"
          : "Start speaking";
  const avatarPulseActive = phase === "dialing" || coachSpeaking;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="panel relative w-full max-w-2xl rounded-[2rem] p-3 text-[color:var(--foreground)]">
        <div className="mx-auto mb-3 h-1.5 w-20 rounded-full bg-black/10" />
        <div className="rounded-[1.7rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,249,236,0.96),rgba(239,226,207,0.9))] p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[0.82fr_1.18fr] md:items-start">
            <div className="rounded-[1.4rem] border border-[color:var(--line)] bg-[rgba(255,255,255,0.45)] p-4 text-center">
              <p className="label text-[color:var(--signal)]">{providerLabel}</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Coach Goggins</h3>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {selectedPlan?.phoneNumber ? `Calling ${selectedPlan.phoneNumber}` : "Live demo call"}
              </p>

              <div className="mt-5 flex justify-center">
                <div className="relative flex h-22 w-22 items-center justify-center rounded-full bg-[rgba(255,107,53,0.12)] sm:h-24 sm:w-24">
                  <span
                    className={`absolute inset-0 rounded-full ${
                      avatarPulseActive
                        ? "animate-ping bg-[rgba(255,107,53,0.2)]"
                        : "bg-[rgba(24,121,78,0.14)]"
                    }`}
                  />
                  <span
                    className={`absolute inset-[10px] rounded-full ${
                      coachSpeaking ? "animate-pulse bg-[rgba(255,107,53,0.18)]" : "bg-transparent"
                    }`}
                  />
                  <Image
                    src={gogginsPic}
                    alt="Coach Goggins"
                    width={64}
                    height={64}
                    className="relative h-14 w-14 rounded-full border border-[rgba(22,18,15,0.08)] object-cover shadow-[0_10px_24px_rgba(39,26,15,0.18)] sm:h-16 sm:w-16"
                  />
                </div>
              </div>

              <p className="mt-4 text-sm font-medium uppercase tracking-[0.12em] text-[color:var(--muted)]">
                {phase === "dialing" ? "Dialing..." : `Connected • ${callTime}`}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {statusLine}
              </p>
              {sessionNote ? (
                <p className="mt-3 rounded-xl border border-[color:var(--line)] bg-[rgba(255,255,255,0.55)] px-3 py-2 text-xs leading-5 text-[color:var(--muted)]">
                  {sessionNote}
                </p>
              ) : null}

              <div className="mt-4 flex justify-center md:justify-start">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="rounded-full bg-[color:var(--foreground)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  End call
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[1.2rem] border border-[color:var(--line)] bg-[rgba(255,255,255,0.52)] p-3 text-left">
                <p className="label text-[color:var(--muted)]">Conversation</p>
                <div
                  ref={transcriptScrollRef}
                  className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1"
                >
                  {transcript.length === 0 ? (
                    <p className="text-xs text-[color:var(--muted)]">
                      Waiting for coach greeting...
                    </p>
                  ) : (
                    transcript.map((turn) => (
                      <div
                        key={turn.id}
                        className={`rounded-lg px-2.5 py-2 text-xs leading-5 ${
                          turn.role === "coach"
                            ? "bg-[rgba(255,107,53,0.12)] text-[color:var(--foreground)]"
                            : turn.role === "user"
                              ? "bg-[rgba(22,18,15,0.08)] text-[color:var(--foreground)]"
                              : "bg-[rgba(22,18,15,0.05)] text-[color:var(--muted)]"
                        }`}
                      >
                        <span className="mr-1 font-semibold uppercase tracking-[0.08em]">
                          {turn.role}
                        </span>
                        {turn.text}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[color:var(--line)] bg-[rgba(255,255,255,0.45)] p-3">
                <p className="text-xs leading-5 text-[color:var(--muted)]">
                  Mic-only mode. Start speaking when you want the floor, then tap again to send. If the coach is still talking, your tap will interrupt playback first.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleMicCapture}
                    disabled={turnPending || pending}
                    className="rounded-full bg-[color:var(--signal)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {micButtonLabel}
                  </button>
                  {recognizing ? (
                    <button
                      type="button"
                      onClick={() => finishMicCapture({ cancel: true })}
                      className="rounded-full border border-[color:var(--line-strong)] bg-white/65 px-4 py-2 text-xs font-semibold text-[color:var(--foreground)]"
                    >
                      Cancel
                    </button>
                  ) : null}
                  {coachSpeaking && !recognizing && !turnPending ? (
                    <button
                      type="button"
                      onClick={onInterruptCoach}
                      className="rounded-full border border-[color:var(--line-strong)] bg-white/65 px-4 py-2 text-xs font-semibold text-[color:var(--foreground)]"
                    >
                      Stop voice
                    </button>
                  ) : null}
                </div>
                {draftTranscript ? (
                  <p className="mt-2 rounded-lg bg-[rgba(22,18,15,0.05)] px-3 py-2 text-[11px] leading-5 text-[color:var(--muted)]">
                    {draftTranscript}
                  </p>
                ) : null}
                {!micSupported ? (
                  <p className="mt-2 text-[11px] text-[color:var(--muted)]">
                    Mic dictation requires Web Speech API support (Chrome recommended).
                  </p>
                ) : null}
                {micError ? (
                  <p className="mt-2 text-[11px] text-[color:var(--danger)]">{micError}</p>
                ) : null}
              </div>
            </div>
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
