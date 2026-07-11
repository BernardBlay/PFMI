import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ equipmentId: string }> }
) {
  try {
    const { equipmentId } = await params;
    const data = await db.getSensorReadings(equipmentId);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
