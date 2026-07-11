"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Play, Pause, MonitorPlay } from "lucide-react";

export interface DemoStep {
  id: number;
  section: string;          // display label
  scrollTarget: string;     // CSS selector to scroll to
  title: string;
  explanation: string;
  badge?: string;           // optional coloured badge label
  badgeColor?: string;      // tailwind text colour class
}

const STEPS: DemoStep[] = [
  {
    id: 1,
    section: "Hero",
    scrollTarget: "body",
    title: "Welcome to PFMI.ai",
    badge: "Overview",
    badgeColor: "text-emerald-500",
    explanation:
      "PFMI stands for Predictive Failure & Maintenance Intelligence. This platform combines real-time sensor telemetry, OCR-scanned maintenance logs, and machine learning models to predict when industrial machines will fail — before it happens. The four metrics you see (99.8% uptime, <5s OCR ingest, 94.2% anomaly accuracy, -40% maintenance cost) are the core value proposition.",
  },
  {
    id: 2,
    section: "AI Simulator",
    scrollTarget: "#anomaly-simulator",
    title: "Live AI Anomaly Simulator",
    badge: "Interactive",
    badgeColor: "text-indigo-500",
    explanation:
      "This is a live demo of the ML inference engine. Three presets simulate real industrial failure scenarios: Normal Baseline shows healthy sensor readings, Thermal Spike simulates a cooling block failure pushing temperature above 90°C, and Bearing Friction Wave simulates mechanical misalignment via vibration spikes. Watch how the RUL (Remaining Useful Life) countdown drops and the alert bar fires automatically — this is exactly how the production system behaves.",
  },
  {
    id: 3,
    section: "Features",
    scrollTarget: "#features",
    title: "Platform Feature Set",
    badge: "Toolkit",
    badgeColor: "text-amber-500",
    explanation:
      "Six core modules make up the PFMI platform. The Telemetry Dashboard monitors all machines in real-time. The Predictive AI Inference engine runs continuous RUL forecasting. The OCR Pipeline digitises paper logbooks in under 5 seconds. Smart Alert Priority dispatches notifications ranked by operational severity. The Maintenance Calendar schedules repairs based on wear data, not timestamps. And the Flexible IoT Ingestion API connects any sensor stream via JSON.",
  },
  {
    id: 4,
    section: "How It Works",
    scrollTarget: "#how-it-works",
    title: "Three-Step Operational Pipeline",
    badge: "Protocol",
    badgeColor: "text-teal-500",
    explanation:
      "The entire workflow is three steps. Step 1 — Ingest: upload a photo of a paper maintenance form or pipe in live sensor data via the API. Step 2 — Process: the ML engine computes anomaly scores and RUL forecasts from the combined data. Step 3 — Act: technicians receive prioritised alerts and an auto-generated maintenance schedule before any failure occurs. No reactive repairs.",
  },
  {
    id: 5,
    section: "Prediction Engine",
    scrollTarget: "#stats",
    title: "Diagnostic Precision Cards",
    badge: "Engine",
    badgeColor: "text-rose-500",
    explanation:
      "These three cards represent the technical depth of PFMI's prediction engine. OCR Log Ingestion converts handwritten notes into indexed database records in 3 seconds. The Anomaly Analysis Engine scans vibration, thermal, and pressure streams for micro-deviations. The RUL Forecasting Model outputs an exact remaining useful life score per component — enabling predictive scheduling that aligns maintenance with actual physical wear, not calendar dates.",
  },
  {
    id: 6,
    section: "Dashboard",
    scrollTarget: "#cta",
    title: "Fleet Dashboard",
    badge: "Live System",
    badgeColor: "text-blue-500",
    explanation:
      "Clicking 'Launch Fleet Dashboard' takes you to the live control room. You'll see real equipment nodes with health scores, an active alert priority queue, and per-machine telemetry inspection. Alerts can be resolved in one click. The dashboard connects to a Supabase database in production — for this demo it runs with mock data so you can explore all functionality without a live sensor network.",
  },
];

interface DemoGuideProps {
  activeStep: number | null;
  onStepChange: (step: number | null) => void;
}

export default function DemoGuide({ activeStep, onStepChange }: DemoGuideProps) {
  const [open, setOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [minimised, setMinimised] = useState(false);

  const currentStep = activeStep !== null ? STEPS[activeStep] : null;
  const isFirst = activeStep === 0;
  const isLast = activeStep === STEPS.length - 1;

  // Scroll to section
  const scrollTo = useCallback((selector: string) => {
    if (selector === "body") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.querySelector(selector);
    if (el) {
      const offset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  // Go to a specific step
  const goTo = useCallback(
    (idx: number) => {
      onStepChange(idx);
      scrollTo(STEPS[idx].scrollTarget);
    },
    [onStepChange, scrollTo]
  );

  const startDemo = () => {
    setOpen(true);
    setMinimised(false);
    goTo(0);
  };

  const closeDemo = () => {
    setOpen(false);
    setAutoPlay(false);
    onStepChange(null);
  };

  const next = useCallback(() => {
    if (activeStep === null) return;
    if (isLast) { closeDemo(); return; }
    goTo(activeStep + 1);
  }, [activeStep, isLast, goTo]);

  const prev = () => {
    if (activeStep === null || isFirst) return;
    goTo(activeStep - 1);
  };

  // Auto-play timer (12s per step)
  useEffect(() => {
    if (!autoPlay || !open) return;
    const timer = setTimeout(() => next(), 12000);
    return () => clearTimeout(timer);
  }, [autoPlay, open, activeStep, next]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") closeDemo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, next]);

  return (
    <>
      {/* Trigger Button — always visible */}
      {!open && (
        <button
          onClick={startDemo}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-3 text-xs font-bold shadow-lg hover:bg-foreground/90 hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <MonitorPlay className="h-4 w-4" />
          Start Demo
        </button>
      )}

      {/* Floating Guide Panel */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border-mute bg-surface/95 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition-all duration-300 ${
            minimised ? "h-14 overflow-hidden" : ""
          }`}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border-mute shrink-0">
            <div className="flex items-center gap-2">
              <MonitorPlay className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-[11px] font-bold font-mono uppercase tracking-widest text-text-muted">
                Demo Guide
              </span>
              {currentStep && (
                <span className="text-[9px] font-mono text-text-muted">
                  {activeStep! + 1}/{STEPS.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Auto-play toggle */}
              <button
                onClick={() => setAutoPlay((p) => !p)}
                title={autoPlay ? "Pause auto-advance" : "Auto-advance every 12s"}
                className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              {/* Minimise */}
              <button
                onClick={() => setMinimised((p) => !p)}
                className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs font-bold"
                title={minimised ? "Expand" : "Minimise"}
              >
                {minimised ? "▲" : "▼"}
              </button>
              {/* Close */}
              <button
                onClick={closeDemo}
                className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!minimised && currentStep && (
            <>
              {/* Step dots */}
              <div className="flex items-center gap-1.5 px-4 pt-4">
                {STEPS.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => goTo(i)}
                    title={s.section}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === activeStep
                        ? "w-6 bg-foreground"
                        : i < activeStep!
                        ? "w-1.5 bg-zinc-400 dark:bg-zinc-600"
                        : "w-1.5 bg-border-mute"
                    }`}
                  />
                ))}
              </div>

              {/* Content */}
              <div className="px-4 pt-3 pb-4 space-y-3">
                {/* Section label + badge */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted">
                    {currentStep.section}
                  </span>
                  {currentStep.badge && (
                    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-current/20 bg-current/5 ${currentStep.badgeColor}`}>
                      {currentStep.badge}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-extrabold text-foreground leading-tight">
                  {currentStep.title}
                </h3>

                {/* Explanation */}
                <p className="text-[12px] text-text-muted leading-relaxed">
                  {currentStep.explanation}
                </p>

                {/* Auto-play progress bar */}
                {autoPlay && (
                  <div className="w-full h-0.5 bg-border-mute rounded-full overflow-hidden">
                    <div
                      key={`${activeStep}-${autoPlay}`}
                      className="h-full bg-foreground rounded-full"
                      style={{
                        animation: "demo-progress 12s linear forwards",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Navigation footer */}
              <div className="flex items-center justify-between px-4 pb-4">
                <button
                  onClick={prev}
                  disabled={isFirst}
                  className="flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>

                {/* Section jump */}
                <select
                  value={activeStep ?? 0}
                  onChange={(e) => goTo(Number(e.target.value))}
                  className="text-[10px] font-mono text-text-muted bg-transparent border-0 outline-none cursor-pointer hover:text-foreground transition-colors"
                >
                  {STEPS.map((s, i) => (
                    <option key={s.id} value={i}>
                      {i + 1}. {s.section}
                    </option>
                  ))}
                </select>

                <button
                  onClick={next}
                  className="flex items-center gap-1 text-[11px] font-bold text-foreground hover:text-foreground/70 transition-colors"
                >
                  {isLast ? "Finish" : "Next"}
                  {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Auto-play keyframe injected inline */}
      <style>{`
        @keyframes demo-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </>
  );
}
