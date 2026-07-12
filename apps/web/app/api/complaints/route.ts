import { NextResponse } from "next/server";
import { supabaseRestRequest } from "@/lib/supabase-rest";

// GET — fetch issue reports (maintenance_logs where notes starts with [ISSUE_REPORT])
export async function GET() {
  try {
    const response = await supabaseRestRequest("maintenance_logs", {
      query: {
        select: "*,equipment(id,name)",
        notes: "ilike.[ISSUE_REPORT]%",
        order: "created_at.desc",
      },
    });
    if (!response.ok) {
      // Fallback: fetch all and filter client-side if PostgREST filter fails
      const fallback = await supabaseRestRequest("maintenance_logs", {
        query: { select: "*,equipment(id,name)", order: "created_at.desc", limit: 200 },
      });
      const all = await fallback.json();
      const filtered = (Array.isArray(all) ? all : []).filter((r: any) =>
        typeof r.notes === "string" && r.notes.startsWith("[ISSUE_REPORT]")
      );
      return NextResponse.json(filtered);
    }
    const data = await response.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json([]);
  }
}

// POST — submit a new issue report
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { equipment_id, reported_by, severity, category, description } = body;

    if (!equipment_id || !description?.trim() || !reported_by?.trim()) {
      return NextResponse.json(
        { error: "equipment_id, reported_by and description are required" },
        { status: 400 }
      );
    }

    const structuredNote = `[ISSUE_REPORT] ${JSON.stringify({
      _type: "ISSUE_REPORT",
      severity: severity || "medium",
      category: category || "General",
      description: description.trim(),
      reported_by: reported_by.trim(),
      report_status: "open",
    })}`;

    const log = {
      equipment_id,
      technician: reported_by.trim(),
      service_date: new Date().toISOString().split("T")[0],
      notes: structuredNote,
      status_after_service:
        severity === "critical" || severity === "high" ? "Warning" : "Healthy",
    };

    const insertResponse = await supabaseRestRequest("maintenance_logs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([log]),
    });

    if (!insertResponse.ok) {
      const errText = await insertResponse.text();
      console.error("[complaints POST] Supabase error:", errText);
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    const inserted = await insertResponse.json();
    return NextResponse.json(
      { success: true, record: Array.isArray(inserted) ? inserted[0] : inserted },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[complaints POST] Exception:", error?.message);
    return NextResponse.json({ error: error.message || "Failed to submit report" }, { status: 500 });
  }
}

// PATCH — update report_status (admin action)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, report_status } = body;

    if (!id || !report_status) {
      return NextResponse.json(
        { error: "id and report_status are required" },
        { status: 400 }
      );
    }

    // Fetch existing record
    const fetchRes = await supabaseRestRequest("maintenance_logs", {
      query: { select: "id,notes", id: `eq.${id}`, limit: 1 },
    });
    const existing = await fetchRes.json();
    const record = Array.isArray(existing) ? existing[0] : null;

    if (!record) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const raw: string = record.notes || "";
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) {
      return NextResponse.json({ error: "Not a structured report" }, { status: 400 });
    }

    const parsed = JSON.parse(raw.slice(jsonStart));
    parsed.report_status = report_status;
    const updatedNote = `[ISSUE_REPORT] ${JSON.stringify(parsed)}`;

    await supabaseRestRequest(`maintenance_logs?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ notes: updatedNote }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update report" },
      { status: 500 }
    );
  }
}
