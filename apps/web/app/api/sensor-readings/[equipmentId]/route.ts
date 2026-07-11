import { NextResponse } from "next/server";
import { supabaseRestRequest } from "@/lib/supabase-rest";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ equipmentId: string }> }
) {
  try {
    const { equipmentId } = await params;
    const response = await supabaseRestRequest("sensor_readings", {
      query: {
        select: "*",
        equipment_id: `eq.${equipmentId}`,
        order: "timestamp",
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Database unavailable" }, { status: 503 });
  }
}
