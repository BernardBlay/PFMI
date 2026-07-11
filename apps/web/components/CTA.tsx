"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section className="relative py-20 bg-background overflow-hidden border-b border-border-mute">
      <div
        className="hero-orb"
        style={{
          width: 350, height: 350,
          background: "radial-gradient(circle, #059669 0%, transparent 70%)",
          bottom: "-10%", left: "30%",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center space-y-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground font-sans sm:text-4xl">
          Transform your maintenance operations today
        </h2>
        <p className="text-sm text-text-muted max-w-lg mx-auto">
          Join facilities using PFMI to predict mechanical breakdowns, decrease downtime, and cut maintenance costs.
        </p>
        <div className="pt-4">
          <Link
            href="/dashboard"
            className="btn-primary-shimmer inline-flex items-center justify-center gap-2 rounded bg-foreground px-8 py-3 text-sm font-bold text-background transition-all hover:bg-foreground/90 hover:scale-[1.03] active:scale-[0.98]"
          >
            Launch Fleet Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider pt-2">
          No installation required • Built for Build Weekend 1.0
        </p>
      </div>
    </section>
  );
}
