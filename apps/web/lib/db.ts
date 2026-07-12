import { createClient } from "@supabase/supabase-js";
import { supabaseRestRequest } from "@/lib/supabase-rest";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

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

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at?: string;
}

export const db = {
  getEquipment: async (): Promise<Equipment[]> => {
    const response = await supabaseRestRequest("equipment", {
      query: { select: "*", order: "name" },
    });
    return await response.json();
  },

  getEquipmentById: async (id: string): Promise<Equipment | null> => {
    const response = await supabaseRestRequest("equipment", {
      query: { select: "*", id: `eq.${id}`, limit: 1 },
    });
    const data = await response.json();
    return Array.isArray(data) ? data[0] || null : data || null;
  },

  getAlerts: async (): Promise<Alert[]> => {
    const response = await supabaseRestRequest("alerts", {
      query: { select: "*,equipment(name)", resolved: "eq.false" },
    });
    const data = await response.json();
    return data.map((alert: any) => ({
      id: alert.id,
      equipment_id: alert.equipment_id,
      equipmentName: alert.equipment?.name || "Unknown Equipment",
      severity: alert.severity,
      message: alert.message,
      resolved: alert.resolved,
    }));
  },

  resolveAlert: async (alertId: string): Promise<boolean> => {
    await supabaseRestRequest(`alerts?id=eq.${encodeURIComponent(alertId)}`, {
      method: "PATCH",
      body: JSON.stringify({ resolved: true, resolved_at: new Date().toISOString() }),
    });
    return true;
  },

  insertMaintenanceLog: async (log: {
    equipment_id: string;
    technician: string;
    service_date: string;
    notes: string;
    status_after_service: string;
    extracted_text?: string;
  }): Promise<MaintenanceLog | null> => {
    const insertResponse = await supabaseRestRequest("maintenance_logs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([log]),
    });
    const data = await insertResponse.json();

    let healthScore = 100;
    let status = "Healthy";
    if (log.status_after_service === "Warning") {
      healthScore = 72;
      status = "Warning";
    } else if (log.status_after_service === "Critical") {
      healthScore = 45;
      status = "Critical";
    }

    await supabaseRestRequest(`equipment?id=eq.${encodeURIComponent(log.equipment_id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        health_score: healthScore,
        updated_at: new Date().toISOString(),
      }),
    });

    return data?.[0] || null;
  },

  getSensorReadings: async (equipmentId: string): Promise<SensorReading[]> => {
    const response = await supabaseRestRequest("sensor_readings", {
      query: { select: "*", equipment_id: `eq.${equipmentId}`, order: "timestamp" },
    });
    return await response.json();
  },

  getMaintenanceLogs: async (equipmentId: string): Promise<MaintenanceLog[]> => {
    const response = await supabaseRestRequest("maintenance_logs", {
      query: { select: "*", equipment_id: `eq.${equipmentId}`, order: "service_date.desc" },
    });
    return await response.json();
  },

  getMostCriticalAlert: async (): Promise<Alert | null> => {
    const response = await supabaseRestRequest("alerts", {
      query: { select: "*,equipment(name)", resolved: "eq.false" },
    });
    const data = await response.json();
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
  },

  getProfile: async (id: string): Promise<Profile | null> => {
    const response = await supabaseRestRequest("profiles", {
      query: { select: "*", id: `eq.${id}`, limit: 1 },
    });
    const data = await response.json();
    return Array.isArray(data) ? data[0] || null : data || null;
  },

  updateProfile: async (profile: Partial<Profile> & { id: string }): Promise<Profile | null> => {
    const response = await supabaseRestRequest(`profiles?id=eq.${encodeURIComponent(profile.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(profile),
    });
    const data = await response.json();
    return Array.isArray(data) ? data[0] || null : data || null;
  },
};
