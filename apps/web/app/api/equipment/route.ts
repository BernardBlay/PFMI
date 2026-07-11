import { NextResponse } from "next/server";

export async function GET() {
  // Mock equipment data
  return NextResponse.json([
    { id: "EQ-101", name: "Hydraulic Pump A", status: "Healthy", healthScore: 94, lastService: "2026-06-15" },
    { id: "EQ-102", name: "Cooling Fan B", status: "Warning", healthScore: 72, lastService: "2026-05-10" },
    { id: "EQ-103", name: "Rotary Motor C", status: "Critical", healthScore: 45, lastService: "2026-07-01" },
  ]);
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ success: true, item: { id: `EQ-${Math.floor(Math.random() * 900) + 100}`, ...body } });
}
