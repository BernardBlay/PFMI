import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const db = {
  getEquipment: async () => {
    try {
      const { data, error } = await supabase.from("equipment").select("*").order("name");
      if (error || !data) {
        throw error || new Error("No data returned");
      }
      return data;
    } catch (error) {
      console.warn("Supabase fetch failed, using fallback mock data:", error);
      return [
        { id: "EQ-101", name: "Hydraulic Pump A", status: "Healthy", health_score: 94 },
        { id: "EQ-102", name: "Cooling Fan B", status: "Warning", health_score: 72 },
        { id: "EQ-103", name: "Rotary Motor C", status: "Critical", health_score: 45 },
      ];
    }
  },

  getAlerts: async () => {
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
        equipmentName: alert.equipment?.name || "Unknown Equipment",
        severity: alert.severity,
        message: alert.message,
      }));
    } catch (error) {
      console.warn("Supabase fetch failed, using fallback mock data:", error);
      return [
        { id: "ALT-01", equipmentName: "Rotary Motor C", severity: "High", message: "Bearing vibration exceeds safe threshold" },
        { id: "ALT-02", equipmentName: "Cooling Fan B", severity: "Medium", message: "Temperature anomaly detected" },
      ];
    }
  },

  resolveAlert: async (alertId: string) => {
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
  }) => {
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
};
