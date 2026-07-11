"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
        // Refresh alerts and equipment states
        fetchData();
      }
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar />
      <div className="container mx-auto px-6 py-24 flex-1">
        <h1 className="text-3xl font-bold mb-8">Maintenance Dashboard</h1>
        
        {/* Alerts Grid */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 text-red-400">Active Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-[var(--text-secondary)]">No active alerts.</p>
          ) : (
            <div className="grid gap-4">
              {alerts.map(alert => (
                <div key={alert.id} className="p-4 rounded-lg bg-[var(--bg-card)] border border-red-500/20 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-red-400 mr-2">[{alert.severity}]</span>
                    <span className="font-semibold">{alert.equipmentName}</span>
                    <p className="text-[var(--text-secondary)] text-sm mt-1">{alert.message}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      Resolve
                    </button>
                    <span className="text-xs text-[var(--text-muted)]">{alert.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Equipment Status Grid */}
        <section>
          <h2 className="text-xl font-bold mb-4">Equipment Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {equipment.map(eq => (
              <div key={eq.id} className="p-6 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{eq.name}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{eq.id}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    eq.status === "Healthy" ? "bg-green-500/10 text-green-400" :
                    eq.status === "Warning" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                  }`}>{eq.status}</span>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Health Score</span>
                    <span className="font-bold">{eq.health_score}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${eq.health_score}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
