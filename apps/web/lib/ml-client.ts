// Client for calling the Python FastAPI ML service
export interface MLPrediction {
  remainingUsefulLife: number;
  anomalyDetected: boolean;
  confidence: number;
}

function getMlServiceUrl() {
  return process.env.NEXT_PUBLIC_ML_SERVICE_URL || "http://localhost:8000";
}

export const mlClient = {
  predictRUL: async (sensorData: Record<string, number>): Promise<MLPrediction> => {
    const serviceUrl = getMlServiceUrl();
    
    try {
      const res = await fetch(`${serviceUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensors: sensorData }),
      });
      if (!res.ok) {
        throw new Error(`ML service returned ${res.status}`);
      }

      const data = await res.json();
      return {
        remainingUsefulLife: Number(data.remainingUsefulLife ?? 42),
        anomalyDetected: Boolean(data.anomalyDetected ?? false),
        confidence: Number(data.confidence ?? 0.89),
      };
    } catch (err) {
      console.warn("Could not connect to ML service, returning mock data:", err);
      return {
        remainingUsefulLife: 42,
        anomalyDetected: false,
        confidence: 0.89,
      };
    }
  },
};
