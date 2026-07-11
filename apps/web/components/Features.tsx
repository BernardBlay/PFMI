"use client";

import { Cpu, Activity, Layers, Bell, ShieldCheck, Database } from "lucide-react";

export default function Features() {
  const items = [
    {
      title: "Smart Telemetry Dashboard",
      description: "Real-time health overview for all machines. Monitor temperature, vibrations, pressure, and voltage at a glance.",
      icon: Cpu,
      accentColor: "emerald"
    },
    {
      title: "Predictive AI Inference",
      description: "Machine learning models analyze sensor telemetry to forecast Remaining Useful Life (RUL) and anomaly probability.",
      icon: Activity,
      accentColor: "indigo"
    },
    {
      title: "OCR Data Entry Pipeline",
      description: "Upload scans or photos of manual logbooks. The OCR engine digitizes and extracts service notes automatically.",
      icon: Layers,
      accentColor: "amber"
    },
    {
      title: "Smart Alert Priority",
      description: "Instantly notifies technicians when sensor levels breach custom variance parameters, prioritized by operational severity.",
      icon: Bell,
      accentColor: "rose"
    },
    {
      title: "Automated Maintenance Calendar",
      description: "Forecasts optimal maintenance windows based on wear trends rather than simple timestamps, reducing costly downtime.",
      icon: ShieldCheck,
      accentColor: "teal"
    },
    {
      title: "Flexible IoT Ingestion",
      description: "Connect virtual or physical machinery streams via robust JSON telemetry APIs designed for secure, industrial-scale pipelines.",
      icon: Database,
      accentColor: "cyan"
    }
  ];

  return (
    <section className="py-20 md:py-32 bg-background/50 border-b border-border-mute" id="features">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
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

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {items.map((item, idx) => {
            const Icon = item.icon;
            
            // Map colors to match design
            const borderColors = {
              emerald: "emerald-500/20 text-emerald-500 bg-emerald-500/10",
              indigo: "indigo-500/20 text-indigo-500 bg-indigo-500/10",
              amber: "amber-500/20 text-amber-500 bg-amber-500/10",
              rose: "rose-500/20 text-rose-500 bg-rose-500/10",
              teal: "teal-500/20 text-teal-500 bg-teal-500/10",
              cyan: "cyan-500/20 text-cyan-500 bg-cyan-500/10",
            }[item.accentColor];

            return (
              <div 
                key={idx}
                className="group relative p-8 rounded-3xl border border-border-mute/80 bg-surface/30 dark:bg-zinc-900/10 shadow-[0_8px_30px_rgba(0,0,0,0.01)] transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-800 hover:-translate-y-1 hover:shadow-md"
              >
                {/* Icon wrapper */}
                <div className={`inline-flex p-3 rounded-2xl border mb-6 transition-all group-hover:scale-105 ${borderColors}`}>
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="text-sm font-bold text-foreground font-sans tracking-tight mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
