import { NextResponse } from "next/server";
import { supabaseRestRequest } from "@/lib/supabase-rest";

/**
 * POST /api/ml-predictions
 * 
 * Fetches ML-derived health predictions for equipment based on latest sensor readings.
 * This replaces static manual health scores with real-time ML predictions.
 * 
 * Body: { equipment_ids?: string[] } - Optional array of equipment IDs to predict for
 * 
 * Returns: Array of { equipment_id, health_score, rul_hours, severity, prediction_timestamp }
 */
export async function POST(req: Request) {
  try {
    const { equipment_ids } = await req.json();
    
    // Get ML service URL
    const mlServiceUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL || "http://localhost:8000";
    
    // Fetch all equipment or specific ones
    let equipmentQuery: any = { select: "*" };
    if (equipment_ids && Array.isArray(equipment_ids) && equipment_ids.length > 0) {
      equipmentQuery.id = `in.(${equipment_ids.join(",")})`;
    }
    
    const eqResponse = await supabaseRestRequest("equipment", { query: equipmentQuery });
    const equipment = await eqResponse.json();
    
    if (!Array.isArray(equipment) || equipment.length === 0) {
      return NextResponse.json([]);
    }
    
    // For each equipment, get latest sensor readings and predict
    const predictions = await Promise.all(
      equipment.map(async (eq) => {
        try {
          // Get latest sensor reading for this equipment
          const sensorResponse = await supabaseRestRequest("sensor_readings", {
            query: {
              select: "*",
              equipment_id: `eq.${eq.id}`,
              order: "timestamp.desc",
              limit: 1,
            },
          });
          
          const sensorData = await sensorResponse.json();
          const latestReading = Array.isArray(sensorData) ? sensorData[0] : null;
          
          if (!latestReading) {
            // No sensor data - return default healthy state
            const defaultPrediction = {
              equipment_id: eq.id,
              equipment_name: eq.name,
              health_score: 95,
              rul_hours: 240,
              rul_days: 30,
              severity: "normal",
              failure_mode: "none",
              recommendation: "No sensor data available. Equipment assumed healthy.",
              degradation_pct: 5,
              confidence: 0.5,
              prediction_timestamp: new Date().toISOString(),
              source: "default",
            };
            
            // Store in ml_predictions table (optional, will fail silently if RLS blocks)
            try {
              await supabaseRestRequest("ml_predictions", {
                method: "POST",
                body: JSON.stringify({
                  equipment_id: eq.id,
                  health_score: defaultPrediction.health_score,
                  rul_hours: defaultPrediction.rul_hours,
                  rul_days: defaultPrediction.rul_days,
                  severity: defaultPrediction.severity,
                  failure_mode: defaultPrediction.failure_mode,
                  recommendation: defaultPrediction.recommendation,
                  degradation_pct: defaultPrediction.degradation_pct,
                  confidence: defaultPrediction.confidence,
                  prediction_source: defaultPrediction.source,
                  prediction_timestamp: defaultPrediction.prediction_timestamp,
                }),
              });
            } catch {}
            
            return defaultPrediction;
          }
          
          // Call ML service with sensor readings
          const mlResponse = await fetch(`${mlServiceUrl}/predict/rul`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sensors: {
                temperature: latestReading.temperature || 68,
                vibration: latestReading.vibration || 2.3,
                pressure: latestReading.pressure || 4.2,
                rpm: latestReading.rpm || 1450,
                voltage: latestReading.voltage || 380,
                power_output: latestReading.power_output || 85,
              },
              operating_hours_per_day: 8.0,
              machine_age_factor: 1.0,
            }),
            signal: AbortSignal.timeout(5000),
          });
          
          if (!mlResponse.ok) {
            throw new Error(`ML service returned ${mlResponse.status}`);
          }
          
          const mlData = await mlResponse.json();
          
          // Convert RUL and degradation to health score (0-100)
          // health_score = 100 - degradation_pct
          const health_score = Math.max(0, Math.min(100, 100 - (mlData.degradation_pct || 0)));
          
          const mlPrediction = {
            equipment_id: eq.id,
            equipment_name: eq.name,
            health_score,
            rul_hours: mlData.rul_hours || 240,
            rul_days: mlData.rul_days || 30,
            severity: mlData.severity || "normal",
            failure_mode: mlData.failure_mode || "none",
            recommendation: mlData.recommendation || "",
            degradation_pct: mlData.degradation_pct || 0,
            confidence: mlData.confidence || 0.85,
            sensor_breakdown: mlData.sensor_breakdown || [],
            prediction_timestamp: new Date().toISOString(),
            source: "ml",
          };
          
          // Store in ml_predictions table (optional, will fail silently if RLS blocks)
          try {
            await supabaseRestRequest("ml_predictions", {
              method: "POST",
              body: JSON.stringify({
                equipment_id: eq.id,
                health_score: mlPrediction.health_score,
                rul_hours: mlPrediction.rul_hours,
                rul_days: mlPrediction.rul_days,
                severity: mlPrediction.severity,
                failure_mode: mlPrediction.failure_mode,
                recommendation: mlPrediction.recommendation,
                degradation_pct: mlPrediction.degradation_pct,
                confidence: mlPrediction.confidence,
                sensor_data: latestReading,
                prediction_source: mlPrediction.source,
                prediction_timestamp: mlPrediction.prediction_timestamp,
              }),
            });
          } catch {}
          
          return mlPrediction;
          
        } catch (err: any) {
          console.error(`[ml-predictions] Failed for ${eq.id}:`, err.message);
          
          // Fallback to current DB value
          return {
            equipment_id: eq.id,
            equipment_name: eq.name,
            health_score: eq.health_score || 95,
            rul_hours: 240,
            rul_days: 30,
            severity: eq.status === "Critical" ? "critical" : eq.status === "Warning" ? "medium" : "normal",
            failure_mode: "unknown",
            recommendation: "ML service unavailable. Showing last known status.",
            degradation_pct: 100 - (eq.health_score || 95),
            confidence: 0.5,
            prediction_timestamp: new Date().toISOString(),
            source: "fallback",
          };
        }
      })
    );
    
    return NextResponse.json(predictions);
    
  } catch (err: any) {
    console.error("[ml-predictions] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch ML predictions" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ml-predictions?equipment_id=HT-005
 * 
 * Get ML prediction for a single equipment item
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const equipment_id = searchParams.get("equipment_id");
    
    if (!equipment_id) {
      return NextResponse.json(
        { error: "equipment_id parameter required" },
        { status: 400 }
      );
    }
    
    // Call POST with single equipment ID
    const response = await POST(
      new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify({ equipment_ids: [equipment_id] }),
      })
    );
    
    const predictions = await response.json();
    const prediction = Array.isArray(predictions) ? predictions[0] : null;
    
    if (!prediction) {
      return NextResponse.json(
        { error: "Equipment not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(prediction);
    
  } catch (err: any) {
    console.error("[ml-predictions GET] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch prediction" },
      { status: 500 }
    );
  }
}
