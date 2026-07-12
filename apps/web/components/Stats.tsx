"use client";

import { Cpu, Layers, TrendingUp, CheckCircle2 } from "lucide-react";

interface DiagnosticCard {
  title: string;
  badge: string;
  description: string;
  bullets: string[];
  icon: any;
  colorClass: string;
}

export default function Stats() {
  const cards: DiagnosticCard[] = [
    {
      title: "OCR Log Ingestion",
      badge: "Log Processing",
      description: "Converts handwritten or scanned physical technician notes into clean, indexed database records instantly, removing manual clerical overhead.",
      bullets: [
        "Ingest to structured form in 3s",
        "Automatic entity parsing",
        "Digital historical archiving"
      ],
      icon: Layers,
      colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Anomaly Analysis Engine",
      badge: "Telemetry Processing",
      description: "Constantly monitors incoming voltage, vibration, pressure, and temperature telemetry streams to detect micro-deviations before they lead to hardware failures.",
      bullets: [
        "Vibration trend tracking",
        "Thermal deviation scanning",
        "Fast 94.2% model confidence"
      ],
      icon: Cpu,
      colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "RUL Forecasting Model",
      badge: "Lifetime Calculations",
      description: "Generates wear trajectory forecasts that output an exact Remaining Useful Life (RUL) score, aligning scheduled downtime with the physical condition of the hardware.",
      bullets: [
        "Live component wear mapping",
        "Predictive repair scheduling",
        "Dynamic threshold adaptation"
      ],
      icon: TrendingUp,
      colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    }
  ];

  return (
    <section className="py-20 md:py-32 border-b border-border-mute bg-background/50" id="stats">
      <div className="mx-auto max-w-6xl px-6">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] font-bold tracking-widest uppercase text-text-muted font-mono block">
              PFMI Prediction Engine
            </span>
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground font-sans mt-3">
              Diagnostic Precision. Machine Protection.
            </h3>
            <p className="text-xs md:text-sm text-text-muted mt-3 max-w-xl mx-auto leading-relaxed">
              PFMI bypasses simple timestamp alerts. Our models combine live telemetry and historical OCR logs to compute machine wear trajectories.
            </p>
          </div>

          {/* 3-Column Elegant Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {cards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div 
                  key={idx}
                  className="group relative p-8 rounded-3xl border border-border-mute/80 bg-surface/30 dark:bg-zinc-900/10 shadow-[0_8px_30px_rgba(0,0,0,0.01)] transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-800 hover:-translate-y-1 hover:shadow-md"
                >
                  {/* Icon badge */}
                  <div className={`inline-flex p-3 rounded-2xl border mb-6 transition-all group-hover:scale-105 ${card.colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Title & Badge */}
                  <div className="space-y-1 mb-4">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted font-mono">
                      {card.badge}
                    </span>
                    <h4 className="text-base font-bold text-foreground font-sans tracking-tight">
                      {card.title}
                    </h4>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-muted leading-relaxed mb-6">
                    {card.description}
                  </p>

                  {/* Bullets */}
                  <ul className="space-y-2 border-t border-border-mute/60 pt-6">
                    {card.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
      </div>
    </section>
  );
}
