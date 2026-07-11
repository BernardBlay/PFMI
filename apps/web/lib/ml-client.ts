// Client for calling the Python FastAPI ML service
export interface MLPrediction {
  remainingUsefulLife: number;
  anomalyDetected: boolean;
  confidence: number;
}

export const mlClient = {
  predictRUL: async (sensorData: Record<string, number>): Promise<MLPrediction> => {
    const serviceUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";
    
    try {
      const res = await fetch(`${serviceUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensors: sensorData }),
      });
      return await res.json();
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
