"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowUpRight, CheckCircle2, Cpu, Flame,
  Radar, ShieldAlert, Signal, Zap,
} from "lucide-react";
import { Equipment, Alert } from "@/lib/db";
import { getMachineMeta, MACHINE_PARTS, partScore, scoreColor } from "@/lib/machine-meta";
import Tip from "@/components/ui/Tip";

/* ── Helpers ─────────────────────────────────────────────────────────── */

const statusColor = (status: string) =>
  status === "Healthy" ? "#10b981" : status === "Warning" ? "#f59e0b" : "#ef4444";

/** Deterministic pseudo-telemetry series seeded by equipment id, converging
 *  to the live health score — stable across renders, unique per unit. */
function seededSeries(id: string, health: number, n = 28): number[] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = ((h ^ id.charCodeAt(i)) * 16777619) >>> 0;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const pts: number[] = [];
  let v = Math.min(100, Math.max(4, health + (rand() - 0.5) * 34));
  for (let i = 0; i < n; i++) {
    pts.push(v);
    v += (health - v) * 0.16 + (rand() - 0.5) * 9;
    v = Math.max(3, Math.min(100, v));
  }
  pts[n - 1] = health;
  return pts;
}

/** Animated count-up for hero numbers. */
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

/* ── Sparkline (SVG area chart) ──────────────────────────────────────── */

function Sparkline({ series, color, uid }: { series: number[]; color: string; uid: string }) {
  const w = 100;
  const hgt = 30;
  const step = w / (series.length - 1);
  const y = (v: number) => hgt - (v / 100) * (hgt - 4) - 2;
  const line = series.map((v, i) => `${(i * step).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = `0,${hgt} ${line} ${w},${hgt}`;
  const lastX = (series.length - 1) * step;
  const lastY = y(series[series.length - 1]);

  return (
    <svg viewBox={`0 0 ${w} ${hgt}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${uid})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.4" fill={color}>
        <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ── Fleet Health Command Ring ───────────────────────────────────────── */

function FleetRing({ avgHealth, total }: { avgHealth: number; total: number }) {
  const shown = useCountUp(avgHealth);
  const R = 74;
  const C = 2 * Math.PI * R;
  const color = avgHealth >= 80 ? "#10b981" : avgHealth >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 208, height: 208 }}>
      {/* Ambient glow */}
      <div
        className="absolute inset-4 rounded-full blur-2xl opacity-25"
        style={{ background: color }}
      />
      <svg viewBox="0 0 180 180" className="absolute inset-0 w-full h-full">
        {/* Rotating outer dashed ring */}
        <g className="mc-spin-slow" style={{ transformOrigin: "90px 90px" }}>
          <circle
            cx="90" cy="90" r="86"
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeDasharray="2 9"
            opacity="0.5"
          />
        </g>
        {/* Tick marks */}
        {Array.from({ length: 36 }).map((_, i) => {
          const a = (i / 36) * Math.PI * 2;
          const on = i / 36 <= avgHealth / 100;
          return (
            <line
              key={i}
              x1={90 + Math.sin(a) * 62} y1={90 - Math.cos(a) * 62}
              x2={90 + Math.sin(a) * 66} y2={90 - Math.cos(a) * 66}
              stroke={on ? color : "var(--border-mute)"}
              strokeWidth="1.6"
              opacity={on ? 0.9 : 0.5}
            />
          );
        })}
        {/* Track */}
        <circle cx="90" cy="90" r={R} fill="none" stroke="var(--border-mute)" strokeWidth="7" opacity="0.35" />
        {/* Progress arc */}
        <circle
          cx="90" cy="90" r={R}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (shown / 100) * C}
          transform="rotate(-90 90 90)"
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <span className="text-5xl font-black font-mono tracking-tighter text-foreground leading-none">
          {shown}
        </span>
        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-text-muted mt-1.5">
          Fleet Health
        </span>
        <span className="text-[9px] font-mono mt-0.5" style={{ color }}>
          {total} units tracked
        </span>
      </div>
    </div>
  );
}

/* ── Status Distribution Donut ───────────────────────────────────────── */

function StatusDonut({ equipment }: { equipment: Equipment[] }) {
  const counts = [
    { label: "Healthy", n: equipment.filter((e) => e.status === "Healthy").length, color: "#10b981" },
    { label: "Warning", n: equipment.filter((e) => e.status === "Warning").length, color: "#f59e0b" },
    { label: "Critical", n: equipment.filter((e) => e.status !== "Healthy" && e.status !== "Warning").length, color: "#ef4444" },
  ];
  const total = Math.max(1, equipment.length);
  const R = 40;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--border-mute)" strokeWidth="10" opacity="0.3" />
        {counts.map((s) => {
          const frac = s.n / total;
          const seg = (
            <circle
              key={s.label}
              cx="50" cy="50" r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="10"
              strokeDasharray={`${Math.max(0, frac * C - 2)} ${C}`}
              strokeDashoffset={-acc * C}
              strokeLinecap="butt"
              className="transition-all duration-700"
            />
          );
          acc += frac;
          return seg;
        })}
      </svg>
      <div className="space-y-2">
        {counts.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted w-14">
              {s.label}
            </span>
            <span className="text-sm font-black font-mono text-foreground">{s.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Live UTC Clock ──────────────────────────────────────────────────── */

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-xs font-bold text-foreground tabular-nums">
      {now ? now.toUTCString().slice(17, 25) : "--:--:--"}
      <span className="text-text-muted text-[9px] ml-1.5">UTC</span>
    </span>
  );
}

/* ── Alert Feed ──────────────────────────────────────────────────────── */

function AlertFeed({ alerts, onResolve }: { alerts: Alert[]; onResolve: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border-mute bg-surface/60 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-mute/70">
        <div className="relative flex items-center justify-center">
          <span className={`h-2 w-2 rounded-full ${alerts.length ? "bg-red-500" : "bg-emerald-500"}`} />
          {alerts.length > 0 && (
            <span className="mc-ping absolute h-2 w-2 rounded-full bg-red-500" />
          )}
        </div>
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted">
          Incident Feed
        </h2>
        <span className="ml-auto text-[9px] font-mono font-bold text-text-muted">
          {alerts.length} OPEN
        </span>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[520px] divide-y divide-border-mute/50">
        {alerts.length === 0 ? (
          <div className="p-8 flex flex-col items-center text-center gap-2">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            <span className="text-xs font-semibold text-foreground">All channels clear</span>
            <p className="text-[10px] text-text-muted">No anomalies flagged by the prediction engine.</p>
          </div>
        ) : (
          alerts.map((alert, i) => {
            const critical = alert.severity === "Critical" || alert.severity === "High";
            const c = critical ? "#ef4444" : "#f59e0b";
            return (
              <div
                key={alert.id}
                className="mc-feed-item group p-3.5 hover:bg-background/60 transition-colors"
                style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-1 h-1.5 w-1.5 rounded-full shrink-0 animate-pulse"
                    style={{ background: c }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[8px] font-mono font-bold px-1.5 py-px rounded uppercase border"
                        style={{ color: c, borderColor: `${c}33`, background: `${c}14` }}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-[11px] font-bold text-foreground truncate">
                        {alert.equipmentName}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 leading-relaxed line-clamp-2">
                      {alert.message}
                    </p>
                  </div>
                  <button
                    onClick={() => onResolve(alert.id)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Equipment Node Card ─────────────────────────────────────────────── */

function NodeCard({ eq, index }: { eq: Equipment; index: number }) {
  const color = statusColor(eq.status);
  const series = seededSeries(eq.id ?? eq.name, eq.health_score);
  const meta = getMachineMeta(eq.name);
  const MachineIcon = meta.icon;

  return (
    <Link
      href={`/dashboard/${eq.id}`}
      className="mc-card mc-rise group relative overflow-hidden rounded-2xl border border-border-mute/80 bg-surface/60 backdrop-blur-sm p-4 transition-all duration-300 hover:-translate-y-1 hover:border-border-mute hover:shadow-[0_14px_44px_rgba(0,0,0,0.10)] block"
      style={{ animationDelay: `${Math.min(index, 9) * 60}ms` }}
    >
      {/* Scanline sweep on hover */}
      <div
        className="mc-scanline pointer-events-none absolute left-0 right-0 h-10 opacity-0 group-hover:opacity-100"
        style={{ background: `linear-gradient(180deg, transparent, ${color}14, transparent)`, top: "-20%" }}
      />
      {/* Status edge glow */}
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}88` }} />

      <div className="pl-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Tip label={meta.type} sub="machine class" side="bottom">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                style={{ borderColor: `${color}30`, background: `${color}10`, color }}
              >
                <MachineIcon className="h-4.5 w-4.5" />
              </span>
            </Tip>
            <div className="min-w-0">
              <h3 className="font-bold text-[13px] text-foreground tracking-tight truncate">{eq.name}</h3>
              <p className="text-[8px] font-mono text-text-muted uppercase tracking-wider mt-0.5 truncate">
                node/{eq.id?.slice(0, 8)}
              </p>
            </div>
          </div>
          <span
            className="shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border"
            style={{ color, borderColor: `${color}33`, background: `${color}12` }}
          >
            {eq.status}
          </span>
        </div>

        {/* Telemetry sparkline */}
        <div className="mt-3">
          <Sparkline series={series} color={color} uid={eq.id ?? String(index)} />
        </div>

        {/* Health bar + score */}
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-border-mute/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${eq.health_score}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
            />
          </div>
          <span className="text-sm font-black font-mono tabular-nums" style={{ color }}>
            {eq.health_score}
            <span className="text-[8px] text-text-muted font-bold ml-0.5">/100</span>
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border-mute/50 flex items-center justify-between">
          {/* Monitored parts with condition dots */}
          <div className="flex items-center gap-1.5">
            {MACHINE_PARTS.map((part, i) => {
              const score = partScore(eq.id ?? eq.name, eq.health_score, i);
              const partColor = scoreColor(score);
              const PartIcon = part.icon;
              return (
                <Tip key={part.key} label={`${part.label} · ${score}/100`} sub={`${part.channel} channel`}>
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-md border border-border-mute/60 bg-background/60 text-text-muted transition-colors hover:text-foreground hover:border-border-mute">
                    <PartIcon className="h-3 w-3" />
                    <span
                      className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-surface"
                      style={{ background: partColor }}
                    />
                  </span>
                </Tip>
              );
            })}
          </div>
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-text-muted group-hover:text-foreground uppercase tracking-wider transition-all group-hover:translate-x-0.5">
            Inspect <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Mission Control (main export) ───────────────────────────────────── */

export default function MissionControl({
  equipment,
  alerts,
  loading,
  mlStatus,
  onResolve,
}: {
  equipment: Equipment[];
  alerts: Alert[];
  loading: boolean;
  mlStatus: "online" | "offline" | "checking";
  onResolve: (id: string) => void;
}) {
  const total = equipment.length;
  const avgHealth = total
    ? Math.round(equipment.reduce((s, e) => s + e.health_score, 0) / total)
    : 0;
  const criticalCount = equipment.filter((e) => e.status === "Critical").length;
  const alertCount = useCountUp(alerts.length, 900);
  const unitCount = useCountUp(total, 900);

  return (
    <div className="relative">
      {/* Backdrop: blueprint grid + radial glow */}
      <div className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0 mc-grid-bg opacity-[0.5]" />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[640px] h-[380px] rounded-full blur-3xl opacity-[0.07]"
        style={{ background: criticalCount > 0 ? "#ef4444" : "#10b981" }}
      />

      <div className="relative space-y-6">
        {/* Command bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-mute pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-9 w-9 rounded-xl border border-emerald-500/25 bg-emerald-500/10">
              <Radar className="h-4.5 w-4.5 text-emerald-500" />
              <span className="mc-ping absolute inset-0 rounded-xl border border-emerald-500/40" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-foreground leading-none">
                Mission Control
              </h1>
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-muted mt-1">
                Predictive Fleet Intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <LiveClock />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-mute bg-surface/70">
              <Zap className={`h-3.5 w-3.5 ${mlStatus === "online" ? "text-emerald-500" : mlStatus === "checking" ? "text-amber-500 animate-pulse" : "text-red-500"}`} />
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-text-muted">
                ML {mlStatus}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-500">
                Stream Live
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center gap-3 text-text-muted">
            <Activity className="h-6 w-6 animate-pulse text-emerald-500" />
            <span className="text-xs font-mono uppercase tracking-widest">Acquiring telemetry…</span>
          </div>
        ) : (
          <>
            {/* Hero bento row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Fleet ring */}
              <div className="lg:col-span-4 mc-rise rounded-2xl border border-border-mute/80 bg-surface/60 backdrop-blur-sm p-5 flex items-center justify-center">
                <FleetRing avgHealth={avgHealth} total={total} />
              </div>

              {/* Status distribution */}
              <div className="lg:col-span-4 mc-rise rounded-2xl border border-border-mute/80 bg-surface/60 backdrop-blur-sm p-5 flex flex-col justify-between" style={{ animationDelay: "80ms" }}>
                <h2 className="text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-text-muted">
                  Status Distribution
                </h2>
                <div className="flex-1 flex items-center justify-center py-2">
                  <StatusDonut equipment={equipment} />
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-muted uppercase tracking-wider">
                  <Cpu className="h-3 w-3" /> {total} nodes reporting
                </div>
              </div>

              {/* Alert + unit counters */}
              <div className="lg:col-span-4 grid grid-rows-2 gap-4">
                <div className="mc-rise relative overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4 flex items-center justify-between" style={{ animationDelay: "140ms" }}>
                  <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted">
                      Open Alerts
                    </p>
                    <p className="text-4xl font-black font-mono text-red-500 mt-1 tabular-nums">{alertCount}</p>
                  </div>
                  <div className="relative">
                    <ShieldAlert className="h-9 w-9 text-red-500/70" />
                    {alerts.length > 0 && (
                      <span className="mc-ping absolute inset-0 rounded-full border-2 border-red-500/40" />
                    )}
                  </div>
                  <Flame className="absolute -bottom-4 -right-4 h-20 w-20 text-red-500 opacity-[0.05]" />
                </div>
                <div className="mc-rise relative overflow-hidden rounded-2xl border border-border-mute bg-surface/60 p-4 flex items-center justify-between" style={{ animationDelay: "200ms" }}>
                  <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted">
                      Units Online
                    </p>
                    <p className="text-4xl font-black font-mono text-foreground mt-1 tabular-nums">{unitCount}</p>
                  </div>
                  <Cpu className="h-9 w-9 text-text-muted/60" />
                  <Cpu className="absolute -bottom-4 -right-4 h-20 w-20 text-foreground opacity-[0.04]" />
                </div>
              </div>
            </div>

            {/* Fleet grid + incident feed */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
              <div className="xl:col-span-8 space-y-3">
                <div className="flex items-center gap-2">
                  <Signal className="h-3.5 w-3.5 text-emerald-500" />
                  <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted">
                    Fleet Telemetry Grid
                  </h2>
                </div>
                {equipment.length === 0 ? (
                  <div className="rounded-2xl border border-border-mute bg-surface/60 p-10 flex flex-col items-center gap-2 text-center">
                    <Cpu className="h-8 w-8 opacity-25" />
                    <span className="text-xs font-semibold text-foreground">No equipment nodes found</span>
                    <p className="text-[10px] text-text-muted">Waiting for units to join the telemetry stream.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {equipment.map((eq, i) => (
                      <NodeCard key={eq.id} eq={eq} index={i} />
                    ))}
                  </div>
                )}
              </div>

              <div className="xl:col-span-4 xl:sticky xl:top-6">
                <AlertFeed alerts={alerts} onResolve={onResolve} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
