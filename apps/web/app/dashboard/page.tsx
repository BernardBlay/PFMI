"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Cpu, AlertTriangle, ArrowUpRight, CheckCircle2, ShieldAlert, Activity,
  Flame, TrendingUp, TrendingDown, BarChart3, Zap
} from "lucide-react";
import { Equipment, Alert } from "@/lib/db";

/* ── SVG Circular Health Gauge (SmartStudy-inspired) ───────────────── */
function HealthGauge({ score, size = 72 }: { score: number; size?: number }) {
  const radius = 15.9154943092;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const bgRing =
    score >= 80
      ? "rgba(16,185,129,0.12)"
      : score >= 60
      ? "rgba(245,158,11,0.12)"
      : "rgba(239,68,68,0.12)";

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: bgRing }}
      />
      <svg
        className="w-full h-full transform -rotate-90"
        viewBox="0 0 36 36"
      >
        <circle
          cx="18" cy="18" r={radius}
          fill="transparent"
          stroke="var(--color-border-mute, #27272a)"
          strokeWidth="3"
          opacity={0.3}
        />
        <circle
          cx="18" cy="18" r={radius}
          fill="transparent"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeWidth="3"
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black text-foreground leading-none">
          {score}
        </span>
        <span className="text-[7px] uppercase tracking-widest font-bold text-text-muted mt-0.5">
          health
        </span>
      </div>
    </div>
  );
}

/* ── Fleet Summary Stats Row ────────────────────────────────────────── */
function FleetStats({ equipment, alerts }: { equipment: Equipment[]; alerts: Alert[] }) {
  const totalUnits = equipment.length;
  const healthyCount = equipment.filter((e) => e.status === "Healthy").length;
  const warningCount = equipment.filter((e) => e.status === "Warning").length;
  const criticalCount = equipment.filter((e) => e.status === "Critical").length;
  const avgHealth = totalUnits > 0
    ? Math.round(equipment.reduce((sum, e) => sum + e.health_score, 0) / totalUnits)
    : 0;

  const stats = [
    { icon: Cpu, label: "Fleet Size", value: totalUnits, color: "text-blue-500", bg: "bg-blue-500/5 border-blue-500/10" },
    { icon: CheckCircle2, label: "Healthy", value: healthyCount, color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/10" },
    { icon: AlertTriangle, label: "Warning", value: warningCount, color: "text-amber-500", bg: "bg-amber-500/5 border-amber-500/10" },
    { icon: Flame, label: "Critical", value: criticalCount, color: "text-red-500", bg: "bg-red-500/5 border-red-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${s.bg}`}
          >
            {/* Decorative geometric accent */}
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-[0.04]"
              style={{ background: `currentColor` }}
            />
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg border ${s.bg} ${s.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                {s.label}
              </span>
            </div>
            <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────────── */
export default function Dashboard() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [mlStatus, setMlStatus] = useState<"online" | "offline" | "checking">("checking");
  const [mlPredictionsLoading, setMlPredictionsLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [eqRes, alertRes] = await Promise.all([
        fetch("/api/equipment"),
        fetch("/api/alerts"),
      ]);
      const eqData = await eqRes.json();
      const alertData = await alertRes.json();
      setEquipment(Array.isArray(eqData) ? eqData : []);
      setAlerts(Array.isArray(alertData) ? alertData : []);
      
      // After loading equipment, fetch ML predictions to update health scores
      if (Array.isArray(eqData) && eqData.length > 0) {
        fetchMLPredictions(eqData);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMLPredictions = async (equipmentList: Equipment[]) => {
    setMlPredictionsLoading(true);
    try {
      const equipment_ids = equipmentList.map(eq => eq.id);
      console.log('[Dashboard] Fetching ML predictions for:', equipment_ids);
      
      const mlRes = await fetch("/api/ml-predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment_ids }),
      });
      
      if (mlRes.ok) {
        const predictions = await mlRes.json();
        console.log('[Dashboard] Received ML predictions:', predictions);
        
        // Merge ML predictions into equipment data
        const updatedEquipment = equipmentList.map(eq => {
          const prediction = predictions.find((p: any) => p.equipment_id === eq.id);
          if (prediction) {
            console.log(`[Dashboard] Updating ${eq.id}: health ${eq.health_score} → ${prediction.health_score}`);
            // Update health score AND status from ML prediction
            const mlStatus = 
              prediction.severity === 'critical' ? 'Critical' :
              prediction.severity === 'high' || prediction.severity === 'medium' ? 'Warning' :
              'Healthy';
            
            return {
              ...eq,
              health_score: prediction.health_score,
              status: mlStatus,
              // Store ML metadata for display
              ml_prediction: {
                rul_hours: prediction.rul_hours,
                rul_days: prediction.rul_days,
                severity: prediction.severity,
                failure_mode: prediction.failure_mode,
                recommendation: prediction.recommendation,
                source: prediction.source,
                degradation_pct: prediction.degradation_pct,
                confidence: prediction.confidence,
              },
            };
          }
          console.log(`[Dashboard] No prediction found for ${eq.id}, keeping original health: ${eq.health_score || 95}`);
          // Ensure health_score is never 0 or undefined
          return {
            ...eq,
            health_score: eq.health_score || 95,
          };
        });
        
        console.log('[Dashboard] Updated equipment:', updatedEquipment);
        setEquipment(updatedEquipment);
      } else {
        console.error('[Dashboard] ML predictions API returned:', mlRes.status);
      }
    } catch (err) {
      console.error("Failed to fetch ML predictions:", err);
    } finally {
      setMlPredictionsLoading(false);
    }
  };

  const checkMlService = async () => {
    try {
      const serviceUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL || "http://localhost:8000";
      const res = await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) setMlStatus("online");
      else setMlStatus("offline");
    } catch {
      setMlStatus("offline");
    }
  };

  useEffect(() => {
    fetchData();
    checkMlService();
  }, []);

  const resolveAlert = async (id: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-mute pb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground font-sans tracking-tight">
            Fleet Maintenance Control
          </h1>
          <p className="text-xs text-text-muted mt-1 leading-none font-mono uppercase tracking-wider">
            Industrial Node 04 Control Room
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* ML Service Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-mute bg-surface">
            <Zap className={`h-3.5 w-3.5 ${mlStatus === "online" ? "text-emerald-500" : mlStatus === "checking" ? "text-amber-500 animate-pulse" : "text-red-500"}`} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
              ML Engine: {mlStatus}
            </span>
          </div>
          {mlPredictionsLoading && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
              <Activity className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-500">
                Updating Health Scores
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold font-mono text-emerald-650 dark:text-emerald-400 uppercase tracking-widest">
              Telemetry Stream Active
            </span>
          </div>
        </div>
      </div>

      {/* Fleet Stats Row */}
      {!loading && <FleetStats equipment={equipment} alerts={alerts} />}

      {/* Alerts Grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-red-500">
          <ShieldAlert className="h-4.5 w-4.5" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
            Active Alerts Priority Queue
          </h2>
          {alerts.length > 0 && (
            <span className="ml-auto text-[9px] font-mono font-bold bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20">
              {alerts.length} ACTIVE
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="border border-border-mute bg-surface rounded-2xl p-6 flex flex-col items-center justify-center text-center text-text-muted">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
            <span className="text-xs font-semibold text-foreground">All systems nominal</span>
            <p className="text-[10px] text-text-muted mt-0.5">No critical deviations flagged currently.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {alerts.map((alert) => {
              const isCritical = alert.severity === "Critical" || alert.severity === "High";
              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl bg-surface border transition-all duration-300 hover:-translate-y-0.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 ${
                    isCritical
                      ? "border-red-500/25 hover:border-red-500/40 hover:shadow-[0_4px_20px_rgba(239,68,68,0.08)]"
                      : "border-amber-500/20 hover:border-amber-500/35 hover:shadow-[0_4px_20px_rgba(245,158,11,0.08)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${isCritical ? "text-red-500" : "text-amber-500"}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${
                          isCritical
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="font-bold text-xs text-foreground">{alert.equipmentName}</span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className="text-[9px] font-mono text-text-muted">{alert.id?.slice(0, 8)}</span>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all hover:-translate-y-0.5 cursor-pointer"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Equipment Status Grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4.5 w-4.5 text-text-muted" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
            Equipment Node Diagnostics
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-text-muted font-mono">
            <div className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4 animate-pulse text-emerald-500" />
              Fetching telemetry parameters...
            </div>
          </div>
        ) : equipment.length === 0 ? (
          <div className="border border-border-mute bg-surface rounded-2xl p-8 flex flex-col items-center justify-center text-center text-text-muted">
            <Cpu className="h-8 w-8 mb-2 opacity-30" />
            <span className="text-xs font-semibold text-foreground">No Equipment Found</span>
            <p className="text-[10px] text-text-muted mt-0.5">Waiting for equipment data from the telemetry stream.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {equipment.map((eq) => {
              const scoreColor =
                eq.status === "Healthy" ? "text-emerald-500" :
                eq.status === "Warning" ? "text-amber-500" : "text-red-500";
              const badgeStyle =
                eq.status === "Healthy" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                eq.status === "Warning" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                "bg-red-500/10 text-red-500 border-red-500/20";

              const trend = eq.health_score >= 80 ? "up" : eq.health_score >= 60 ? "flat" : "down";

              return (
                <div
                  key={eq.id}
                  className="group relative p-5 rounded-2xl border border-border-mute/80 bg-surface/50 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:border-border-mute"
                >
                  {/* Decorative corner accent */}
                  <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden rounded-tr-2xl pointer-events-none">
                    <div className={`absolute -top-10 -right-10 w-20 h-20 rotate-45 opacity-[0.04] ${
                      eq.status === "Healthy" ? "bg-emerald-500" :
                      eq.status === "Warning" ? "bg-amber-500" : "bg-red-500"
                    }`} />
                  </div>

                  <div>
                    {/* Header row with gauge */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0 mr-3">
                        <h3 className="font-bold text-sm text-foreground font-sans tracking-tight truncate">
                          {eq.name}
                        </h3>
                        <p className="text-[9px] font-mono text-text-muted uppercase mt-0.5 truncate">
                          {eq.id?.slice(0, 12)}
                        </p>
                      </div>
                      <HealthGauge score={eq.health_score || 95} size={56} />
                    </div>

                    {/* Status badge + trend */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase border ${badgeStyle}`}>
                        {eq.status}
                      </span>
                      <div className="flex items-center gap-1">
                        {trend === "up" ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : trend === "down" ? (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        ) : (
                          <BarChart3 className="h-3 w-3 text-amber-500" />
                        )}
                        <span className={`text-[9px] font-mono font-bold ${scoreColor}`}>
                          {trend === "up" ? "Stable" : trend === "down" ? "Degrading" : "Monitor"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border-mute/60 pt-3 flex justify-end">
                    <Link
                      href={`/dashboard/${eq.id}`}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-text-muted hover:text-foreground transition-all uppercase tracking-wider group-hover:translate-x-0.5"
                    >
                      Inspect Telemetry
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
