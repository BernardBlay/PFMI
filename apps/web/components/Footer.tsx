"use client";

import Link from "next/link";
import { Cpu } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border-mute bg-surface py-12 mt-auto no-print">
      <div className="mx-auto max-w-7xl px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {/* Column 1: Brand */}
        <div className="col-span-2 md:col-span-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 flex items-center justify-center rounded bg-foreground text-background border border-zinc-200 dark:border-zinc-800">
              <Cpu className="h-3.5 w-3.5" />
            </div>
            <span className="font-sans font-bold tracking-tight text-foreground text-sm">
              PFMI<span className="text-zinc-400 font-normal">.ai</span>
            </span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed max-w-xs">
            Hybrid Preventive Maintenance Intelligence. Connect sensor streams, ingest logs via OCR, and forecast remaining useful component life.
          </p>
        </div>

        {/* Column 2: Platform */}
        <div className="col-span-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground font-mono mb-3">
            Platform
          </h4>
          <ul className="space-y-2 text-[11px] text-text-muted">
            <li>
              <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
            </li>
            <li>
              <Link href="/#how-it-works" className="hover:text-foreground transition-colors">Protocol</Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Resources */}
        <div className="col-span-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground font-mono mb-3">
            Resources
          </h4>
          <ul className="space-y-2 text-[11px] text-text-muted">
            <li>
              <Link href="/ocr-upload" className="hover:text-foreground transition-colors">OCR Ingestion</Link>
            </li>
            <li>
              <a href="#" className="hover:text-foreground transition-colors">API Docs</a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground transition-colors">Schema Definition</a>
            </li>
          </ul>
        </div>

        {/* Column 4: Project Info */}
        <div className="col-span-2 sm:col-span-1 md:col-span-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground font-mono mb-3">
            Project
          </h4>
          <ul className="space-y-2 text-[11px] text-text-muted">
            <li>
              <span className="block font-medium text-foreground">Hackathon:</span>
              <span className="text-text-muted">Build Weekend 1.0</span>
            </li>
            <li>
              <span className="block font-medium text-foreground mt-1">Repository:</span>
              <a href="https://github.com/BernardBlay/PFMI" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                github.com/PFMI
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 border-t border-border-mute pt-6 mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-[10px] text-text-muted">
          © {new Date().getFullYear()} PFMI.ai. Structured for industrial operations.
        </span>
        <span className="text-[9px] text-text-muted font-mono">
          Model v1.0.0 • Cloud
        </span>
      </div>
    </footer>
  );
}
