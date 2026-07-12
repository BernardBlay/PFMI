import { Equipment, Alert } from "@/lib/db";

/**
 * Demo fallback fleet — served by the equipment/alerts GET routes when the
 * Supabase database is not configured or unreachable, so the dashboard
 * stays fully functional in demo mode ("no installation required").
 */
export const DEMO_EQUIPMENT: Equipment[] = [
  { id: "demo-haul-truck-01", name: "Haul Truck HT-01", status: "Healthy", health_score: 92 },
  { id: "demo-excavator-02", name: "Excavator EX-02", status: "Healthy", health_score: 88 },
  { id: "demo-drill-rig-03", name: "Drill Rig DR-03", status: "Warning", health_score: 67 },
  { id: "demo-bulldozer-04", name: "Bulldozer BD-04", status: "Critical", health_score: 41 },
  { id: "demo-grinder-05", name: "Ore Grinder OG-05", status: "Healthy", health_score: 95 },
  { id: "demo-conveyor-06", name: "Conveyor Belt CV-06", status: "Warning", health_score: 72 },
];

export const DEMO_ALERTS: Alert[] = [
  {
    id: "demo-alert-01",
    equipment_id: "demo-bulldozer-04",
    equipmentName: "Bulldozer BD-04",
    severity: "Critical",
    message: "Hydraulic pressure trending 34% below operating floor. RUL estimate: 6 days. Schedule immediate inspection.",
    resolved: false,
  },
  {
    id: "demo-alert-02",
    equipment_id: "demo-drill-rig-03",
    equipmentName: "Drill Rig DR-03",
    severity: "High",
    message: "Vibration anomaly detected on main bearing — pattern matches early-stage spall signature.",
    resolved: false,
  },
  {
    id: "demo-alert-03",
    equipment_id: "demo-conveyor-06",
    equipmentName: "Conveyor Belt CV-06",
    severity: "Medium",
    message: "Motor temperature drift +8°C over 48h baseline. Monitor lubrication cycle.",
    resolved: false,
  },
];
