import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // OCR Ingestion endpoint mock
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Mock OCR result
    return NextResponse.json({
      success: true,
      filename: file.name,
      extractedData: {
        equipmentId: "EQ-103",
        technician: "Bernard",
        date: "2026-07-11",
        notes: "Bearing replaced, high vibration observed before repair.",
        status: "Repaired",
      },
      ocrEngine: "Tesseract Mock",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
