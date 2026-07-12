import { NextResponse } from "next/server";
import { supabaseRestRequest } from "@/lib/supabase-rest";
import { db } from "@/lib/db";
import { DEMO_ALERTS } from "@/lib/demo-data";

export async function GET() {
  try {
    const response = await supabaseRestRequest("alerts", {
      query: {
        select: "*,equipment(name)",
        resolved: "eq.false",
      },
    });
    const data = await response.json();
    return NextResponse.json(
      data.map((alert: any) => ({
        id: alert.id,
        equipment_id: alert.equipment_id,
        equipmentName: alert.equipment?.name || "Unknown Equipment",
        severity: alert.severity,
        message: alert.message,
        resolved: alert.resolved,
      }))
    );
  } catch {
    // Database not configured/unreachable — serve demo alerts
    return NextResponse.json(DEMO_ALERTS, { headers: { "x-pfmi-demo": "1" } });
  }
}

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing alert ID" }, { status: 400 });
    }
    const success = await db.resolveAlert(id);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
