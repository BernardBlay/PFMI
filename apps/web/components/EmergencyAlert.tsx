"use client";

import { useEffect, useState } from "react";
import type { Alert } from "@/lib/db";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  alert: Alert | null;
  onClose: () => void;
  onResolved: () => void;
}

export default function EmergencyAlert({ alert, onClose, onResolved }: Props) {
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false);

  // Reset state when alert changes
  useEffect(() => {
    setResolved(false);
    setResolving(false);
  }, [alert?.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!alert) return null;

  const isCritical = alert.severity === "Critical";

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert.id }),
      });
      if (res.ok) {
        setResolved(true);
        setTimeout(() => {
          onResolved();
          onClose();
        }, 1200);
      }
    } catch {
      // fallback
      onResolved();
      onClose();
    } finally {
      setResolving(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-border-mute rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Emergency Alert"
      >
        {/* Header */}
        <div
          className={`h-12 flex items-center px-5 gap-3 ${
            isCritical ? "bg-red-500 text-white" : "bg-amber-500 text-black"
          }`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
            {isCritical ? "CRITICAL ALERT — IMMEDIATE ACTION REQUIRED" : `${alert.severity.toUpperCase()} SEVERITY ALERT`}
          </span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Affected equipment details */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                Affected Unit
              </p>
              <p className="text-base font-bold text-foreground mt-1">
                {alert.equipmentName}
              </p>
              <p className="text-[10px] font-mono text-text-muted mt-0.5">
                ID: {alert.equipment_id}
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${
                isCritical
                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}
            >
              {alert.severity}
            </div>
          </div>

          {/* Alert Message Box */}
          <div className="bg-background rounded-xl p-4 border border-border-mute">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted mb-1">
              Alert Detail
            </p>
            <p className="text-xs leading-relaxed text-foreground">{alert.message}</p>
          </div>

          {/* Alert metadata */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-text-muted text-[10px] font-mono font-bold uppercase tracking-wider mb-1">Alert ID</p>
              <p className="text-foreground font-mono font-bold">{alert.id}</p>
            </div>
            {alert.created_at && (
              <div>
                <p className="text-text-muted text-[10px] font-mono font-bold uppercase tracking-wider mb-1">Raised At</p>
                <p className="text-foreground font-bold">
                  {new Date(alert.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {resolved ? (
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-background text-text-muted font-bold text-xs tracking-wider border border-border-mute">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                RESOLVED
              </div>
            ) : (
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex-1 bg-foreground text-background font-bold py-2.5 rounded-lg text-xs tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {resolving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                MARK RESOLVED
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 bg-background border border-border-mute text-text-muted hover:text-foreground font-bold py-2.5 rounded-lg text-xs tracking-wider transition-colors cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
