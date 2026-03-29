"use client";

import { useMemo, type ReactNode } from "react";

type WearableMockBundle = {
  load7: number[];
  hrRest7: number[];
  sleepHours: { deep: number; light: number; rem: number; awake: number };
  zoneMinutes: [number, number, number, number, number];
  vo2Trend: number[];
  accent: "endurance" | "strength" | "general";
};

function mockWearableBundle(goalType: string | undefined): WearableMockBundle {
  const g = (goalType ?? "Training").toLowerCase();
  const endurance =
    g.includes("marathon") ||
    g.includes("run") ||
    g.includes("5k") ||
    g.includes("10k") ||
    g.includes("race");
  const strength = g.includes("strength") || g.includes("lift") || g.includes("gym");

  if (endurance) {
    return {
      load7: [42, 48, 55, 52, 58, 61, 54],
      hrRest7: [49, 48, 48, 47, 47, 47, 47],
      sleepHours: { deep: 1.75, light: 3.1, rem: 1.85, awake: 0.35 },
      zoneMinutes: [14, 22, 38, 24, 12],
      vo2Trend: [49.2, 49.8, 50.1, 50.4, 50.8, 51.0, 51.0],
      accent: "endurance",
    };
  }

  if (strength) {
    return {
      load7: [28, 32, 30, 35, 33, 38, 31],
      hrRest7: [58, 57, 58, 57, 56, 56, 56],
      sleepHours: { deep: 1.4, light: 3.4, rem: 1.6, awake: 0.45 },
      zoneMinutes: [22, 18, 12, 8, 5],
      vo2Trend: [44.5, 44.8, 45.0, 45.2, 45.5, 45.9, 46.0],
      accent: "strength",
    };
  }

  return {
    load7: [35, 40, 38, 44, 42, 46, 43],
    hrRest7: [54, 53, 53, 52, 52, 52, 52],
    sleepHours: { deep: 1.55, light: 3.25, rem: 1.7, awake: 0.4 },
    zoneMinutes: [18, 20, 25, 20, 12],
    vo2Trend: [46.5, 46.9, 47.2, 47.5, 47.8, 48.0, 48.0],
    accent: "general",
  };
}

const ZONE_LABELS = ["Z1", "Z2", "Z3", "Z4", "Z5"] as const;
const ZONE_COLORS = [
  "rgba(24, 121, 78, 0.55)",
  "rgba(255, 107, 53, 0.35)",
  "rgba(255, 107, 53, 0.65)",
  "rgba(180, 35, 24, 0.55)",
  "rgba(22, 18, 15, 0.75)",
];

function trainingBiometricsForGoal(goalType: string | undefined) {
  const g = (goalType ?? "Training").toLowerCase();
  const endurance =
    g.includes("marathon") ||
    g.includes("run") ||
    g.includes("5k") ||
    g.includes("10k") ||
    g.includes("race");
  const strength = g.includes("strength") || g.includes("lift") || g.includes("gym");

  if (endurance) {
    return [
      { label: "Resting HR", value: "47 bpm" },
      { label: "VO2 max", value: "51" },
      { label: "Training status", value: "Productive" },
      { label: "7-day load", value: "Optimal" },
      { label: "HRV status", value: "Balanced" },
    ];
  }

  if (strength) {
    return [
      { label: "Resting HR", value: "56 bpm" },
      { label: "VO2 max", value: "46" },
      { label: "Training load (24h)", value: "Low" },
      { label: "HRV (overnight)", value: "52 ms" },
      { label: "Stress", value: "28" },
    ];
  }

  return [
    { label: "Resting HR", value: "52 bpm" },
    { label: "VO2 max", value: "48" },
    { label: "Training status", value: "Balanced" },
    { label: "Body battery", value: "72" },
    { label: "Sleep (last night)", value: "7h 35m" },
  ];
}

function ChartShell({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-[1.35rem] border border-[color:var(--line)] bg-white/75 p-4 shadow-[0_12px_40px_rgba(39,26,15,0.06)] ${className}`}
    >
      <div className="mb-3">
        <p className="text-sm font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] leading-4 text-[color:var(--muted)]">{subtitle}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

const AREA_CHART_W = 280;
const AREA_CHART_PAD = 8;

/** Horizontal position (% from left) of the i-th point, matching SVG path math. */
function areaChartXPercent(i: number, n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return (AREA_CHART_PAD / AREA_CHART_W) * 100;
  const xStep = (AREA_CHART_W - AREA_CHART_PAD * 2) / (n - 1);
  return ((AREA_CHART_PAD + i * xStep) / AREA_CHART_W) * 100;
}

function rollingCalendarLabels(count: number): string[] {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (count - 1 - i));
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });
}

function AreaLineChart({
  values,
  color,
  fillId,
  xLabels,
}: {
  values: number[];
  color: string;
  fillId: string;
  /** Defaults to one label per point: last N calendar days (e.g. Mar 23). */
  xLabels?: string[];
}) {
  const axisLabels = useMemo(() => {
    if (xLabels && xLabels.length === values.length) return xLabels;
    return rollingCalendarLabels(values.length);
  }, [values.length, xLabels]);

  const { linePath, areaPath, max, min } = useMemo(() => {
    const w = AREA_CHART_W;
    const h = 96;
    const pad = AREA_CHART_PAD;
    const n = values.length;
    if (n === 0) {
      return { linePath: "", areaPath: "", max: 1, min: 0 };
    }
    const vmax = Math.max(...values);
    const vmin = Math.min(...values);
    const spread = Math.max(vmax - vmin, 1);
    const xStep = n <= 1 ? 0 : (w - pad * 2) / (n - 1);
    const x = (i: number) => pad + i * xStep;
    const y = (v: number) => pad + (1 - (v - vmin) / spread) * (h - pad * 2);

    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const linePath = `M ${pts.join(" L ")}`;
    const areaPath = `${linePath} L ${x(n - 1).toFixed(1)},${h - pad} L ${x(0).toFixed(1)},${h - pad} Z`;
    return { linePath, areaPath, max: vmax, min: vmin };
  }, [values]);

  return (
    <div className="w-full min-w-0">
      <div className="relative h-28 w-full min-h-0">
        <svg
          viewBox={`0 0 ${AREA_CHART_W} 96`}
          className="h-full w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${fillId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 flex w-6 flex-col justify-between py-1 pl-1"
          aria-hidden
        >
          <span className="text-[8px] font-medium leading-none text-[#6d6257]">
            {Math.round(max)}
          </span>
          <span className="text-[8px] font-medium leading-none text-[#6d6257]">
            {Math.round(min)}
          </span>
        </div>
      </div>
      {values.length > 0 ? (
        <div className="relative mt-1 h-5 w-full">
          {axisLabels.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className="absolute top-0 max-w-[14%] -translate-x-1/2 text-center text-[9px] font-medium leading-tight text-[color:var(--muted)] sm:text-[10px]"
              style={{ left: `${areaChartXPercent(i, values.length)}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BarWeekChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const barMaxPx = 90;
  return (
    <div className="flex h-[7.25rem] items-end justify-between gap-1.5 px-0.5">
      {values.map((v, i) => (
        <div key={i} className="flex min-h-0 flex-1 flex-col items-center justify-end gap-1.5">
          <div
            className="w-full max-w-[2.25rem] rounded-t-md transition-all"
            style={{
              height: `${Math.max(6, (v / max) * barMaxPx)}px`,
              background: `linear-gradient(180deg, ${color} 0%, rgba(22,18,15,0.35) 100%)`,
            }}
          />
          <span className="text-[10px] font-medium text-[color:var(--muted)]">
            {["M", "T", "W", "T", "F", "S", "S"][i] ?? i}
          </span>
        </div>
      ))}
    </div>
  );
}

function SleepStack({
  deep,
  light,
  rem,
  awake,
}: {
  deep: number;
  light: number;
  rem: number;
  awake: number;
}) {
  const total = deep + light + rem + awake;
  const pct = (v: number) => `${(v / total) * 100}%`;
  const segments = [
    { label: "Deep", value: deep, color: "rgba(24, 121, 78, 0.85)" },
    { label: "Light", value: light, color: "rgba(255, 107, 53, 0.45)" },
    { label: "REM", value: rem, color: "rgba(111, 93, 135, 0.65)" },
    { label: "Awake", value: awake, color: "rgba(22, 18, 15, 0.2)" },
  ];

  return (
    <div>
      <div className="flex h-10 overflow-hidden rounded-xl border border-[color:var(--line)]">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: pct(s.value), backgroundColor: s.color }}
            title={`${s.label}: ${s.value.toFixed(1)}h`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[color:var(--muted)]">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label} {s.value.toFixed(1)}h
          </span>
        ))}
      </div>
    </div>
  );
}

function ZoneDistribution({ minutes }: { minutes: [number, number, number, number, number] }) {
  const total = minutes.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-2">
      {minutes.map((m, i) => (
        <div key={ZONE_LABELS[i]} className="flex items-center gap-2">
          <span className="w-7 text-[10px] font-semibold text-[color:var(--muted)]">
            {ZONE_LABELS[i]}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(m / total) * 100}%`,
                backgroundColor: ZONE_COLORS[i],
              }}
            />
          </div>
          <span className="w-8 text-right text-[10px] tabular-nums text-[color:var(--muted)]">
            {m}m
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-[color:var(--line)] bg-white/68 p-2.5">
      <p className="label text-[color:var(--muted)]">{label}</p>
      <p
        className={`mt-1.5 break-words font-semibold tracking-[-0.05em] ${
          value.length > 28
            ? "text-sm sm:text-base"
            : value.length > 18
              ? "text-lg"
              : "text-xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function WearableInsightsPanel({ goalType }: { goalType?: string }) {
  const mock = useMemo(() => mockWearableBundle(goalType), [goalType]);
  const metrics = useMemo(() => trainingBiometricsForGoal(goalType), [goalType]);
  const lineColor = "var(--signal)";
  const barColor =
    mock.accent === "endurance"
      ? "rgba(255, 107, 53, 0.92)"
      : mock.accent === "strength"
        ? "rgba(24, 121, 78, 0.85)"
        : "rgba(255, 107, 53, 0.75)";

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-5">
      <div>
        <p className="label text-[color:var(--signal)]">Readiness from your watch</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.05em] sm:text-2xl">
          Training load & recovery
        </h2>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ChartShell
          title="7-day training load"
          subtitle="Relative stress your body has absorbed — higher is not always better."
        >
          <BarWeekChart values={mock.load7} color={barColor} />
        </ChartShell>

        <ChartShell
          title="Resting heart rate"
          subtitle="Overnight trend — stable is a good sign when volume rises."
        >
          <AreaLineChart values={mock.hrRest7} color={lineColor} fillId="hr-fill" />
        </ChartShell>

        <ChartShell title="Sleep stages" subtitle="Last night — time in each stage.">
          <SleepStack
            deep={mock.sleepHours.deep}
            light={mock.sleepHours.light}
            rem={mock.sleepHours.rem}
            awake={mock.sleepHours.awake}
          />
        </ChartShell>

        <ChartShell
          title="Yesterday’s workout — time in zones"
          subtitle="Minutes spent in each heart-rate zone."
        >
          <ZoneDistribution minutes={mock.zoneMinutes} />
        </ChartShell>

        <ChartShell
          className="lg:col-span-2"
          title="VO2 max estimate"
          subtitle="Rolling trend from your watch."
        >
          <AreaLineChart values={mock.vo2Trend} color="rgba(24, 121, 78, 0.9)" fillId="vo2-fill" />
        </ChartShell>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((row) => (
          <MetricCard key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  );
}
