"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section className="relative py-20 bg-background overflow-hidden border-b border-border-mute">
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="reveal-scale relative overflow-hidden rounded-[2rem] border border-border-mute bg-surface/60 px-6 py-16 sm:px-16 text-center">
          {/* Panel backdrop: blueprint grid + emerald bloom */}
          <div className="pointer-events-none absolute inset-0 mc-grid-bg opacity-60" />
          <div
            className="pointer-events-none absolute -bottom-32 left-1/2 -translate-x-1/2 h-64 w-[36rem] rounded-full blur-3xl opacity-20"
            style={{ background: "#059669" }}
          />

          <div className="relative space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Fleet intelligence, live in minutes
            </span>

            <h2 className="text-3xl font-extrabold tracking-tight text-foreground font-sans sm:text-4xl max-w-2xl mx-auto">
              Transform your maintenance operations today
            </h2>
            <p className="text-sm text-text-muted max-w-lg mx-auto">
              Join facilities using PFMI to predict mechanical breakdowns, decrease downtime, and cut maintenance costs.
            </p>
            <div className="pt-4">
              <Link
                href="/dashboard"
                className="btn-primary-shimmer inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-bold text-background transition-all hover:bg-foreground/90 hover:scale-[1.03] active:scale-[0.98]"
              >
                Launch Fleet Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider pt-2">
              No installation required • Built for Build Weekend 1.0
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
