"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

export default function Hero() {
  const router = useRouter();

  const handleOCRClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      router.push("/login");
    } else {
      router.push("/ocr-upload");
    }
  };

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
          <button
            onClick={handleOCRClick}
            className="flex items-center justify-center rounded border border-border-mute bg-surface px-6 py-3 text-sm font-medium text-text-muted transition-all hover:bg-background hover:text-foreground hover:border-zinc-400 dark:hover:border-zinc-650 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 mr-2" />
            Ingest Logs (OCR)
          </button>
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
