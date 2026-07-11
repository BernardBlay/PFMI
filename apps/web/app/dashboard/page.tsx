"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, AlertTriangle, ArrowUpRight, CheckCircle2, ShieldAlert, Activity } from "lucide-react";
import { Equipment, Alert } from "@/lib/db";

export default function Dashboard() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [eqRes, alertRes] = await Promise.all([
        fetch("/api/equipment"),
        fetch("/api/alerts")
      ]);
      const eqData = await eqRes.json();
      const alertData = await alertRes.json();
      setEquipment(eqData);
      setAlerts(alertData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resolveAlert = async (id: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        // Refresh states
        fetchData();
      }
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-mute pb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground font-sans tracking-tight">
            Fleet Maintenance Control
          </h1>
          <p className="text-xs text-text-muted mt-1 leading-none font-mono uppercase tracking-wider">
            Industrial Node 04 Control Room
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold font-mono text-emerald-650 dark:text-emerald-400 uppercase tracking-widest">
            Telemetry Stream Active
          </span>
        </div>
      </div>

      {/* Alerts Grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-red-500">
          <ShieldAlert className="h-4.5 w-4.5" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
            Active Alerts Priority Queue
          </h2>
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
                  className={`p-4 rounded-xl bg-surface border transition-all duration-300 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 ${
                    isCritical 
                      ? "border-red-500/25 hover:border-red-500/40" 
                      : "border-amber-500/20 hover:border-amber-500/35"
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
                    <span className="text-[9px] font-mono text-text-muted">{alert.id}</span>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer"
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
            Fetching telemetry parameters...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {equipment.map((eq) => {
              const scoreColor = 
                eq.status === "Healthy" ? "text-emerald-500" :
                eq.status === "Warning" ? "text-amber-500" : "text-red-500";
              const scoreBg = 
                eq.status === "Healthy" ? "bg-emerald-500" :
                eq.status === "Warning" ? "bg-amber-500" : "bg-red-500";
              const badgeStyle = 
                eq.status === "Healthy" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                eq.status === "Warning" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-red-500/10 text-red-500 border-red-500/20";

              return (
                <div 
                  key={eq.id} 
                  className="card-hover relative p-6 rounded-3xl border border-border-mute/80 bg-surface/30 dark:bg-zinc-900/10 shadow-[0_8px_30px_rgba(0,0,0,0.01)] flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-xs text-foreground font-sans tracking-tight">{eq.name}</h3>
                        <p className="text-[9px] font-mono text-text-muted uppercase mt-0.5">{eq.id}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase border ${badgeStyle}`}>
                        {eq.status}
                      </span>
                    </div>

                    {/* Progress score */}
                    <div className="mt-4">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-text-muted">Health Index</span>
                        <span className={`font-bold ${scoreColor}`}>{eq.health_score}%</span>
                      </div>
                      <div className="w-full bg-border-mute/40 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${scoreBg}`} style={{ width: `${eq.health_score}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-border-mute/60 pt-4 flex justify-end">
                    <Link
                      href={`/dashboard/${eq.id}`}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-text-muted hover:text-foreground transition-colors uppercase tracking-wider"
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
