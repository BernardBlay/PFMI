import { NextResponse } from "next/server";

export async function GET() {
  // Mock alerts data
  return NextResponse.json([
    { id: "ALT-01", equipmentName: "Rotary Motor C", severity: "High", message: "Bearing vibration exceeds safe threshold", timestamp: "2026-07-11T10:30:00Z" },
    { id: "ALT-02", equipmentName: "Cooling Fan B", severity: "Medium", message: "Temperature anomaly detected", timestamp: "2026-07-11T12:00:00Z" },
  ]);
}
