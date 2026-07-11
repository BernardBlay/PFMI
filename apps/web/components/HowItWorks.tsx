"use client";

import { UploadCloud, Activity, Bell } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Ingest Logs & Connect Data",
      description: "Upload scans/photos of paper maintenance forms via OCR or plug in telemetry metrics directly using our API.",
      icon: UploadCloud,
      accentColor: "#10b981",
    },
    {
      step: "02",
      title: "Real-Time AI Processing",
      description: "Our machine learning engine processes wear metrics to predict Remaining Useful Life (RUL) and detect sensor anomalies.",
      icon: Activity,
      accentColor: "#6366f1",
    },
    {
      step: "03",
      title: "Dispatch Actionable Alerts",
      description: "Get prioritized schedules and auto-notifications before a fault happens — saving up to 40% in maintenance costs.",
      icon: Bell,
      accentColor: "#f59e0b",
    },
  ];

  return (
    <section className="py-20 md:py-32 border-b border-border-mute bg-surface" id="how-it-works">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
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

        {/* Steps Grid (Desktop-only) */}
        <div className="hidden md:grid grid-cols-3 gap-6 md:gap-8 mt-12">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                className="reveal stagger-1 group relative p-8 rounded-3xl border border-border-mute/80 bg-surface/30 dark:bg-zinc-900/10 transition-all duration-300 hover:border-zinc-350 dark:hover:border-zinc-800 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.02)]"
              >
                <span className="text-4xl font-extrabold font-mono text-foreground/5 dark:text-foreground/10 absolute right-6 top-6 transition-opacity group-hover:opacity-75">
                  {item.step}
                </span>
                <div 
                  className="inline-flex p-3 rounded-2xl mb-6 transition-all group-hover:scale-105"
                  style={{ backgroundColor: `${item.accentColor}10`, color: item.accentColor, borderColor: `${item.accentColor}20`, borderWidth: 1 }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <p className="text-xs text-text-muted mt-2 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Mobile Timeline (Mobile-only) */}
        <div className="md:hidden flex flex-col gap-2 relative mt-10 pl-2 pr-2">
          {/* Connecting line */}
          <div className="absolute left-6 top-8 bottom-8 w-[1px] bg-border-mute/60" />

          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex gap-4 py-4 relative z-10 transition-transform duration-300 hover:translate-x-1"
              >
                {/* Circle Icon */}
                <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border border-border-mute/60 bg-surface dark:bg-zinc-900 text-foreground shadow-sm">
                  <Icon className="w-5 h-5" style={{ color: item.accentColor }} />
                </div>

                {/* Content Card */}
                <div className="flex-1 bg-surface/30 dark:bg-zinc-900/10 border border-border-mute/80 p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
                  <span className="text-[9px] font-bold uppercase tracking-widest mb-1 block font-mono" style={{ color: item.accentColor }}>
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
