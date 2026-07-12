"use client";

import { useEffect, useState } from "react";
import { Brain, Wifi, WifiOff, Database } from "lucide-react";

interface PredictResult {
  source: "ml" | "ml_offline" | "no_data";
  prediction: string | null;
  confidence: number | null;
  rul_days: number | null;
  health_score: number | null;
  status: string | null;
  failure_modes: string[];
  sensor_used: {
    temperature: number;
    vibration: number;
    pressure: number;
  } | null;
}

function rulColor(days: number | null): string {
  if (days === null) return "text-text-muted";
  if (days >= 120) return "text-emerald-500";
  if (days >= 30) return "text-amber-500";
  return "text-red-500";
}

function SourceBadge({ source }: { source: PredictResult["source"] }) {
  if (source === "ml") {
    return (
      <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
        <Wifi className="h-2.5 w-2.5" />
        Live ML
      </span>
    );
  }
  if (source === "ml_offline") {
    return (
      <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
        <WifiOff className="h-2.5 w-2.5" />
        ML Offline
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
      <Database className="h-2.5 w-2.5" />
      No Data
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-surface border border-border-mute rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-4 w-4 rounded bg-border-mute/60" />
        <div className="h-3 w-48 rounded bg-border-mute/60" />
        <div className="ml-auto h-5 w-16 rounded-full bg-border-mute/60" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="h-10 w-24 rounded bg-border-mute/60" />
          <div className="h-3 w-20 rounded bg-border-mute/40" />
        </div>
        <div className="space-y-3">
          <div className="h-3 w-28 rounded bg-border-mute/60" />
          <div className="h-1.5 w-full rounded-full bg-border-mute/40" />
          <div className="h-5 w-16 rounded-full bg-border-mute/40" />
        </div>
      </div>
    </div>
  );
}

export default function RULPanel({ equipmentId }: { equipmentId: string }) {
  const [result, setResult] = useState<PredictResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/predict/${equipmentId}`)
      .then((r) => r.json())
      .then((data) => setResult(data))
      .catch(() =>
        setResult({
          source: "ml_offline",
          prediction: null,
          confidence: null,
          rul_days: null,
          health_score: null,
          status: null,
          failure_modes: [],
          sensor_used: null,
        })
      )
      .finally(() => setLoading(false));
  }, [equipmentId]);

  if (loading) return <LoadingSkeleton />;
  if (!result) return null;

  const { source, prediction, confidence, rul_days, sensor_used } = result;

  const isUnavailable = source === "ml_offline" || source === "no_data";

  return (
    <div className="bg-surface border border-border-mute rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border-mute flex items-center gap-2 bg-background/40">
        <Brain className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted">
          ML Inference · Remaining Useful Life
        </span>
        <div className="ml-auto">
          <SourceBadge source={source} />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {isUnavailable ? (
          <div className="flex items-center gap-2 py-2 text-text-muted">
            {source === "no_data" ? (
              <p className="text-xs font-mono">No sensor data available for this unit — inference skipped.</p>
            ) : (
              <p className="text-xs font-mono">ML service offline — connect the Python service to enable inference.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1 items-start">
            {/* Left: RUL number */}
            <div className="flex flex-col justify-center py-1">
              <span className={`text-4xl font-black font-mono leading-none ${rulColor(rul_days)}`}>
                {rul_days ?? "—"}
              </span>
              <span className="text-[10px] font-mono text-text-muted mt-1 uppercase tracking-widest">
                days remaining
              </span>
            </div>

            {/* Right: failure mode + confidence */}
            <div className="space-y-3 pt-1">
              {/* Failure mode */}
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-0.5">
                  Failure Mode
                </p>
                <p className="text-xs font-bold text-foreground font-mono">
                  {prediction ?? "—"}
                </p>
              </div>

              {/* Confidence bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted">
                    Confidence
                  </p>
                  <span className="text-[9px] font-mono font-bold text-foreground">
                    {confidence !== null ? `${(confidence * 100).toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-border-mute/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                    style={{ width: confidence !== null ? `${(confidence * 100).toFixed(0)}%` : "0%" }}
                  />
                </div>
              </div>

              {/* Status chip */}
              {result.status && (
                <div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                    result.status === "Healthy"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : result.status === "Warning"
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      : "bg-red-500/10 text-red-500 border-red-500/20"
                  }`}>
                    {result.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: sensor snapshot */}
      {sensor_used && (
        <div className="px-5 py-2.5 border-t border-border-mute/60 bg-background/20">
          <p className="text-[9px] font-mono text-text-muted">
            Sensor snapshot used for inference &nbsp;·&nbsp;
            <span className="text-foreground">temp {sensor_used.temperature.toFixed(1)}°</span>
            &nbsp;·&nbsp;
            <span className="text-foreground">vib {sensor_used.vibration.toFixed(2)} mm/s</span>
            &nbsp;·&nbsp;
            <span className="text-foreground">press {sensor_used.pressure.toFixed(2)} bar</span>
          </p>
        </div>
      )}
    </div>
  );
}
