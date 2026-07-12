"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Activity, Thermometer, Gauge, ShieldAlert, CheckCircle2, Wifi, WifiOff, Brain } from "lucide-react";
import { predictFromSensors, checkMLHealth, type MLPrediction, type MLHealthStatus } from "@/lib/ml-client";

// Seed the simulator from the most recent Supabase sensor reading
async function fetchLatestSensorBaseline(): Promise<{ temperature: number; vibration: number; pressure: number } | null> {
  try {
    const eqRes = await fetch("/api/equipment");
    if (!eqRes.ok) return null;
    const equipment = await eqRes.json();
    if (!equipment?.length) return null;

    // Use the first equipment unit
    const firstId = equipment[0].id;
    const sensorRes = await fetch(`/api/sensor-readings/${firstId}`);
    if (!sensorRes.ok) return null;
    const readings = await sensorRes.json();
    if (!Array.isArray(readings) || readings.length === 0) return null;

    const latest = readings[readings.length - 1];
    return {
      temperature: Number(latest.temperature) || 68.4,
      vibration: Number(latest.vibration) || 2.3,
      pressure: Number(latest.pressure) || 4.2,
    };
  } catch {
    return null;
  }
}

export default function AnomalySimulator() {
  const [temperature, setTemperature] = useState(68.4);
  const [vibration, setVibration] = useState(2.3);
  const [pressure, setPressure] = useState(4.2);
  const [rul, setRul] = useState(240);
  const [status, setStatus] = useState<"Healthy" | "Warning" | "Critical">("Healthy");
  const [alert, setAlert] = useState<string | null>(null);
  const [mode, setMode] = useState<"normal" | "thermal" | "vibration">("normal");
  const [dataSource, setDataSource] = useState<"live-db" | "simulated">("simulated");

  const [mlPrediction, setMlPrediction] = useState<MLPrediction | null>(null);
  const [mlHealth, setMlHealth] = useState<MLHealthStatus | null>(null);

  const [wavePoints, setWavePoints] = useState<number[]>(Array(40).fill(15));
  const sensorSnapshotRef = useRef({ temperature: 68.4, vibration: 2.3, pressure: 4.2 });

  // Seed simulator from live Supabase sensor data on mount
  useEffect(() => {
    fetchLatestSensorBaseline().then((baseline) => {
      if (baseline) {
        setTemperature(baseline.temperature);
        setVibration(baseline.vibration);
        setPressure(baseline.pressure);
        sensorSnapshotRef.current = baseline;
        setDataSource("live-db");
      }
    });
  }, []);

  // ML health check every 15s
  useEffect(() => {
    const check = async () => setMlHealth(await checkMLHealth());
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);
  // Sensor drift simulation
  useEffect(() => {
    const timer = setInterval(() => {
      let tempTarget = 68.0, vibTarget = 2.2, pressTarget = 4.1;
      if (mode === "thermal")   { tempTarget = 95.8; vibTarget = 3.1; pressTarget = 3.2; }
      if (mode === "vibration") { tempTarget = 74.2; vibTarget = 8.9; pressTarget = 4.5; }

      setTemperature((prev) => {
        const next = parseFloat(Math.min(105, Math.max(40, prev + (tempTarget - prev) * 0.15 + (Math.random() - 0.5) * 0.4)).toFixed(1));
        sensorSnapshotRef.current.temperature = next;
        return next;
      });
      setVibration((prev) => {
        const next = parseFloat(Math.min(12, Math.max(0.5, prev + (vibTarget - prev) * 0.15 + (Math.random() - 0.5) * 0.2)).toFixed(2));
        sensorSnapshotRef.current.vibration = next;
        return next;
      });
      setPressure((prev) => {
        const next = parseFloat(Math.min(8, Math.max(1, prev + (pressTarget - prev) * 0.15 + (Math.random() - 0.5) * 0.1)).toFixed(2));
        sensorSnapshotRef.current.pressure = next;
        return next;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [mode]);

  // ML prediction sync every 2s
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const result = await predictFromSensors(sensorSnapshotRef.current);
      if (!cancelled) {
        setMlPrediction(result);
        setRul(result.remainingUsefulLife);
      }
    };
    sync();
    const t = setInterval(sync, 2000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Waveform animation
  useEffect(() => {
    const multiplier = mode === "vibration" ? 20 : mode === "thermal" ? 8 : 5;
    const t = setInterval(() => {
      setWavePoints((prev) => [...prev.slice(1), 15 + (Math.random() - 0.5) * multiplier]);
    }, 100);
    return () => clearInterval(t);
  }, [mode]);

  // Status + alert logic
  useEffect(() => {
    if (temperature > 90 || vibration > 8) {
      setStatus("Critical");
      setAlert(temperature > 90
        ? "CRITICAL: Thermal runaway detected. RUL drops under 15 days."
        : "CRITICAL: Severe bearing misalignment. Structural threshold breached.");
    } else if (temperature > 80 || vibration > 5) {
      setStatus("Warning");
      setAlert("WARNING: Parametric drift detected. Dispatching diagnostic logs.");
    } else {
      setStatus("Healthy");
      setAlert(null);
    }
  }, [temperature, vibration]);

  const svgPath = wavePoints.map((val, idx) => `${idx * 10},${30 - val}`).join(" L ");
  const isMLLive = mlPrediction?.source === "ml";
  const mlOnline = mlHealth?.online ?? false;

  // Display RUL as hours (the real prediction) with days in parentheses
  const rulDisplay = mlPrediction
    ? `${mlPrediction.rul_hours.toFixed(0)}h`
    : `${rul}h`;
  const rulDaysDisplay = mlPrediction
    ? `(${mlPrediction.rul_days.toFixed(1)} days)`
    : "";

  const presets = [
    { key: "normal",    label: "Normal Baseline",      desc: "Standard vibration waves, nominal temperatures (~68°C), and max RUL.", Icon: CheckCircle2, color: "emerald" },
    { key: "thermal",   label: "Thermal Spike Anomaly", desc: "Heats temperature to >90°C. Simulates cooling block failures.",          Icon: Thermometer,  color: "red"     },
    { key: "vibration", label: "Bearing Friction Wave", desc: "Breaches the 8 mm/s vibration mark. Simulates mechanical stress.",        Icon: Activity,     color: "amber"   },
  ] as const;

  const statCards = [
    { Icon: Thermometer, label: "Temp",    value: `${temperature} °C`,   valueClass: "" },
    { Icon: Activity,    label: "Vibe",    value: `${vibration} mm/s`,   valueClass: "" },
    { Icon: Gauge,       label: "Press",   value: `${pressure} bar`,     valueClass: "" },
    { Icon: Sparkles,    label: "Est RUL",
      value: rulDisplay,
      subValue: rulDaysDisplay,
      valueClass: mlPrediction
        ? (mlPrediction.rul_hours > 100 ? "text-foreground" : mlPrediction.rul_hours > 30 ? "text-amber-500" : "text-red-500")
        : (rul > 100 ? "text-foreground" : rul > 30 ? "text-amber-500" : "text-red-500"),
    },
  ];

  return (
    <section className="relative py-20 md:py-24 border-b border-border-mute bg-background/50 overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">

        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-500 uppercase tracking-widest block mb-2">
            Interactive Diagnostics
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground font-sans">
            AI Anomaly Detection Simulation
          </h2>
          <p className="text-xs text-text-muted mt-2 leading-relaxed max-w-xl mx-auto">
            Toggle the simulation presets below to watch the ML engine evaluate high-frequency sensor streams,
            forecast remaining useful life (RUL), and flag structural faults in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-stretch w-full">

          {/* -- Left: Preset selector + ML status -- */}
          <div className="flex flex-col justify-between p-5 bg-surface border border-border-mute rounded-2xl shadow-sm min-w-0">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted mb-4">
                Telemetry Presets
              </h3>
              <div className="space-y-3">
                {presets.map(({ key, label, desc, Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
                      mode === key
                        ? `bg-${color}-500/5 border-${color}-500 text-foreground`
                        : "bg-background/50 border-border-mute text-text-muted hover:border-zinc-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 text-${color}-500`} />
                      <span>{label}</span>
                    </div>
                    <p className="text-[10px] font-mono text-text-muted font-normal">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ML Engine status block */}
            <div className="mt-6 border-t border-border-mute pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted">ML Engine</span>
                <span className={`flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                  mlOnline
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                }`}>
                  {mlOnline ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
                  {mlOnline ? `${mlHealth?.modelsLoaded}/${mlHealth?.modelsTotal} models` : "Offline · Mock"}
                </span>
              </div>
              {mlPrediction && (
                <div className="text-[10px] font-mono text-text-muted space-y-1">
                  <div className="flex justify-between">
                    <span>Failure mode</span>
                    <span className={`font-bold ${mlPrediction.anomalyDetected ? "text-red-500" : "text-emerald-500"}`}>
                      {mlPrediction.failureMode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence</span>
                    <span className="font-bold text-foreground">{(mlPrediction.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Source</span>
                    <span className={`font-bold ${isMLLive ? "text-indigo-500" : "text-zinc-400"}`}>
                      {isMLLive ? "live inference" : "mock fallback"}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-[9px] font-mono text-text-muted pt-1">
                Mode: <span className="text-emerald-500 font-bold uppercase">{mode}</span> · sync 400ms ·{" "}
                <span className={dataSource === "live-db" ? "text-emerald-500 font-bold" : "text-zinc-400"}>
                  {dataSource === "live-db" ? "seeded from live DB" : "simulated baseline"}
                </span>
              </p>
            </div>
          </div>

          {/* -- Right: Live dashboard panel -- */}
          <div className="bg-surface border border-border-mute rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between min-w-0">

            {/* Console header */}
            <div className="px-5 py-3 border-b border-border-mute flex items-center justify-between bg-background/40">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  status === "Healthy" ? "bg-emerald-500" : status === "Warning" ? "bg-amber-500" : "bg-red-500"
                }`} />
                <span className="text-[10px] font-mono font-bold uppercase text-foreground">Unit: Pump-X90-Hydraulic</span>
              </div>
              <div className="flex items-center gap-2">
                {isMLLive && (
                  <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    <Brain className="h-2.5 w-2.5" />
                    Live ML
                  </span>
                )}
                <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                  status === "Healthy" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : status === "Warning" ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20"
                }`}>{status}</span>
              </div>
            </div>

            {/* Sensor stat cards */}
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-border-mute">
              {statCards.map(({ Icon, label, value, valueClass, subValue }: any) => (
                <div key={label} className="bg-background border border-border-mute p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-1 text-text-muted">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-mono uppercase font-bold tracking-wider">{label}</span>
                  </div>
                  <p className={`text-base font-mono font-bold leading-tight ${valueClass || "text-foreground"}`}>{value}</p>
                  {subValue && (
                    <p className="text-[9px] font-mono text-text-muted mt-0.5">{subValue}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Confidence bar */}
            {mlPrediction && (
              <div className="px-6 py-3 border-b border-border-mute bg-background/30 flex items-center gap-4">
                <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-text-muted shrink-0">
                  Model confidence
                </span>
                <div className="flex-1 h-1.5 bg-border-mute/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isMLLive ? "bg-indigo-500" : "bg-zinc-400"}`}
                    style={{ width: `${(mlPrediction.confidence * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono font-bold text-foreground shrink-0">
                  {(mlPrediction.confidence * 100).toFixed(1)}%
                </span>
              </div>
            )}

            {/* Recommendation bar — the core RUL pitch */}
            {mlPrediction && mlPrediction.recommendation && (
              <div className={`px-5 py-3 border-b border-border-mute flex items-start gap-2.5 ${
                mlPrediction.severity === "critical" ? "bg-red-500/5" :
                mlPrediction.severity === "high" ? "bg-orange-500/5" :
                mlPrediction.severity === "medium" ? "bg-amber-500/5" : "bg-emerald-500/5"
              }`}>
                <div className={`shrink-0 mt-0.5 h-2 w-2 rounded-full ${
                  mlPrediction.severity === "critical" ? "bg-red-500 animate-pulse" :
                  mlPrediction.severity === "high" ? "bg-orange-500" :
                  mlPrediction.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"
                }`} />
                <p className={`text-[10px] font-mono leading-relaxed ${
                  mlPrediction.severity === "critical" ? "text-red-500" :
                  mlPrediction.severity === "high" ? "text-orange-500" :
                  mlPrediction.severity === "medium" ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {mlPrediction.recommendation}
                </p>
              </div>
            )}

            {/* Waveform */}
            <div className="p-5 bg-background/20 relative overflow-hidden">
              <div className="absolute top-3 left-4 flex items-center gap-1">
                <Activity className="h-3 w-3 text-text-muted animate-pulse" />
                <span className="text-[9px] font-mono text-text-muted uppercase">Real-Time Oscillation Waveform</span>
              </div>
              <div className="h-20 w-full mt-4 overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 390 60" preserveAspectRatio="none">
                  <path
                    d={`M 0,${30 - wavePoints[0]} L ${svgPath}`}
                    fill="none"
                    stroke={status === "Healthy" ? "#10b981" : status === "Warning" ? "#f59e0b" : "#ef4444"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-100"
                  />
                </svg>
              </div>
            </div>

            {/* Alert bar */}
            {alert && (
              <div className="bg-red-500/10 border-t border-red-500/20 px-5 py-3 flex items-center gap-2 text-[10px] font-mono text-red-500">
                <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
                <span>{alert}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
