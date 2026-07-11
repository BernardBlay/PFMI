/**
 * PFMI ML Service Client
 * ----------------------
 * Connects to the FastAPI ML service at NEXT_PUBLIC_ML_SERVICE_URL.
 * Endpoints used:
 *   GET  /health              → service + model status
 *   POST /predict/generic     → XGBoost generic industrial model (best match for pump sensors)
 *   POST /predict             → legacy fallback
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

export interface MLPrediction {
  remainingUsefulLife: number;
  anomalyDetected: boolean;
  confidence: number;
  failureMode: string;
  source: "ml" | "mock";
}

// ─── Sensor name mapping ────────────────────────────────────────────────────
// The simulator uses human-friendly keys (temperature, vibration, pressure).
// The generic XGBoost model expects AI4I-style feature names.
// This function maps simulator readings → model feature vector.

function mapSimulatorSensorsToGeneric(sensors: {
  temperature: number;
  vibration: number;
  pressure: number;
}): Record<string, number> {
  const { temperature, vibration, pressure } = sensors;

  // Reasonable synthetic defaults for features the simulator doesn't expose
  const rpm = 1450;
  const torque = vibration * 18;          // proxy: higher vibration → more torque stress
  const toolWear = Math.max(0, (temperature - 60) * 2.5); // proxy: heat accelerates wear
  const airTemp = 25.0;

  return {
    air_temp: airTemp,
    process_temp: temperature,
    rpm,
    torque,
    tool_wear: toolWear,
    // Derived features the model computes internally, but we pre-supply them
    // so the endpoint doesn't have to re-derive (it will if missing anyway):
    power_w: (rpm * torque * 2 * Math.PI) / 60,
    temp_diff: temperature - airTemp,
    wear_x_torque: toolWear * torque,
    // Extra contextual channels
    vibration_rms: vibration,
    pressure_bar: pressure,
  };
}

// RUL estimate from generic model output:
// "normal" → high RUL, "wear" → medium, failure modes → low
function rulFromPrediction(prediction: string, confidence: number): number {
  const base: Record<string, number> = {
    normal: 240,
    "no_failure": 240,
    "heat_dissipation": 60,
    "power_failure": 30,
    "overstrain": 20,
    "tool_wear": 45,
    "random_failures": 15,
  };
  const baseDays = base[prediction] ?? 90;
  // Scale by confidence — lower confidence = more conservative estimate
  return Math.round(baseDays * (0.6 + confidence * 0.4));
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
    return {
      online: false,
      status: "offline",
      modelsLoaded: 0,
      modelsTotal: 0,
      details: {},
    };
  }
}

/**
 * Call /predict/generic with mapped sensor data.
 * Falls back to /predict (legacy) if generic returns 503.
 * Falls back to mock data if service is unreachable.
 */
export async function predictFromSensors(sensors: {
  temperature: number;
  vibration: number;
  pressure: number;
}): Promise<MLPrediction> {
  const url = getServiceUrl();
  const mappedSensors = mapSimulatorSensorsToGeneric(sensors);

  // ── Try /predict/generic first ──
  try {
    const res = await fetch(`${url}/predict/generic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensors: mappedSensors }),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = await res.json();
      // data: { prediction: string, confidence: number, failure_modes: string[] }
      const prediction: string = data.prediction ?? "normal";
      const confidence: number = Number(data.confidence ?? 0.9);
      const rul = rulFromPrediction(prediction, confidence);
      const anomaly = prediction !== "normal" && prediction !== "no_failure";

      return {
        remainingUsefulLife: rul,
        anomalyDetected: anomaly,
        confidence,
        failureMode: prediction,
        source: "ml",
      };
    }

    // 503 = generic model not loaded, try legacy
    if (res.status === 503) throw new Error("generic_not_loaded");
  } catch (err: any) {
    if (err?.message !== "generic_not_loaded") {
      console.warn("[ml-client] /predict/generic unreachable, trying legacy /predict:", err?.message);
    }
  }

  // ── Fallback: /predict (legacy) ──
  try {
    const res = await fetch(`${url}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensors: mappedSensors }),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        remainingUsefulLife: Number(data.remainingUsefulLife ?? 42),
        anomalyDetected: Boolean(data.anomalyDetected ?? false),
        confidence: Number(data.confidence ?? 0.89),
        failureMode: data.anomalyDetected ? "detected" : "normal",
        source: "ml",
      };
    }
  } catch (err: any) {
    console.warn("[ml-client] /predict also unreachable:", err?.message);
  }

  // ── Mock fallback ──
  const isCritical = sensors.temperature > 90 || sensors.vibration > 8;
  const isWarning = sensors.temperature > 80 || sensors.vibration > 5;
  return {
    remainingUsefulLife: isCritical ? 12 : isWarning ? 45 : 240,
    anomalyDetected: isCritical || isWarning,
    confidence: 0.88,
    failureMode: isCritical ? "overstrain" : isWarning ? "heat_dissipation" : "normal",
    source: "mock",
  };
}

// ─── Legacy export (used by existing callers) ──────────────────────────────
export const mlClient = {
  predictRUL: async (sensors: Record<string, number>) => {
    const result = await predictFromSensors({
      temperature: sensors.temperature ?? 68,
      vibration: sensors.vibration ?? 2.3,
      pressure: sensors.pressure ?? 4.2,
    });
    return {
      remainingUsefulLife: result.remainingUsefulLife,
      anomalyDetected: result.anomalyDetected,
      confidence: result.confidence,
    };
  },
};
