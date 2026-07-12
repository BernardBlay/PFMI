import { NextResponse } from "next/server";
import { supabaseRestRequest } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

function mapSensors(s: {
  temperature: number;
  vibration: number;
  pressure: number;
}): Record<string, number> {
  const { temperature, vibration, pressure } = s;
  const rpm = 1450;
  const torque = vibration * 18;
  const toolWear = Math.max(0, (temperature - 60) * 2.5);
  const airTemp = 25.0;
  return {
    air_temp: airTemp,
    process_temp: temperature,
    rpm,
    torque,
    tool_wear: toolWear,
    power_w: (rpm * torque * 2 * Math.PI) / 60,
    temp_diff: temperature - airTemp,
    wear_x_torque: toolWear * torque,
    vibration_rms: vibration,
    pressure_bar: pressure,
  };
}

function rulFromPrediction(prediction: string, confidence: number): number {
  const base: Record<string, number> = {
    normal: 240,
    no_failure: 240,
    heat_dissipation: 60,
    power_failure: 30,
    overstrain: 20,
    tool_wear: 45,
    random_failures: 15,
    failure: 20,
    none: 240,
  };
  const baseDays = base[prediction] ?? 90;
  return Math.round(baseDays * (0.6 + confidence * 0.4));
}

function deriveHealthScore(prediction: string, confidence: number): number {
  const isNormal =
    prediction === "none" ||
    prediction === "normal" ||
    prediction === "no_failure";
  if (isNormal) return Math.min(100, Math.round(90 + confidence * 10));
  if (confidence > 0.75) return Math.round(45 - (1 - confidence) * 10);
  return Math.round(65 + (1 - confidence) * 15);
}

function statusFromScore(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Warning";
  return "Critical";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ equipmentId: string }> }
) {
  const { equipmentId } = await params;

  // 1. Fetch latest sensor reading
  let reading: Record<string, unknown> | null = null;
  try {
    const res = await supabaseRestRequest("sensor_readings", {
      query: {
        select: "*",
        equipment_id: `eq.${equipmentId}`,
        order: "timestamp.desc",
        limit: 1,
      },
    });
    const data = await res.json();
    reading = Array.isArray(data) ? (data[0] as Record<string, unknown>) ?? null : null;
  } catch {
    return NextResponse.json({ source: "no_data", rul_days: null, prediction: null, confidence: null });
  }

  if (!reading) {
    return NextResponse.json({ source: "no_data", rul_days: null, prediction: null, confidence: null });
  }

  const sensorUsed = {
    temperature: Number(reading["temperature"] ?? 68),
    vibration: Number(reading["vibration"] ?? 2.3),
    pressure: Number(reading["pressure"] ?? 4.2),
  };

  // 2. Map to generic model features
  const mappedSensors = mapSensors(sensorUsed);

  // 3. Call ML service
  let prediction = "none";
  let confidence = 0.9;
  let failureModes: string[] = [];
  let mlSource: "ml" | "ml_offline" = "ml";

  try {
    const mlRes = await fetch(`${ML_URL}/predict/generic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensors: mappedSensors }),
      signal: AbortSignal.timeout(5000),
    });

    if (mlRes.ok) {
      const mlData = await mlRes.json();
      prediction = mlData.prediction ?? "none";
      confidence = Number(mlData.confidence ?? 0.9);
      failureModes = mlData.failure_modes ?? [];
    } else {
      mlSource = "ml_offline";
    }
  } catch {
    mlSource = "ml_offline";
  }

  if (mlSource === "ml_offline") {
    return NextResponse.json({
      source: "ml_offline",
      rul_days: null,
      prediction: null,
      confidence: null,
      sensor_used: sensorUsed,
    });
  }

  // 4. Derive RUL + health score
  const rulDays = rulFromPrediction(prediction, confidence);
  const healthScore = deriveHealthScore(prediction, confidence);
  const status = statusFromScore(healthScore);

  // 5. Write health_score + status back to equipment table
  try {
    await supabaseRestRequest(`equipment?id=eq.${encodeURIComponent(equipmentId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        health_score: healthScore,
        status,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Non-fatal — still return the prediction
  }

  return NextResponse.json({
    source: "ml",
    prediction,
    confidence,
    rul_days: rulDays,
    health_score: healthScore,
    status,
    failure_modes: failureModes,
    sensor_used: sensorUsed,
  });
}
