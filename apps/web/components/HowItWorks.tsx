"use client";

import { UploadCloud, Activity, Bell } from "lucide-react";

const STEPS = [
  {
    step: "01",
    title: "Ingest Logs & Connect Data",
    description:
      "Upload scans/photos of paper maintenance forms via OCR or plug in telemetry metrics directly using our API.",
    icon: UploadCloud,
    tag: "input",
  },
  {
    step: "02",
    title: "Real-Time AI Processing",
    description:
      "Our machine learning engine processes wear metrics to predict Remaining Useful Life (RUL) and detect sensor anomalies.",
    icon: Activity,
    tag: "inference",
  },
  {
    step: "03",
    title: "Dispatch Actionable Alerts",
    description:
      "Get prioritized schedules and auto-notifications before a fault happens — saving up to 40% in maintenance costs.",
    icon: Bell,
    tag: "action",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 md:py-32 border-b border-border-mute bg-surface" id="how-it-works">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 reveal">
          <span className="text-[10px] font-bold tracking-widest uppercase text-text-muted font-mono block mb-2">
            Simple Protocol
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
            Operational in three simple steps
          </h2>
          <p className="text-sm text-text-muted mt-2">
            PFMI unifies raw telemetry and paper logs into a single predictive action pipeline.
          </p>
        </div>

        {/* Desktop pipeline */}
        <div className="hidden md:block relative mt-16">
          {/* Animated connector line running through the step nodes */}
          <svg
            className="absolute left-0 right-0 top-6 w-full h-px overflow-visible"
            aria-hidden="true"
          >
            <line
              x1="16.66%" y1="0.5" x2="83.33%" y2="0.5"
              stroke="var(--border-mute)" strokeWidth="1.5"
            />
            <line
              x1="16.66%" y1="0.5" x2="83.33%" y2="0.5"
              stroke="#10b981" strokeWidth="1.5" opacity="0.6"
              className="flow-dash"
            />
          </svg>

          <div className="grid grid-cols-3 gap-8">
            {STEPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className={`reveal stagger-${idx + 1} flex flex-col items-center text-center`}>
                  {/* Node */}
                  <div className="relative z-10 flex items-center justify-center h-12 w-12 rounded-2xl border border-emerald-500/25 bg-surface shadow-sm">
                    <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                  </div>

                  <span className="mt-5 text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-500">
                    {item.step} · {item.tag}
                  </span>
                  <h3 className="mt-2 text-sm font-bold text-foreground tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-xs text-xs text-text-muted leading-relaxed">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile timeline */}
        <div className="md:hidden flex flex-col gap-2 relative mt-10 pl-2 pr-2">
          {/* Connecting line */}
          <div className="absolute left-6 top-8 bottom-8 w-[1px] bg-border-mute/60" />

          {STEPS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex gap-4 py-4 relative z-10 transition-transform duration-300 hover:translate-x-1"
              >
                {/* Circle Icon */}
                <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border border-border-mute/60 bg-surface dark:bg-zinc-900 shadow-sm">
                  <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                </div>

                {/* Content Card */}
                <div className="flex-1 bg-surface/30 dark:bg-zinc-900/10 border border-border-mute/80 p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
                  <span className="text-[9px] font-bold uppercase tracking-widest mb-1 block font-mono text-emerald-600 dark:text-emerald-500">
                    Step {item.step}
                  </span>
                  <h3 className="text-xs font-bold mb-1 text-foreground tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed text-text-muted">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
