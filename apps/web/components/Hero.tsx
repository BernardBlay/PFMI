"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative border-b border-border-mute bg-background/30 py-20 md:py-32 overflow-hidden">
      {/* Floating gradient orbs */}
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
          background: "radial-gradient(circle, #2563eb 0%, transparent 70%)",
          bottom: "-10%", right: "5%",
          animationDelay: "4s",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 flex flex-col items-center text-center">
        {/* Minimalist Monospace Badge */}
        <span className="hero-animate hero-animate-delay-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-mono mb-4 block">
          Hybrid Predictive Maintenance
        </span>

        <h1 className="hero-animate hero-animate-delay-2 max-w-4xl font-sans text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground leading-[1.1] transition-transform duration-500 hover:scale-[1.01]">
          Predict machine failures.<br />Before they disrupt operations.
        </h1>

        <p className="hero-animate hero-animate-delay-3 max-w-2xl text-base sm:text-lg text-text-muted mt-6 leading-relaxed">
          Stop reacting to downtime. PFMI integrates time-series sensor telemetry, OCR maintenance logs, and machine learning models to forecast remaining useful life and dispatch automated alerts.
        </p>

        <div className="hero-animate hero-animate-delay-4 flex flex-col sm:flex-row gap-3 mt-10">
          <Link
            href="/dashboard"
            className="btn-primary-shimmer flex items-center justify-center gap-2 rounded bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:bg-foreground/90 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
          >
            Launch Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/ocr-upload"
            className="flex items-center justify-center rounded border border-border-mute bg-surface px-6 py-3 text-sm font-medium text-text-muted transition-all hover:bg-background hover:text-foreground hover:border-zinc-400 dark:hover:border-zinc-650 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 mr-2" />
            Ingest Logs (OCR)
          </Link>
        </div>

        {/* Metrics Bar */}
        <div className="hero-animate hero-animate-delay-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 max-w-4xl w-full border-t border-border-mute/80 mt-16 pt-8 text-left">
          <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-4 sm:gap-1 transition-all duration-300 hover:translate-x-1 border-b border-border-mute/30 sm:border-0 pb-4 sm:pb-0">
            <span className="text-3xl font-extrabold text-foreground tracking-tight shrink-0 min-w-[80px]">99.8%</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted font-mono leading-normal text-right sm:text-left">System Uptime</span>
          </div>
          <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-4 sm:gap-1 transition-all duration-300 hover:translate-x-1 border-b border-border-mute/30 sm:border-0 pb-4 sm:pb-0">
            <span className="text-3xl font-extrabold text-foreground tracking-tight shrink-0 min-w-[80px]">&lt; 5 Sec</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted font-mono leading-normal text-right sm:text-left">OCR Ingest Speed</span>
          </div>
          <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-4 sm:gap-1 transition-all duration-300 hover:translate-x-1 border-b border-border-mute/30 sm:border-0 pb-4 sm:pb-0">
            <span className="text-3xl font-extrabold text-foreground tracking-tight shrink-0 min-w-[80px]">94.2%</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted font-mono leading-normal text-right sm:text-left">Anomaly Accuracy</span>
          </div>
          <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-4 sm:gap-1 transition-all duration-300 hover:translate-x-1 pb-4 sm:pb-0">
            <span className="text-3xl font-extrabold text-foreground tracking-tight shrink-0 min-w-[80px]">-40%</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted font-mono leading-normal text-right sm:text-left">Maintenance Cost</span>
          </div>
        </div>
      </div>
    </section>
  );
}
