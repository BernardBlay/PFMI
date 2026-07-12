import { NextResponse } from "next/server";
import { supabaseRestRequest } from "@/lib/supabase-rest";
import { DEMO_EQUIPMENT } from "@/lib/demo-data";

export async function GET() {
  try {
    const response = await supabaseRestRequest("equipment", {
      query: {
        select: "*",
        order: "name",
      },
    });
    return NextResponse.json(await response.json());
  } catch {
    // Database not configured/unreachable — serve the demo fleet
    return NextResponse.json(DEMO_EQUIPMENT, { headers: { "x-pfmi-demo": "1" } });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ success: true, item: { id: `EQ-${Math.floor(Math.random() * 900) + 100}`, ...body } });
}
