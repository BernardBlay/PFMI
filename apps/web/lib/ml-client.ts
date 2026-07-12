/**
 * PFMI ML Service Client
 * ----------------------
 * Connects to the FastAPI ML service at NEXT_PUBLIC_ML_SERVICE_URL.
 * Endpoints used:
 *   GET  /health        → service + model status
 *   POST /predict/rul   → physics-informed RUL engine (hours until failure)
 *   POST /predict       → legacy fallback (also RUL-powered on server)
 */

function getServiceUrl(): string {
  return (
    (typeof window !== "undefined"
      ? (window as any).__ENV__?.NEXT_PUBLIC_ML_SERVICE_URL
      : undefined) ||
    process.env.NEXT_PUBLIC_ML_SERVICE_URL ||
    "http://localhost:8000"
  );
}

// ─── Response types ────────────────────────────────────────────────────────

export interface MLHealthStatus {
  online: boolean;
  status: "healthy" | "degraded" | "offline";
  modelsLoaded: number;
  modelsTotal: number;
  details: Record<string, string>;
}

export interface SensorBreakdown {
  sensor: string;
  current: number;
  nominal: number;
  failure_threshold: number;
  margin_pct: number;   // 100 = healthy, 0 = at failure threshold
  rul_hours: number;
  unit: string;
  is_critical: boolean;
}

export interface MLPrediction {
  // Core RUL values — now real numbers, not mock days
  rul_hours: number;          // e.g. 78.4 — the main display value
  rul_days: number;           // e.g. 9.8 days at 8h/day operation
  remainingUsefulLife: number; // same as rul_hours (backwards compat)

  anomalyDetected: boolean;
  anomaly_detected: boolean;
  confidence: number;
  failureMode: string;
  failure_mode: string;
  severity: "normal" | "low" | "medium" | "high" | "critical";
  degradation_pct: number;    // 0 = new, 100 = failed
  recommendation: string;     // plain-English action e.g. "Schedule service in 78h"
  sensor_breakdown: SensorBreakdown[];
  source: "ml" | "mock";
}

// ─── Sensor mapping ────────────────────────────────────────────────────────
// Maps simulator keys → RUL engine sensor names
// The engine accepts any subset — extra keys are ignored gracefully.

function buildRULSensors(sensors: {
  temperature: number;
  vibration: number;
  pressure: number;
}): Record<string, number> {
  const { temperature, vibration, pressure } = sensors;

  // Derive proxy values for sensors not directly exposed by the simulator
  const rpm = 1450;
  const torque = vibration * 18;
  const toolWear = Math.max(0, (temperature - 60) * 2.5);

  return {
    temperature,
    vibration,
    pressure,
    rpm,
    torque,
    tool_wear: toolWear,
    // also pass AI4I-style names for generic model compat
    process_temp: temperature,
    pressure_bar: pressure,
    vibration_rms: vibration,
  };
}

// ─── Mock fallback ─────────────────────────────────────────────────────────
// Used when ML service is offline — mirrors the RUL engine logic in TS.

function mockPrediction(sensors: {
  temperature: number;
  vibration: number;
  pressure: number;
}): MLPrediction {
  const { temperature, vibration } = sensors;

  const isCritical = temperature > 90 || vibration > 8;
  const isHigh = temperature > 80 || vibration > 5;

  let rul_hours = 240;
  let failure_mode = "normal";
  let severity: MLPrediction["severity"] = "normal";
  let recommendation = `Machine healthy. Next scheduled service in ~240 hours (30.0 days).`;

  if (isCritical) {
    rul_hours = temperature > 90 ? 12 : 18;
    failure_mode = temperature > 90 ? "thermal_runaway" : "bearing_failure";
    severity = "critical";
    recommendation = `STOP MACHINE — ${failure_mode.replace(/_/g, " ")} detected. Estimated ${rul_hours} hours remaining. Schedule immediate inspection.`;
  } else if (isHigh) {
    rul_hours = temperature > 80 ? 60 : 80;
    failure_mode = temperature > 80 ? "overheating" : "bearing_wear";
    severity = "high";
    recommendation = `URGENT — ${failure_mode.replace(/_/g, " ")} progressing. Schedule maintenance within ${rul_hours} hours (${(rul_hours / 8).toFixed(1)} days).`;
  }

  return {
    rul_hours,
    rul_days: Math.round((rul_hours / 8) * 10) / 10,
    remainingUsefulLife: rul_hours,
    anomalyDetected: isCritical || isHigh,
    anomaly_detected: isCritical || isHigh,
    confidence: 0.75,
    failureMode: failure_mode,
    failure_mode,
    severity,
    degradation_pct: isCritical ? 90 : isHigh ? 55 : 5,
    recommendation,
    sensor_breakdown: [],
    source: "mock",
  };
}

// ─── API calls ─────────────────────────────────────────────────────────────

/**
 * Check if the ML service is reachable and which models are loaded.
 */
export async function checkMLHealth(): Promise<MLHealthStatus> {
  const url = getServiceUrl();
  try {
    const res = await fetch(`${url}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      online: true,
      status: data.status === "healthy" ? "healthy" : "degraded",
      modelsLoaded: data.models_loaded ?? 0,
      modelsTotal: data.models_total ?? 0,
      details: data.details ?? {},
    };
  } catch {
    return { online: false, status: "offline", modelsLoaded: 0, modelsTotal: 0, details: {} };
  }
}

/**
 * Primary prediction function.
 *
 * Calls /predict/rul first (full RUL breakdown with hours + recommendation).
 * Falls back to /predict if /predict/rul not available.
 * Falls back to mock if service is offline.
 */
export async function predictFromSensors(sensors: {
  temperature: number;
  vibration: number;
  pressure: number;
}): Promise<MLPrediction> {
  const url = getServiceUrl();
  const rulSensors = buildRULSensors(sensors);

  // ── Primary: /predict/rul ─────────────────────────────────────────────
  try {
    const res = await fetch(`${url}/predict/rul`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensors: rulSensors, operating_hours_per_day: 8.0 }),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const d = await res.json();
      return {
        rul_hours:           Number(d.rul_hours ?? 240),
        rul_days:            Number(d.rul_days ?? 30),
        remainingUsefulLife: Number(d.rul_hours ?? 240),
        anomalyDetected:     Boolean(d.anomaly_detected ?? d.anomalyDetected ?? false),
        anomaly_detected:    Boolean(d.anomaly_detected ?? false),
        confidence:          Number(d.confidence ?? 0.85),
        failureMode:         String(d.failure_mode ?? "normal"),
        failure_mode:        String(d.failure_mode ?? "normal"),
        severity:            (d.severity ?? "normal") as MLPrediction["severity"],
        degradation_pct:     Number(d.degradation_pct ?? 0),
        recommendation:      String(d.recommendation ?? ""),
        sensor_breakdown:    Array.isArray(d.sensor_breakdown) ? d.sensor_breakdown : [],
        source:              "ml",
      };
    }
  } catch (err: any) {
    console.warn("[ml-client] /predict/rul unreachable, trying /predict:", err?.message);
  }

  // ── Fallback: /predict ────────────────────────────────────────────────
  try {
    const res = await fetch(`${url}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensors: rulSensors, operating_hours_per_day: 8.0 }),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const d = await res.json();
      const rul_hours = Number(d.rul_hours ?? d.remainingUsefulLife ?? 240);
      return {
        rul_hours,
        rul_days:            Number(d.rul_days ?? rul_hours / 8),
        remainingUsefulLife: rul_hours,
        anomalyDetected:     Boolean(d.anomaly_detected ?? d.anomalyDetected ?? false),
        anomaly_detected:    Boolean(d.anomaly_detected ?? false),
        confidence:          Number(d.confidence ?? 0.85),
        failureMode:         String(d.failure_mode ?? "normal"),
        failure_mode:        String(d.failure_mode ?? "normal"),
        severity:            (d.severity ?? "normal") as MLPrediction["severity"],
        degradation_pct:     Number(d.degradation_pct ?? 0),
        recommendation:      String(d.recommendation ?? ""),
        sensor_breakdown:    Array.isArray(d.sensor_breakdown) ? d.sensor_breakdown : [],
        source:              "ml",
      };
    }
  } catch (err: any) {
    console.warn("[ml-client] /predict also unreachable:", err?.message);
  }

  // ── Mock fallback ─────────────────────────────────────────────────────
  return mockPrediction(sensors);
}

// ─── Legacy export ─────────────────────────────────────────────────────────

export const mlClient = {
  predictRUL: async (sensors: Record<string, number>) => {
    const result = await predictFromSensors({
      temperature: sensors.temperature ?? 68,
      vibration:   sensors.vibration   ?? 2.3,
      pressure:    sensors.pressure    ?? 4.2,
    });
    return {
      remainingUsefulLife: result.rul_hours,
      anomalyDetected:     result.anomalyDetected,
      confidence:          result.confidence,
    };
  },
};
