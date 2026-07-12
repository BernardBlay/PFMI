"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Play, Radar, TriangleAlert } from "lucide-react";

/* Animated count-up for the metrics bar */
function useCountUp(target: number, duration = 1600): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function Metric({ value, suffix, prefix, decimals = 0, label }: {
  value: number; suffix?: string; prefix?: string; decimals?: number; label: string;
}) {
  const n = useCountUp(value);
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-5 px-4 bg-background/60 transition-colors duration-200 hover:bg-surface">
      <span className="text-2xl font-extrabold text-foreground tracking-tight leading-none tabular-nums">
        {prefix}{n.toFixed(decimals)}{suffix}
      </span>
      <span className="text-[9px] uppercase font-bold tracking-wider text-text-muted font-mono text-center leading-snug">
        {label}
      </span>
    </div>
  );
}

/* ── Animated live-console visual ────────────────────────────────────── */

function HeroConsole() {
  // Static, hand-tuned telemetry path (viewBox 0 0 260 56)
  const wave =
    "M0,34 C10,32 16,26 26,27 C36,28 40,36 50,35 C60,34 64,24 74,25 " +
    "C84,26 88,33 98,32 C108,31 112,20 122,22 C132,24 136,38 146,40 " +
    "C156,42 160,30 170,26 C180,22 184,14 194,16 C204,18 208,30 218,32 C228,34 244,24 260,20";

  return (
    <div className="hero-console-tilt relative w-full max-w-md mx-auto">
      {/* Glow behind the card */}
      <div className="absolute -inset-6 rounded-[2rem] bg-emerald-500/20 blur-3xl opacity-40 pointer-events-none" />

      {/* Floating RUL chip */}
      <div className="hero-orb-chip absolute -right-3 -top-5 z-10 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-surface/90 backdrop-blur px-3 py-2 shadow-lg">
        <Radar className="h-3.5 w-3.5 text-emerald-500" />
        <div className="leading-none">
          <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-text-muted">Est. RUL</p>
          <p className="text-xs font-black font-mono text-emerald-500 mt-0.5">240 days</p>
        </div>
      </div>

      <div className="relative rounded-2xl border border-border-mute/80 bg-surface/80 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.25)] overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-mute/70">
          <span className="h-2 w-2 rounded-full bg-border-mute" />
          <span className="h-2 w-2 rounded-full bg-border-mute" />
          <span className="h-2 w-2 rounded-full bg-border-mute" />
          <span className="ml-2 text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted">
            pfmi://mission-control
          </span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-emerald-500">Live</span>
          </span>
        </div>

        <div className="p-4 space-y-4">
          {/* Gauge + telemetry channels */}
          <div className="flex items-center gap-5">
            {/* Radial health gauge */}
            <div className="relative shrink-0" style={{ width: 92, height: 92 }}>
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border-mute)" strokeWidth="6" opacity="0.4" />
                <circle
                  cx="40" cy="40" r="32"
                  fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={2 * Math.PI * 32 * (1 - 0.87)}
                  className="hero-gauge-in"
                  style={{ filter: "drop-shadow(0 0 5px rgba(16,185,129,0.5))" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black font-mono text-foreground leading-none">87</span>
                <span className="text-[7px] font-mono font-bold uppercase tracking-widest text-text-muted mt-0.5">health</span>
              </div>
            </div>

            {/* Channel equalizer rows */}
            <div className="flex-1 space-y-2.5 min-w-0">
              {[
                { label: "TEMP", val: "68.4 °C", color: "#10b981", cls: "hero-eq-1", w: "62%" },
                { label: "VIBE", val: "2.17 mm/s", color: "#10b981", cls: "hero-eq-2", w: "44%" },
                { label: "PRESS", val: "4.11 bar", color: "#10b981", cls: "hero-eq-3", w: "71%" },
              ].map((ch) => (
                <div key={ch.label}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[8px] font-mono font-bold tracking-widest text-text-muted">{ch.label}</span>
                    <span className="text-[10px] font-mono font-bold text-foreground tabular-nums">{ch.val}</span>
                  </div>
                  <div className="h-1 rounded-full bg-border-mute/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full origin-left ${ch.cls}`}
                      style={{ width: ch.w, background: ch.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Self-drawing waveform */}
          <div className="relative rounded-xl border border-border-mute/60 bg-background/50 px-3 pt-2.5 pb-1 overflow-hidden">
            <span className="text-[8px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted">
              vibration waveform · pump-090
            </span>
            <svg viewBox="0 0 260 56" className="w-full h-14" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hero-wave-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${wave} L260,56 L0,56 Z`} fill="url(#hero-wave-fill)" className="hero-wave-fade" />
              <path
                d={wave}
                fill="none" stroke="#10b981" strokeWidth="1.8"
                strokeLinecap="round" vectorEffect="non-scaling-stroke"
                className="hero-wave-draw"
              />
            </svg>
            {/* Sweeping scan cursor */}
            <div className="hero-scan-cursor absolute top-0 bottom-0 w-px bg-emerald-400/60" />
          </div>

          {/* Looping alert toast */}
          <div className="hero-toast flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 py-2.5">
            <TriangleAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <p className="text-[10px] leading-snug text-text-muted min-w-0 truncate">
              <span className="font-bold text-red-500 font-mono uppercase mr-1.5">Anomaly</span>
              Bearing friction wave on DR-03 — inspection dispatched
            </p>
            <span className="ml-auto text-[8px] font-mono font-bold text-text-muted shrink-0">now</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */

export default function Hero() {
  return (
    <section className="relative border-b border-border-mute bg-background/30 py-20 md:py-28 overflow-hidden">
      {/* Blueprint grid + aurora beams */}
      <div className="pointer-events-none absolute inset-0 mc-grid-bg opacity-70" />
      <div className="hero-beam pointer-events-none absolute -top-40 left-[8%] h-[560px] w-40 rotate-[24deg]" />
      <div className="hero-beam pointer-events-none absolute -top-48 right-[16%] h-[620px] w-56 rotate-[-18deg]" style={{ animationDelay: "3s" }} />
      <div
        className="hero-orb"
        style={{
          width: 500, height: 500,
          background: "radial-gradient(circle, #059669 0%, transparent 70%)",
          top: "-15%", left: "10%",
        }}
      />
      <div
        className="hero-orb"
        style={{
          width: 400, height: 400,
          background: "radial-gradient(circle, #059669 0%, transparent 70%)",
          bottom: "-10%", right: "5%",
          animationDelay: "4s",
          opacity: 0.5,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          {/* Copy column */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <span className="hero-animate hero-animate-delay-1 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-mono mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Hybrid Predictive Maintenance
            </span>

            <h1 className="hero-animate hero-animate-delay-2 max-w-xl font-sans text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground leading-[1.08]">
              Predict machine failures.{" "}
              <span className="text-text-muted">Before they disrupt operations.</span>
            </h1>

            <p className="hero-animate hero-animate-delay-3 max-w-lg text-base sm:text-lg text-text-muted mt-6 leading-relaxed">
              Stop reacting to downtime. PFMI fuses live sensor telemetry, OCR maintenance
              logs, and ML models to forecast remaining useful life — and dispatches alerts
              before the failure happens.
            </p>
            
            <div className="hero-animate hero-animate-delay-4 flex flex-col sm:flex-row gap-3 mt-10">
              <Link
                href="/dashboard"
                className="btn-primary-shimmer flex items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:bg-foreground/90 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
              >
                Launch Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/ocr-upload"
                className="flex items-center justify-center rounded-xl border border-border-mute bg-surface px-6 py-3 text-sm font-medium text-text-muted transition-all hover:bg-background hover:text-foreground hover:border-zinc-400 dark:hover:border-zinc-650 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 mr-2" />
                Ingest Logs (OCR)
              </Link>
            </div>
          </div>

          {/* Visual column */}
          <div className="hero-animate hero-animate-delay-3">
            <HeroConsole />
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="hero-animate hero-animate-delay-4 grid grid-cols-2 md:grid-cols-4 max-w-3xl w-full border border-border-mute/80 rounded-2xl mt-16 mx-auto overflow-hidden divide-x divide-y md:divide-y-0 divide-border-mute/60">
          <Metric value={99.8} suffix="%" decimals={1} label="System Uptime" />
          <Metric value={5} prefix="< " suffix=" Sec" label="OCR Ingest Speed" />
          <Metric value={94.2} suffix="%" decimals={1} label="Anomaly Accuracy" />
          <Metric value={-40} suffix="%" label="Maintenance Cost" />
        </div>
      </div>
    </section>
  );
}
