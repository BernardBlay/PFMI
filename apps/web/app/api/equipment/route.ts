import { NextResponse } from "next/server";
import { supabaseRestRequest } from "@/lib/supabase-rest";

export async function GET() {
  try {
    const response = await supabaseRestRequest("equipment", {
      query: {
        select: "*",
        order: "name",
      },
    });
    return NextResponse.json(await response.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Database unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ success: true, item: { id: `EQ-${Math.floor(Math.random() * 900) + 100}`, ...body } });
}
