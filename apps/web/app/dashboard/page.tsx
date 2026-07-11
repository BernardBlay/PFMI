"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface Equipment {
  id: string;
  name: string;
  status: string;
  healthScore: number;
}

interface Alert {
  id: string;
  equipmentName: string;
  severity: string;
  message: string;
}

export default function Dashboard() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // Mock fetch
    setEquipment([
      { id: "EQ-101", name: "Hydraulic Pump A", status: "Healthy", healthScore: 94 },
      { id: "EQ-102", name: "Cooling Fan B", status: "Warning", healthScore: 72 },
      { id: "EQ-103", name: "Rotary Motor C", status: "Critical", healthScore: 45 },
    ]);
    setAlerts([
      { id: "ALT-01", equipmentName: "Rotary Motor C", severity: "High", message: "Bearing vibration exceeds safe threshold" },
      { id: "ALT-02", equipmentName: "Cooling Fan B", severity: "Medium", message: "Temperature anomaly detected" },
    ]);
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar />
      <div className="container mx-auto px-6 py-24 flex-1">
        <h1 className="text-3xl font-bold mb-8">Maintenance Dashboard</h1>
        
        {/* Alerts Grid */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 text-red-400">Active Alerts</h2>
          <div className="grid gap-4">
            {alerts.map(alert => (
              <div key={alert.id} className="p-4 rounded-lg bg-[var(--bg-card)] border border-red-500/20 flex justify-between items-center">
                <div>
                  <span className="font-bold text-red-400 mr-2">[{alert.severity}]</span>
                  <span className="font-semibold">{alert.equipmentName}</span>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">{alert.message}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{alert.id}</span>
              </div>
            ))}
          </div>
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
                    <span className="font-bold">{eq.healthScore}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${eq.healthScore}%` }} />
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
