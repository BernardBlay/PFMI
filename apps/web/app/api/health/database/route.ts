import { NextResponse } from "next/server";
import { supabaseRestRequest } from "@/lib/supabase-rest";

export async function GET() {
  try {
    const response = await supabaseRestRequest("equipment", {
      query: {
        select: "id",
        limit: 1,
      },
    });
    const equipment = await response.json();
    return NextResponse.json({ ok: true, equipmentCount: Array.isArray(equipment) ? equipment.length : 0 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Database unavailable" }, { status: 503 });
  }
}