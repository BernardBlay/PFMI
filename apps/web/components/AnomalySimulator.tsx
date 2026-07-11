"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Sparkles, Activity, Thermometer, Gauge, ShieldAlert, CheckCircle2, RotateCcw } from "lucide-react";
import { mlClient } from "@/lib/ml-client";

export default function AnomalySimulator() {
  const [temperature, setTemperature] = useState(68.4);
  const [vibration, setVibration] = useState(2.3);
  const [pressure, setPressure] = useState(4.2);
  const [rul, setRul] = useState(240); // Remaining Useful Life in days
  const [status, setStatus] = useState<"Healthy" | "Warning" | "Critical">("Healthy");
  const [alert, setAlert] = useState<string | null>(null);
  const [mode, setMode] = useState<"normal" | "thermal" | "vibration">("normal");

  const [wavePoints, setWavePoints] = useState<number[]>(Array(40).fill(15));
  const pointsRef = useRef(wavePoints);
  const sensorSnapshotRef = useRef({
    temperature: 68.4,
    vibration: 2.3,
    pressure: 4.2,
  });
  pointsRef.current = wavePoints;

  // Drift values to simulate live stream
  useEffect(() => {
    const timer = setInterval(() => {
      let tempTarget = 68.0;
      let vibTarget = 2.2;
      let pressTarget = 4.1;
      let rulTarget = 240;

      if (mode === "thermal") {
        tempTarget = 95.8;
        vibTarget = 3.1;
        pressTarget = 3.2;
        rulTarget = 12;
      } else if (mode === "vibration") {
        tempTarget = 74.2;
        vibTarget = 8.9;
        pressTarget = 4.5;
        rulTarget = 45;
      }

      setTemperature((prev) => {
        const diff = tempTarget - prev;
        const step = diff * 0.15 + (Math.random() - 0.5) * 0.4;
        const next = parseFloat(Math.min(105, Math.max(40, prev + step)).toFixed(1));
        sensorSnapshotRef.current.temperature = next;
        return next;
      });

      setVibration((prev) => {
        const diff = vibTarget - prev;
        const step = diff * 0.15 + (Math.random() - 0.5) * 0.2;
        const next = parseFloat(Math.min(12, Math.max(0.5, prev + step)).toFixed(2));
        sensorSnapshotRef.current.vibration = next;
        return next;
      });

      setPressure((prev) => {
        const diff = pressTarget - prev;
        const step = diff * 0.15 + (Math.random() - 0.5) * 0.1;
        const next = parseFloat(Math.min(8, Math.max(1, prev + step)).toFixed(2));
        sensorSnapshotRef.current.pressure = next;
        return next;
      });

      setRul((prev) => {
        const diff = rulTarget - prev;
        const step = diff * 0.1;
        return Math.round(prev + step);
      });
    }, 400);

    return () => clearInterval(timer);
  }, [mode]);

  // Pull the latest RUL estimate from the FastAPI ML service.
  useEffect(() => {
    let cancelled = false;

    const syncPrediction = async () => {
      const prediction = await mlClient.predictRUL(sensorSnapshotRef.current);
      if (!cancelled) {
        setRul(prediction.remainingUsefulLife);
      }
    };

    syncPrediction();
    const timer = setInterval(syncPrediction, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Waveform graph generation
  useEffect(() => {
    const timer = setInterval(() => {
      let multiplier = 5;
      if (mode === "vibration") multiplier = 20;
      else if (mode === "thermal") multiplier = 8;

      const nextVal = 15 + (Math.random() - 0.5) * multiplier;
      setWavePoints((prev) => {
        const next = [...prev.slice(1), nextVal];
        return next;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [mode]);

  // Update Status & Dispatched Alerts
  useEffect(() => {
    if (temperature > 90 || vibration > 8) {
      setStatus("Critical");
      if (temperature > 90) {
        setAlert("CRITICAL: Thermal runaway detected. RUL drops under 15 days.");
      } else {
        setAlert("CRITICAL: Severe bearing misalignment. Structural threshold breached.");
      }
    } else if (temperature > 80 || vibration > 5) {
      setStatus("Warning");
      setAlert("WARNING: Parametric drift detected. Dispatching diagnostic logs.");
    } else {
      setStatus("Healthy");
      setAlert(null);
    }
  }, [temperature, vibration]);

  // SVG Waveform path
  const svgPath = wavePoints
    .map((val, idx) => `${idx * 10},${30 - val}`)
    .join(" L ");

  return (
    <section className="relative py-20 md:py-24 border-b border-border-mute bg-background/50 overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-500 uppercase tracking-widest block mb-2">
            Interactive Diagnostics
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground font-sans">
            AI Anomaly Detection Simulation
          </h2>
          <p className="text-xs text-text-muted mt-2 leading-relaxed max-w-xl mx-auto">
            Toggle the simulation presets below to watch the ML engine evaluate high-frequency sensor streams, forecast remaining useful life (RUL), and flag structural faults in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-stretch w-full">
          {/* Preset Selector Panel */}
          <div className="flex flex-col justify-between p-5 bg-surface border border-border-mute rounded-2xl shadow-sm min-w-0">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted mb-4">
                Telemetry Presets
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => setMode("normal")}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
                    mode === "normal"
                      ? "bg-emerald-500/5 border-emerald-500 text-foreground"
                      : "bg-background/50 border-border-mute text-text-muted hover:border-zinc-400 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Normal Baseline</span>
                  </div>
                  <p className="text-[10px] font-mono text-text-muted font-normal">
                    Standard vibration waves, nominal temperatures (~68°C), and max RUL.
                  </p>
                </button>

                <button
                  onClick={() => setMode("thermal")}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
                    mode === "thermal"
                      ? "bg-red-500/5 border-red-500 text-foreground"
                      : "bg-background/50 border-border-mute text-text-muted hover:border-zinc-400 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    <span>Thermal Spike Anomaly</span>
                  </div>
                  <p className="text-[10px] font-mono text-text-muted font-normal">
                    Heats temperature to &gt;90°C. Simulates cooling block failures.
                  </p>
                </button>

                <button
                  onClick={() => setMode("vibration")}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
                    mode === "vibration"
                      ? "bg-amber-500/5 border-amber-500 text-foreground"
                      : "bg-background/50 border-border-mute text-text-muted hover:border-zinc-400 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-amber-500" />
                    <span>Bearing Friction Wave</span>
                  </div>
                  <p className="text-[10px] font-mono text-text-muted font-normal">
                    Breaches the 8 mm/s vibration mark. Simulates mechanical stress.
                  </p>
                </button>
              </div>
            </div>

            <div className="mt-6 border-t border-border-mute pt-4 text-[10px] font-mono text-text-muted leading-relaxed">
              <span className="font-bold text-foreground">Status Log:</span> Selected simulator mode: <span className="text-emerald-500 font-bold uppercase">{mode}</span>. Telemetry sync speed: 400ms.
            </div>
          </div>

          {/* Simulated Dashboard Screen */}
          <div className="bg-surface border border-border-mute rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between min-w-0">
            {/* Header console bar */}
            <div className="px-5 py-3 border-b border-border-mute flex items-center justify-between bg-background/40">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  status === "Healthy" ? "bg-emerald-500" : status === "Warning" ? "bg-amber-500" : "bg-red-500"
                } animate-pulse`} />
                <span className="text-[10px] font-mono font-bold uppercase text-foreground">Unit: Pump-X90-Hydraulic</span>
              </div>
              <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                status === "Healthy"
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : status === "Warning"
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  : "bg-red-500/10 text-red-500 border border-red-500/20"
              }`}>
                {status}
              </span>
            </div>

            {/* Diagnostics Stats */}
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-border-mute">
              <div className="bg-background border border-border-mute p-3.5 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1 text-text-muted">
                  <Thermometer className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-mono uppercase font-bold tracking-wider">Temp</span>
                </div>
                <p className="text-base font-mono font-bold text-foreground">{temperature} °C</p>
              </div>

              <div className="bg-background border border-border-mute p-3.5 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1 text-text-muted">
                  <Activity className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-mono uppercase font-bold tracking-wider">Vibe</span>
                </div>
                <p className="text-base font-mono font-bold text-foreground">{vibration} mm/s</p>
              </div>

              <div className="bg-background border border-border-mute p-3.5 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1 text-text-muted">
                  <Gauge className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-mono uppercase font-bold tracking-wider">Press</span>
                </div>
                <p className="text-base font-mono font-bold text-foreground">{pressure} bar</p>
              </div>

              <div className="bg-background border border-border-mute p-3.5 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1 text-text-muted">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-mono uppercase font-bold tracking-wider">Est RUL</span>
                </div>
                <p className={`text-base font-mono font-bold ${
                  rul > 100 ? "text-foreground" : rul > 30 ? "text-amber-500" : "text-red-500"
                }`}>{rul} Days</p>
              </div>
            </div>

            {/* Vibration Scrolling Wave */}
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

            {/* AI Warning Bar */}
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
