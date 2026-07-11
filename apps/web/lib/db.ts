import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Equipment {
  id: string;
  name: string;
  status: string;
  health_score: number;
  created_at?: string;
  updated_at?: string;
}

export interface SensorReading {
  id: number;
  equipment_id: string;
  timestamp: string;
  vibration: number;
  temperature: number;
  pressure: number;
  voltage: number;
}

export interface MaintenanceLog {
  id: number;
  equipment_id: string;
  technician: string;
  service_date: string;
  notes: string;
  status_after_service: string;
  extracted_text?: string;
  created_at?: string;
}

export interface Alert {
  id: string;
  equipment_id: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  message: string;
  resolved: boolean;
  created_at?: string;
  resolved_at?: string | null;
  equipmentName?: string;
}

// Fallback Mock Data
const MOCK_EQUIPMENT: Equipment[] = [
  { id: "EQ-101", name: "Hydraulic Pump A", status: "Healthy", health_score: 94 },
  { id: "EQ-102", name: "Cooling Fan B", status: "Warning", health_score: 72 },
  { id: "EQ-103", name: "Rotary Motor C", status: "Critical", health_score: 45 },
];

const MOCK_ALERTS: Alert[] = [
  { id: "ALT-01", equipment_id: "EQ-103", severity: "High", message: "Bearing vibration exceeds safe threshold", resolved: false },
  { id: "ALT-02", equipment_id: "EQ-102", severity: "Medium", message: "Temperature anomaly detected", resolved: false },
];

export const db = {
  getEquipment: async (): Promise<Equipment[]> => {
    try {
      const { data, error } = await supabase.from("equipment").select("*").order("name");
      if (error || !data) {
        throw error || new Error("No data returned");
      }
      return data;
    } catch (error) {
      console.warn("Supabase fetch failed, using fallback mock data:", error);
      return MOCK_EQUIPMENT;
    }
  },

  getEquipmentById: async (id: string): Promise<Equipment | null> => {
    try {
      const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single();
      if (error || !data) {
        throw error || new Error("No data returned");
      }
      return data;
    } catch (error) {
      console.warn(`Supabase fetch failed for equipment ${id}, using fallback:`, error);
      return MOCK_EQUIPMENT.find((eq) => eq.id === id) || null;
    }
  },

  getAlerts: async (): Promise<Alert[]> => {
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("*, equipment(name)")
        .eq("resolved", false);
      if (error || !data) {
        throw error || new Error("No data returned");
      }
      return data.map((alert: any) => ({
        id: alert.id,
        equipment_id: alert.equipment_id,
        equipmentName: alert.equipment?.name || "Unknown Equipment",
        severity: alert.severity,
        message: alert.message,
        resolved: alert.resolved,
      }));
    } catch (error) {
      console.warn("Supabase fetch failed, using fallback mock data:", error);
      return MOCK_ALERTS.map(a => {
        const eq = MOCK_EQUIPMENT.find(e => e.id === a.equipment_id);
        return {
          ...a,
          equipmentName: eq ? eq.name : "Unknown Equipment"
        };
      });
    }
  },

  resolveAlert: async (alertId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Failed to resolve alert:", error);
      return false;
    }
  },

  insertMaintenanceLog: async (log: {
    equipment_id: string;
    technician: string;
    service_date: string;
    notes: string;
    status_after_service: string;
    extracted_text?: string;
  }): Promise<MaintenanceLog | null> => {
    try {
      const { data, error } = await supabase.from("maintenance_logs").insert([log]).select();
      if (error) throw error;

      // Update equipment status and health score dynamically
      let healthScore = 100;
      let status = "Healthy";
      if (log.status_after_service === "Warning") {
        healthScore = 72;
        status = "Warning";
      } else if (log.status_after_service === "Critical") {
        healthScore = 45;
        status = "Critical";
      }
      
      await supabase
        .from("equipment")
        .update({ status, health_score: healthScore, updated_at: new Date().toISOString() })
        .eq("id", log.equipment_id);

      return data?.[0] || null;
    } catch (error) {
      console.error("Failed to insert maintenance log:", error);
      return {
        id: Math.floor(Math.random() * 1000),
        ...log,
      };
    }
  },

  getSensorReadings: async (equipmentId: string): Promise<SensorReading[]> => {
    try {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("*")
        .eq("equipment_id", equipmentId)
        .order("timestamp", { ascending: true });
      if (error || !data) {
        throw error || new Error("No data returned");
      }
      return data;
    } catch (error) {
      console.warn(`Supabase fetch failed for sensor readings of ${equipmentId}, using generated mock:`, error);
      // Generate 20 historical readings
      const readings: SensorReading[] = [];
      const now = new Date();
      
      // Set baseline values based on equipment type/status
      const eq = MOCK_EQUIPMENT.find(e => e.id === equipmentId);
      const isCritical = eq?.status === "Critical";
      const isWarning = eq?.status === "Warning";
      
      let tempBase = 65.0;
      let vibBase = 0.2;
      let pressBase = 100.0;
      let voltBase = 220.0;
      
      if (isCritical) {
        tempBase = 88.0;
        vibBase = 0.85;
        pressBase = 125.0;
      } else if (isWarning) {
        tempBase = 76.0;
        vibBase = 0.45;
        pressBase = 112.0;
      }

      for (let i = 19; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 5 * 60 * 1000); // 5 mins intervals
        const noise = Math.sin(i / 2);
        
        readings.push({
          id: 1000 + i,
          equipment_id: equipmentId,
          timestamp: time.toISOString(),
          temperature: tempBase + noise * 2.0 + Math.random() * 0.5,
          vibration: Math.max(0.01, vibBase + noise * 0.05 + Math.random() * 0.02),
          pressure: pressBase + noise * 5.0 + Math.random() * 1.5,
          voltage: voltBase + Math.sin(i) * 1.5 + Math.random() * 0.2,
        });
      }
      return readings;
    }
  },

  getMaintenanceLogs: async (equipmentId: string): Promise<MaintenanceLog[]> => {
    try {
      const { data, error } = await supabase
        .from("maintenance_logs")
        .select("*")
        .eq("equipment_id", equipmentId)
        .order("service_date", { ascending: false });
      if (error || !data) {
        throw error || new Error("No data returned");
      }
      return data;
    } catch (error) {
      console.warn(`Supabase fetch failed for maintenance logs of ${equipmentId}, using fallback:`, error);
      const mockLogs: MaintenanceLog[] = [
        {
          id: 201,
          equipment_id: "EQ-101",
          technician: "Operator 04",
          service_date: "2026-07-01",
          notes: "Routine lubrication of bearings and visual inspection. Pump running within nominal ranges.",
          status_after_service: "Healthy",
        },
        {
          id: 202,
          equipment_id: "EQ-102",
          technician: "J. Miller",
          service_date: "2026-07-06",
          notes: "Cleaned external dust from cooling fins. Internal motor temperature remains slightly high.",
          status_after_service: "Warning",
        },
        {
          id: 203,
          equipment_id: "EQ-103",
          technician: "S. Chen",
          service_date: "2026-07-10",
          notes: "Detected severe bearing vibration. Attempted mechanical realigning, but replacement of rotor is necessary.",
          status_after_service: "Critical",
        },
      ];
      return mockLogs.filter((log) => log.equipment_id === equipmentId);
    }
  },

  getMostCriticalAlert: async (): Promise<Alert | null> => {
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("*, equipment(name)")
        .eq("resolved", false);
      if (error || !data) {
        throw error || new Error("No data returned");
      }
      if (data.length === 0) return null;
      
      const severityOrder: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      let mostCritical = data[0];
      
      for (const alert of data) {
        const currentScore = severityOrder[alert.severity] || 0;
        const topScore = severityOrder[mostCritical.severity] || 0;
        if (currentScore > topScore) {
          mostCritical = alert;
        }
      }
      
      return {
        id: mostCritical.id,
        equipment_id: mostCritical.equipment_id,
        equipmentName: mostCritical.equipment?.name || "Unknown Equipment",
        severity: mostCritical.severity,
        message: mostCritical.message,
        resolved: mostCritical.resolved,
      };
    } catch (error) {
      console.warn("Supabase fetch failed for critical alert, using fallback:", error);
      if (MOCK_ALERTS.length === 0) return null;
      const severityOrder: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      let mostCritical = MOCK_ALERTS[0];
      for (const alert of MOCK_ALERTS) {
        const currentScore = severityOrder[alert.severity] || 0;
        const topScore = severityOrder[mostCritical.severity] || 0;
        if (currentScore > topScore) {
          mostCritical = alert;
        }
      }
      const eq = MOCK_EQUIPMENT.find(e => e.id === mostCritical.equipment_id);
      return {
        ...mostCritical,
        equipmentName: eq ? eq.name : "Unknown Equipment"
      };
    }
  },
};
