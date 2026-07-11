"use client";
import { useEffect, useState } from "react";
import type { Alert } from "@/lib/db";

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
      // fallback: still close
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
        className="w-full max-w-lg bg-surface-container-lowest border border-error-container rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Emergency Alert"
      >
        {/* Shimmer header */}
        <div
          className={`${isCritical ? "emergency-shimmer" : "bg-tertiary-container"} h-10 flex items-center px-5 gap-3`}
        >
          <span className="material-symbols-outlined text-on-error-container text-xl">
            emergency
          </span>
          <span className="font-label font-bold text-label-md tracking-widest uppercase text-on-error-container">
            {isCritical ? "CRITICAL ALERT — IMMEDIATE ACTION REQUIRED" : `${alert.severity.toUpperCase()} SEVERITY ALERT`}
          </span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Equipment + severity */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-label-sm font-label uppercase tracking-wider text-on-surface-variant">
                Affected Unit
              </p>
              <p className="text-headline-md font-headline font-semibold text-on-surface mt-1">
                {alert.equipmentName}
              </p>
              <p className="text-body-sm font-body text-on-surface-variant mt-0.5">
                ID: {alert.equipment_id}
              </p>
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg text-label-sm font-label font-bold tracking-wider uppercase ${
                isCritical
                  ? "bg-error-container text-on-error-container"
                  : "bg-tertiary-fixed text-on-tertiary-fixed-variant"
              }`}
            >
              {alert.severity}
            </div>
          </div>

          {/* Alert message */}
          <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant">
            <p className="text-label-sm font-label uppercase tracking-wider text-on-surface-variant mb-1">
              Alert Detail
            </p>
            <p className="text-body-lg font-body text-on-surface">{alert.message}</p>
          </div>

          {/* Alert ID / timestamp */}
          <div className="grid grid-cols-2 gap-4 text-body-sm font-label">
            <div>
              <p className="text-on-surface-variant text-label-sm uppercase tracking-wider mb-1">Alert ID</p>
              <p className="text-on-surface font-bold">{alert.id}</p>
            </div>
            {alert.created_at && (
              <div>
                <p className="text-on-surface-variant text-label-sm uppercase tracking-wider mb-1">Raised At</p>
                <p className="text-on-surface font-bold">
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
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-container-high text-on-surface-variant font-label font-bold text-label-sm tracking-wider">
                <span className="material-symbols-outlined text-base">check_circle</span>
                RESOLVED
              </div>
            ) : (
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex-1 bg-secondary text-on-secondary font-label font-bold py-2.5 rounded-lg text-label-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resolving ? (
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-base">check_circle</span>
                )}
                MARK RESOLVED
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 bg-surface-container-high text-on-surface-variant font-label font-bold py-2.5 rounded-lg text-label-sm tracking-wider hover:bg-surface-container-highest transition-colors"
            >
              DISMISS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
