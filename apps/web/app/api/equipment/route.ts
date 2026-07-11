import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const data = await db.getEquipment();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ success: true, item: { id: `EQ-${Math.floor(Math.random() * 900) + 100}`, ...body } });
}
