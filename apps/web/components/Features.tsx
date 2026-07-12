"use client";

import { Cpu, Activity, Layers, Bell, CalendarCheck2, Database } from "lucide-react";

/* Shared cell chrome */
function Cell({
  icon: Icon,
  title,
  description,
  className = "",
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-border-mute/80 bg-surface/30 dark:bg-zinc-900/10 transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:-translate-y-1 hover:shadow-md ${className}`}
    >
      {/* Visual area */}
      {children && (
        <div className="relative flex-1 min-h-[120px] overflow-hidden border-b border-border-mute/60 bg-background/40">
          {children}
        </div>
      )}
      {/* Copy area */}
      <div className="p-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="inline-flex p-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-600 dark:text-emerald-500">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm font-bold text-foreground font-sans tracking-tight">{title}</h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/* ── Mini-visuals ────────────────────────────────────────────────────── */

function VizTelemetry() {
  const wave =
    "M0,40 C14,38 20,30 32,31 C44,32 48,42 60,41 C72,40 76,26 88,28 " +
    "C100,30 104,38 116,36 C128,34 132,20 144,22 C156,24 160,42 172,44 " +
    "C184,46 188,32 200,28 C212,24 216,16 228,18 C240,20 248,30 260,32";
  return (
    <div className="absolute inset-0 p-5 flex flex-col justify-between">
      <div className="flex gap-4">
        {[
          { k: "TEMP", v: "68.4°C" },
          { k: "VIBE", v: "2.17 mm/s" },
          { k: "VOLT", v: "228 V" },
          { k: "PRESS", v: "4.11 bar" },
        ].map((s) => (
          <div key={s.k} className="leading-none">
            <p className="text-[8px] font-mono font-bold tracking-widest text-text-muted">{s.k}</p>
            <p className="text-[11px] font-mono font-bold text-foreground mt-1 tabular-nums">{s.v}</p>
          </div>
        ))}
        <span className="ml-auto flex items-center gap-1.5 self-start rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5">
          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[7px] font-mono font-bold uppercase tracking-widest text-emerald-500">Live</span>
        </span>
      </div>
      <div className="relative">
        <svg viewBox="0 0 260 56" className="w-full h-16" preserveAspectRatio="none">
          <defs>
            <linearGradient id="feat-wave-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${wave} L260,56 L0,56 Z`} fill="url(#feat-wave-fill)" />
          <path d={wave} fill="none" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="hero-scan-cursor absolute top-0 bottom-0 w-px bg-emerald-400/50" />
      </div>
    </div>
  );
}

function VizForecast() {
  return (
    <div className="absolute inset-0 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-text-muted">Wear trajectory</span>
        <span className="text-[10px] font-mono font-bold text-emerald-500">RUL 240d</span>
      </div>
      <svg viewBox="0 0 200 70" className="w-full h-full max-h-24 mt-1" preserveAspectRatio="none">
        {/* observed wear */}
        <path
          d="M0,14 C30,16 55,20 85,28 C105,33 115,38 124,42"
          fill="none" stroke="var(--foreground)" strokeWidth="1.6" opacity="0.75"
          strokeLinecap="round" vectorEffect="non-scaling-stroke"
        />
        {/* forecast */}
        <path
          d="M124,42 C140,49 158,56 196,62"
          fill="none" stroke="#10b981" strokeWidth="1.6" strokeDasharray="4 4"
          strokeLinecap="round" vectorEffect="non-scaling-stroke"
        />
        <circle cx="124" cy="42" r="2.6" fill="#10b981">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
        </circle>
        {/* failure threshold */}
        <line x1="0" y1="62" x2="200" y2="62" stroke="var(--border-mute)" strokeWidth="1" strokeDasharray="2 4" />
      </svg>
      <span className="absolute bottom-3 left-5 text-[7px] font-mono uppercase tracking-widest text-text-muted">
        failure threshold
      </span>
    </div>
  );
}

function VizOcr() {
  return (
    <div className="absolute inset-0 p-5 flex items-center gap-4">
      {/* Paper log */}
      <div className="relative w-24 shrink-0 rounded-lg border border-border-mute/70 bg-surface p-2.5 overflow-hidden">
        <div className="space-y-1.5">
          {[80, 62, 74, 48, 68].map((w, i) => (
            <div key={i} className="h-1 rounded-full bg-border-mute" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="feat-ocr-scan absolute inset-x-0 h-5 bg-gradient-to-b from-transparent via-emerald-500/25 to-transparent" />
      </div>
      <span className="text-text-muted text-lg shrink-0">→</span>
      {/* Structured output */}
      <div className="flex-1 min-w-0 font-mono text-[9px] leading-relaxed text-text-muted">
        <p><span className="text-emerald-500">technician:</span> "K. Mensah"</p>
        <p><span className="text-emerald-500">service:</span> "coolant flush"</p>
        <p><span className="text-emerald-500">status:</span> "healthy"</p>
      </div>
    </div>
  );
}

function VizAlerts() {
  return (
    <div className="absolute inset-0 p-5 flex flex-col justify-center gap-2">
      {[
        { sev: "CRIT", msg: "Hydraulic pressure floor breach", tone: "#ef4444", pulse: true },
        { sev: "WARN", msg: "Bearing vibration variance +9%", tone: "#f59e0b", pulse: false },
        { sev: "INFO", msg: "Coolant cycle completed", tone: "var(--text-muted)", pulse: false },
      ].map((a) => (
        <div key={a.sev} className="flex items-center gap-2 rounded-lg border border-border-mute/60 bg-surface/60 px-2.5 py-1.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${a.pulse ? "animate-pulse" : ""}`} style={{ background: a.tone }} />
          <span className="text-[8px] font-mono font-bold shrink-0" style={{ color: a.tone }}>{a.sev}</span>
          <span className="text-[9px] text-text-muted truncate">{a.msg}</span>
        </div>
      ))}
    </div>
  );
}

function VizCalendar() {
  const highlight = 17;
  return (
    <div className="absolute inset-0 p-5 flex flex-col justify-center">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-text-muted">Optimal window</span>
        <span className="text-[9px] font-mono font-bold text-emerald-500">Day 17</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 28 }).map((_, i) => {
          const day = i + 1;
          const isHit = day === highlight;
          return (
            <div
              key={i}
              className={`relative aspect-square rounded flex items-center justify-center text-[7px] font-mono ${
                isHit
                  ? "bg-emerald-500 text-white font-bold"
                  : "bg-border-mute/40 text-text-muted"
              }`}
            >
              {isHit && <span className="mc-ping absolute inset-0 rounded border border-emerald-500/60" />}
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VizIngest() {
  return (
    <div className="absolute inset-0 px-5 py-4 font-mono text-[9px] leading-relaxed overflow-hidden">
      <p className="text-text-muted">POST /api/sensor-readings</p>
      <p className="text-text-muted/70 mt-1">
        {"{"} <span className="text-emerald-500">"equipment_id"</span>: "PUMP-090",{" "}
        <span className="text-emerald-500">"vibration"</span>: 2.17,{" "}
        <span className="text-emerald-500">"temperature"</span>: 68.4 {"}"}
        <span className="inline-block w-1.5 h-3 ml-1 align-middle bg-emerald-500 animate-pulse" />
      </p>
      <p className="text-emerald-500 mt-1.5">201 · stream accepted</p>
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────── */

export default function Features() {
  return (
    <section className="py-20 md:py-32 bg-background/50 border-b border-border-mute" id="features">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 reveal">
          <span className="text-[10px] font-bold tracking-widest uppercase text-text-muted font-mono block mb-2">
            Professional Toolkit
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
            Everything you need to maintain smarter
          </h2>
          <p className="text-xs md:text-sm text-text-muted mt-3 max-w-lg mx-auto leading-relaxed">
            Avoid reactive repairs. PFMI provides structural, AI-driven diagnostics to optimize machine lifespans.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-5 auto-rows-fr">
          <Cell
            icon={Cpu}
            title="Smart Telemetry Dashboard"
            description="Real-time health overview for all machines. Monitor temperature, vibration, pressure, and voltage at a glance."
            className="md:col-span-4 reveal"
          >
            <VizTelemetry />
          </Cell>

          <Cell
            icon={Activity}
            title="Predictive AI Inference"
            description="ML models forecast Remaining Useful Life and anomaly probability from live wear trends."
            className="md:col-span-2 reveal"
          >
            <VizForecast />
          </Cell>

          <Cell
            icon={Layers}
            title="OCR Data Entry Pipeline"
            description="Upload scans of manual logbooks — the OCR engine digitizes and extracts service notes automatically."
            className="md:col-span-3 reveal"
          >
            <VizOcr />
          </Cell>

          <Cell
            icon={Bell}
            title="Smart Alert Priority"
            description="Technicians are notified the moment sensor levels breach variance parameters, ranked by severity."
            className="md:col-span-3 reveal"
          >
            <VizAlerts />
          </Cell>

          <Cell
            icon={CalendarCheck2}
            title="Automated Maintenance Calendar"
            description="Maintenance windows are forecast from wear trends rather than simple timestamps, reducing costly downtime."
            className="md:col-span-3 reveal"
          >
            <VizCalendar />
          </Cell>

          <Cell
            icon={Database}
            title="Flexible IoT Ingestion"
            description="Connect virtual or physical machinery streams via robust JSON telemetry APIs built for industrial scale."
            className="md:col-span-3 reveal"
          >
            <VizIngest />
          </Cell>
        </div>
      </div>
    </section>
  );
}
