"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Cpu, AlertTriangle, ArrowUpRight, CheckCircle2, ShieldAlert, Activity,
  Flame, TrendingUp, TrendingDown, BarChart3, Zap,
  Truck, HardHat, Layers, Droplets, Wind, Power, Wrench,
  Thermometer, Gauge, RotateCw, Settings, Battery, Radio, Filter, CircleDot
} from "lucide-react";
import { Equipment, Alert } from "@/lib/db";

/* -- SVG Circular Health Gauge (SmartStudy-inspired) ----------------- */
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

/* -- Fleet Summary Stats Row ------------------------------------------ */
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

/* -- Machine class: icon + label (derived from equipment name) -------- */
type IconComponent = React.ComponentType<{ className?: string }>;

function getMachineIcon(name: string): IconComponent {
  const n = name.toLowerCase();
  if (n.includes("truck") || n.includes("hauler") || n.includes("dump")) return Truck;
  if (n.includes("loader"))  return HardHat;
  if (n.includes("excavator")) return HardHat;
  if (n.includes("dozer") || n.includes("bulldozer")) return HardHat;
  if (n.includes("grader")) return HardHat;
  if (n.includes("conveyor") || n.includes("belt")) return Layers;
  if (n.includes("pump")) return Droplets;
  if (n.includes("compressor")) return Wind;
  if (n.includes("generator") || n.includes("genset")) return Power;
  return Cpu;
}

function getMachineLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("dump") || n.includes("hauler")) return "Dump Truck";
  if (n.includes("truck")) return "Truck";
  if (n.includes("loader")) return "Wheel Loader";
  if (n.includes("excavator")) return "Excavator";
  if (n.includes("dozer") || n.includes("bulldozer")) return "Bulldozer";
  if (n.includes("grader")) return "Motor Grader";
  if (n.includes("conveyor") || n.includes("belt")) return "Conveyor";
  if (n.includes("pump")) return "Pump";
  if (n.includes("compressor")) return "Compressor";
  if (n.includes("generator") || n.includes("genset")) return "Generator";
  return "Equipment";
}

/* -- Affected part: icon + label (derived from alert message) --------- */
function getPartIcon(message: string): IconComponent {
  const m = message.toLowerCase();
  if (m.includes("temperature") || m.includes("thermal") || m.includes("overheat") || m.includes("heat")) return Thermometer;
  if (m.includes("vibration") || m.includes("vibrat")) return Activity;
  if (m.includes("pressure")) return Gauge;
  if (m.includes("bearing") || m.includes("rotation")) return RotateCw;
  if (m.includes("electrical") || m.includes("voltage") || m.includes("power failure")) return Zap;
  if (m.includes("hydraulic") || m.includes("fluid") || m.includes("leak")) return Droplets;
  if (m.includes("oil")) return Droplets;
  if (m.includes("gearbox") || m.includes("gear") || m.includes("transmission")) return Settings;
  if (m.includes("battery") || m.includes("charge")) return Battery;
  if (m.includes("cooling") || m.includes("coolant")) return Wind;
  if (m.includes("sensor") || m.includes("signal")) return Radio;
  if (m.includes("filter")) return Filter;
  if (m.includes("brake")) return CircleDot;
  if (m.includes("tire") || m.includes("tyre") || m.includes("wheel")) return CircleDot;
  if (m.includes("engine") || m.includes("motor")) return Zap;
  return Wrench;
}

function getPartLabel(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("temperature") || m.includes("overheat") || m.includes("thermal")) return "Engine Temp";
  if (m.includes("heat")) return "Overheating";
  if (m.includes("vibration") || m.includes("vibrat")) return "Vibration";
  if (m.includes("pressure")) return "Pressure";
  if (m.includes("bearing") || m.includes("rotation")) return "Bearing";
  if (m.includes("electrical") || m.includes("voltage")) return "Electrical";
  if (m.includes("power failure")) return "Power";
  if (m.includes("hydraulic")) return "Hydraulics";
  if (m.includes("fluid") || m.includes("leak")) return "Fluid/Leak";
  if (m.includes("oil")) return "Oil System";
  if (m.includes("gearbox") || m.includes("gear")) return "Gearbox";
  if (m.includes("transmission")) return "Transmission";
  if (m.includes("battery") || m.includes("charge")) return "Battery";
  if (m.includes("cooling") || m.includes("coolant")) return "Cooling";
  if (m.includes("sensor") || m.includes("signal")) return "Sensor";
  if (m.includes("filter")) return "Filter";
  if (m.includes("brake")) return "Brakes";
  if (m.includes("tire") || m.includes("tyre")) return "Tires";
  if (m.includes("engine")) return "Engine";
  if (m.includes("motor")) return "Motor";
  return "Component";
}

const SEVERITY_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

type SeverityStyle = { text: string; bg: string; border: string; bar: string; iconBg: string };

function severityStyle(severity: string): SeverityStyle {
  switch (severity) {
    case "Critical": return { text: "text-red-500",    bg: "bg-red-500/10",    border: "border-red-500/20",    bar: "bg-red-500",    iconBg: "bg-red-500/10" };
    case "High":     return { text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", bar: "bg-orange-500", iconBg: "bg-orange-500/10" };
    case "Medium":   return { text: "text-amber-500",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  bar: "bg-amber-500",  iconBg: "bg-amber-500/10" };
    default:         return { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   bar: "bg-blue-400",   iconBg: "bg-blue-500/10" };
  }
}

/* -- Alert card component -------------------------------------------- */
function AlertCard({
  alert,
  onResolve,
  isResolving,
  spanFull,
}: {
  alert: Alert;
  onResolve: (id: string) => void;
  isResolving: boolean;
  spanFull?: boolean;
}) {
  const s            = severityStyle(alert.severity);
  const machineLabel = getMachineLabel(alert.equipmentName ?? "");
  const partLabel    = getPartLabel(alert.message ?? "");

  // Severity-keyed corner accent colour (matches equipment card pattern)
  const accentBg =
    alert.severity === "Critical" ? "bg-red-500" :
    alert.severity === "High"     ? "bg-orange-500" :
    alert.severity === "Medium"   ? "bg-amber-500" : "bg-blue-400";

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border-mute/80
        bg-surface/50 backdrop-blur-sm
        shadow-[0_8px_30px_rgba(0,0,0,0.04)]
        transition-all duration-300
        hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:border-border-mute
        ${spanFull ? "lg:col-span-2" : ""}`}
    >
      {/* Decorative corner accent — same pattern as equipment cards */}
      <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-2xl pointer-events-none">
        <div className={`absolute -top-12 -right-12 w-24 h-24 rotate-45 opacity-[0.05] ${accentBg}`} />
      </div>

      {/* Left severity accent */}
      <div className={`absolute inset-y-0 left-0 w-0.75 rounded-l-2xl ${s.bar}`} />

      <div className="pl-5 pr-4 py-4 flex flex-col gap-3">

        {/* Row 1: machine icon + unit name + severity label */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {React.createElement(
              getMachineIcon(alert.equipmentName ?? ""),
              { className: `h-4 w-4 shrink-0 ${s.text}` }
            )}
            <span className="font-bold text-sm text-foreground truncate tracking-tight">
              {alert.equipmentName}
            </span>
          </div>
          <span className={`shrink-0 text-[9px] font-mono font-bold uppercase
            tracking-wider px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
            {alert.severity}
          </span>
        </div>

        {/* Row 2: affected part icon + part label + machine type */}
        <div className="flex items-center gap-1.5">
          {React.createElement(
            getPartIcon(alert.message ?? ""),
            { className: `h-3.5 w-3.5 shrink-0 ${s.text}` }
          )}
          <span className={`text-xs font-semibold ${s.text}`}>{partLabel}</span>
          <span className="text-[10px] text-text-muted font-mono">&middot; {machineLabel}</span>
        </div>

        {/* Row 3: alert message */}
        <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
          {alert.message}
        </p>

        {/* Row 4: footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border-mute/40">
          <span className="text-[10px] font-mono text-text-muted">
            #{alert.id?.slice(0, 8).toUpperCase()}
          </span>
          <button
            onClick={() => onResolve(alert.id)}
            disabled={isResolving}
            className={`text-[11px] font-mono font-semibold transition-colors
              cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
              ${isResolving ? "text-text-muted" : "text-emerald-500 hover:text-emerald-400"}`}
          >
            {isResolving ? "Resolving..." : "Mark resolved"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* -- Main Dashboard -------------------------------------------------- */
export default function Dashboard() {
  const [equipment, setEquipment]     = useState<Equipment[]>([]);
  const [alerts, setAlerts]           = useState<Alert[]>([]);
  const [loading, setLoading]         = useState(true);
  const [mlStatus, setMlStatus]       = useState<"online" | "offline" | "checking">("checking");
  const [resolving, setResolving]     = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Ref so background polls don't restore an optimistically-removed alert
  const resolvingRef = useRef<string | null>(null);

  // ── Initial full load ────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [eqRes, alertRes] = await Promise.all([
        fetch("/api/equipment"),
        fetch("/api/alerts"),
      ]);
      const eqData    = await eqRes.json();
      const alertData = await alertRes.json();
      setEquipment(Array.isArray(eqData)    ? eqData    : []);
      setAlerts(Array.isArray(alertData) ? alertData : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // ── Silent alert poll every 20 s ──────────────────────────────────
    const pollAlerts = async () => {
      if (resolvingRef.current) return; // skip if a resolve is in flight
      try {
        const res  = await fetch("/api/alerts");
        const data = await res.json();
        if (Array.isArray(data)) {
          setAlerts(data);
          setLastUpdated(new Date());
        }
      } catch { /* silent — don't disrupt the UI on a failed poll */ }
    };

    // ── ML status poll every 60 s ─────────────────────────────────────
    const pollMl = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_ML_SERVICE_URL || "http://localhost:8000";
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
        setMlStatus(res.ok ? "online" : "offline");
      } catch { setMlStatus("offline"); }
    };

    pollMl();
    const alertTimer = setInterval(pollAlerts, 20_000);
    const mlTimer    = setInterval(pollMl,     60_000);

    return () => { clearInterval(alertTimer); clearInterval(mlTimer); };
  }, []);

  const resolveAlert = async (id: string) => {
    resolvingRef.current = id;
    setResolving(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id)); // optimistic removal
    try {
      await fetch("/api/alerts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("Failed to resolve alert:", err);
      fetchData(); // restore correct state on failure
    } finally {
      resolvingRef.current = null;
      setResolving(null);
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

      {/* Active Alerts — Top 5 Priority Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
              Active Alerts
            </h2>
            {alerts.length > 0 && (
              <span className="text-[9px] font-mono font-bold text-red-500">
                {alerts.length}
              </span>
            )}
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-text-muted">
                {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="border border-border-mute bg-surface rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
            <span className="text-xs font-semibold text-foreground">All systems nominal</span>
            <p className="text-[10px] text-text-muted mt-0.5">No critical deviations flagged.</p>
          </div>
        ) : (() => {
            const sorted = [...alerts]
              .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0));
            const isOdd = sorted.length % 2 !== 0;
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sorted.map((alert, i) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onResolve={resolveAlert}
                    isResolving={resolving === alert.id}
                    spanFull={isOdd && i === sorted.length - 1}
                  />
                ))}
              </div>
            );
          })()}
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
                      <HealthGauge score={eq.health_score} size={56} />
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
