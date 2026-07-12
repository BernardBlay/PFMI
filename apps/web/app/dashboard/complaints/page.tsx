"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, X, AlertTriangle, CheckCircle2,
  Clock, Search, Filter, RefreshCw, ChevronDown, FileWarning,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Equipment { id: string; name: string; }

interface IssueReport {
  id: number;
  equipment_id: string;
  equipmentName: string;
  technician: string;
  service_date: string;
  created_at: string;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  description: string;
  reported_by: string;
  report_status: "open" | "investigating" | "resolved";
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Mechanical Failure", "Electrical Issue", "Overheating",
  "Unusual Noise / Vibration", "Fluid Leak", "Sensor Malfunction",
  "Structural Damage", "Safety Hazard", "Performance Degradation", "Other",
];

const SEVERITY_CONFIG = {
  critical: { label: "Critical", color: "text-red-500 bg-red-500/10 border-red-500/20", dot: "bg-red-500" },
  high:     { label: "High",     color: "text-orange-500 bg-orange-500/10 border-orange-500/20", dot: "bg-orange-500" },
  medium:   { label: "Medium",   color: "text-amber-500 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500" },
  low:      { label: "Low",      color: "text-blue-500 bg-blue-500/10 border-blue-500/20", dot: "bg-blue-500" },
};

const STATUS_CONFIG = {
  open:          { label: "Open",          color: "text-red-500 bg-red-500/5 border-red-500/15",         icon: AlertTriangle },
  investigating: { label: "Investigating", color: "text-amber-500 bg-amber-500/5 border-amber-500/15",   icon: Clock },
  resolved:      { label: "Resolved",      color: "text-emerald-500 bg-emerald-500/5 border-emerald-500/15", icon: CheckCircle2 },
};

const EMPTY_FORM = {
  equipment_id: "",
  severity: "medium" as IssueReport["severity"],
  category: "",
  description: "",
  reported_by: "",
};


// ─── Parse raw maintenance_log into IssueReport ────────────────────────────

function parseReport(raw: any, equipmentName: string): IssueReport | null {
  try {
    const notes: string = raw.notes || "";
    if (!notes.startsWith("[ISSUE_REPORT]")) return null;
    const jsonStr = notes.slice("[ISSUE_REPORT]".length).trim();
    const parsed = JSON.parse(jsonStr);
    return {
      id: raw.id,
      equipment_id: raw.equipment_id,
      equipmentName,
      technician: raw.technician,
      service_date: raw.service_date,
      created_at: raw.created_at || raw.service_date,
      severity: parsed.severity || "medium",
      category: parsed.category || "General",
      description: parsed.description || "",
      reported_by: parsed.reported_by || raw.technician,
      report_status: parsed.report_status || "open",
    };
  } catch {
    return null;
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: IssueReport["severity"] }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: IssueReport["report_status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold uppercase tracking-wider ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted">
        {label}
      </label>
      {children}
      {error && <p className="text-[9px] font-mono text-red-500">{error}</p>}
    </div>
  );
}

// ─── Report Issue Modal ─────────────────────────────────────────────────────

function ReportModal({
  equipment,
  onClose,
  onSubmitted,
}: {
  equipment: Equipment[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(p => ({ ...p, [key]: e.target.value }));
      setErrors(p => { const n = { ...p }; delete n[key]; return n; });
    };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.equipment_id) e.equipment_id = "Select a machine";
    if (!form.category) e.category = "Select a category";
    if (!form.reported_by.trim()) e.reported_by = "Enter your name";
    if (!form.description.trim()) e.description = "Describe the issue";
    else if (form.description.trim().length < 20) e.description = "Please give more detail (min 20 chars)";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Submit failed");
      setSuccess(true);
      setTimeout(() => { onSubmitted(); onClose(); }, 1800);
    } catch {
      setErrors({ submit: "Failed to submit. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (key: string) =>
    `w-full bg-background border rounded-xl px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-text-muted focus:outline-none transition-colors ${
      errors[key] ? "border-red-500/60" : "border-border-mute focus:border-zinc-400 dark:focus:border-zinc-600"
    }`;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-surface border border-border-mute rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-mute shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <FileWarning className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-foreground">
                  Report Machine Issue
                </h3>
                <p className="text-[9px] text-text-muted font-mono">
                  Submitted reports are reviewed by the maintenance team
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-background transition-colors cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center justify-center gap-4 px-5 py-12">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Report Submitted</p>
                <p className="text-xs text-text-muted mt-1">The maintenance team has been notified.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="overflow-y-auto px-5 py-5 space-y-4">

                {/* Machine + Severity row */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Affected Machine *" error={errors.equipment_id}>
                    <select value={form.equipment_id} onChange={set("equipment_id")} className={inputCls("equipment_id")}>
                      <option value="">Select machine...</option>
                      {equipment.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.name}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Severity Level *">
                    <select value={form.severity} onChange={set("severity")} className={inputCls("severity")}>
                      <option value="low">Low — Minor observation</option>
                      <option value="medium">Medium — Needs attention</option>
                      <option value="high">High — Urgent repair</option>
                      <option value="critical">Critical — Stop machine</option>
                    </select>
                  </FormField>
                </div>

                {/* Category */}
                <FormField label="Issue Category *" error={errors.category}>
                  <select value={form.category} onChange={set("category")} className={inputCls("category")}>
                    <option value="">Select category...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>

                {/* Reporter name */}
                <FormField label="Your Name / Operator ID *" error={errors.reported_by}>
                  <input
                    type="text"
                    value={form.reported_by}
                    onChange={set("reported_by")}
                    placeholder="e.g. John Mensah / OP-04"
                    className={inputCls("reported_by")}
                  />
                </FormField>

                {/* Description */}
                <FormField label="Issue Description *" error={errors.description}>
                  <textarea
                    value={form.description}
                    onChange={set("description")}
                    rows={4}
                    placeholder="Describe what you observed — sounds, smells, readings, when it started, how often it occurs..."
                    className={`${inputCls("description")} resize-none leading-relaxed`}
                  />
                  <p className="text-[9px] text-text-muted font-mono">{form.description.length} / 500 chars</p>
                </FormField>

                {/* Severity hint */}
                {(form.severity === "critical" || form.severity === "high") && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/15 rounded-xl">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-mono text-red-500 leading-relaxed">
                      {form.severity === "critical"
                        ? "CRITICAL: Consider stopping the machine immediately and notifying your supervisor before submitting."
                        : "HIGH PRIORITY: This report will be escalated to the maintenance team immediately."}
                    </p>
                  </div>
                )}

                {errors.submit && (
                  <p className="text-[9px] font-mono text-red-500 text-center">{errors.submit}</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-5 py-4 border-t border-border-mute shrink-0">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-border-mute text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted hover:text-foreground hover:border-zinc-400 transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-foreground/90 active:scale-[0.97] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2">
                  {submitting ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Submitting...</>
                  ) : (
                    <><Plus className="h-3.5 w-3.5" /> Submit Report</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Detail Panel (slide-over) ───────────────────────────────────────────────

function DetailPanel({
  report,
  isAdmin,
  onClose,
  onStatusChange,
}: {
  report: IssueReport;
  isAdmin: boolean;
  onClose: () => void;
  onStatusChange: (id: number, status: IssueReport["report_status"]) => void;
}) {
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (status: IssueReport["report_status"]) => {
    setUpdating(true);
    try {
      await fetch("/api/complaints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: report.id, report_status: status }),
      });
      onStatusChange(report.id, status);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-full z-40 w-96 bg-surface border-l border-border-mute shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-mute">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={report.severity} />
            <StatusBadge status={report.report_status} />
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-background transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Machine */}
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-1">Affected Machine</p>
            <p className="text-sm font-bold text-foreground">{report.equipmentName}</p>
            <p className="text-[10px] font-mono text-text-muted">ID: {report.equipment_id}</p>
          </div>

          {/* Category */}
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-1">Issue Category</p>
            <p className="text-xs font-semibold text-foreground">{report.category}</p>
          </div>

          {/* Reporter */}
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-1">Reported By</p>
            <p className="text-xs font-semibold text-foreground">{report.reported_by}</p>
            <p className="text-[10px] font-mono text-text-muted">{report.service_date}</p>
          </div>

          {/* Description */}
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-2">Issue Description</p>
            <div className="p-4 bg-background border border-border-mute rounded-xl">
              <p className="text-xs text-foreground leading-relaxed">{report.description}</p>
            </div>
          </div>

          {/* Report ID */}
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-1">Report ID</p>
            <p className="text-[10px] font-mono text-text-muted">RPT-{String(report.id).padStart(6, "0")}</p>
          </div>

          {/* Admin status actions */}
          {isAdmin && (
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-3">
                Update Status — Admin
              </p>
              <div className="space-y-2">
                {(["open", "investigating", "resolved"] as const).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const Icon = cfg.icon;
                  const active = report.report_status === s;
                  return (
                    <button
                      key={s}
                      disabled={active || updating}
                      onClick={() => updateStatus(s)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? `${cfg.color} cursor-default`
                          : "border-border-mute text-text-muted hover:border-zinc-400 hover:text-foreground"
                      } disabled:opacity-60`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{cfg.label}</span>
                      {active && <span className="ml-auto text-[9px] font-mono uppercase">Current</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ComplaintsPage() {
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<IssueReport | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState(false);

  // Detect admin from Supabase session
  useEffect(() => {
    import("@/lib/db").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => {
        const role = data.session?.user?.user_metadata?.role;
        setIsAdmin(role === "Admin" || role === "admin");
      });
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [eqRes, rptRes] = await Promise.all([
        fetch("/api/equipment"),
        fetch("/api/complaints"),
      ]);
      const eqData: Equipment[] = await eqRes.json();
      const rptData: any[] = await rptRes.json();

      const eqMap: Record<string, string> = {};
      (Array.isArray(eqData) ? eqData : []).forEach((e: any) => {
        eqMap[e.id] = e.name;
      });
      setEquipment(Array.isArray(eqData) ? eqData : []);

      const parsed = (Array.isArray(rptData) ? rptData : [])
        .map((r: any) => parseReport(r, eqMap[r.equipment_id] || r.equipment?.name || "Unknown Machine"))
        .filter(Boolean) as IssueReport[];
      setReports(parsed);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = (id: number, status: IssueReport["report_status"]) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, report_status: status } : r));
    setSelected(prev => prev && prev.id === id ? { ...prev, report_status: status } : prev);
  };

  const filtered = reports.filter(r => {
    const matchSearch = search === "" ||
      r.equipmentName.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.reported_by.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.report_status === filterStatus;
    const matchSeverity = filterSeverity === "all" || r.severity === filterSeverity;
    return matchSearch && matchStatus && matchSeverity;
  });

  const counts = {
    open: reports.filter(r => r.report_status === "open").length,
    investigating: reports.filter(r => r.report_status === "investigating").length,
    resolved: reports.filter(r => r.report_status === "resolved").length,
    critical: reports.filter(r => r.severity === "critical" && r.report_status !== "resolved").length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard"
          className="flex items-center gap-1.5 text-text-muted hover:text-foreground transition-colors text-xs font-semibold">
          <ArrowLeft className="h-3.5 w-3.5" /> Fleet Overview
        </Link>
        <span className="text-border-mute text-xs">/</span>
        <span className="text-text-muted text-xs font-mono font-bold">Report Issues</span>
      </div>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border-mute pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground font-sans tracking-tight">
            Machine Issue Reports
          </h1>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Workers can report observed machine problems for the maintenance team to investigate
          </p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-foreground/90 active:scale-[0.97] transition-all cursor-pointer shrink-0">
          <Plus className="h-3.5 w-3.5" /> Report an Issue
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open", value: counts.open, color: "text-red-500", bg: "bg-red-500/5 border-red-500/15" },
          { label: "Investigating", value: counts.investigating, color: "text-amber-500", bg: "bg-amber-500/5 border-amber-500/15" },
          { label: "Resolved", value: counts.resolved, color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/15" },
          { label: "Critical Active", value: counts.critical, color: "text-red-600", bg: "bg-red-600/5 border-red-600/15" },
        ].map(s => (
          <div key={s.label} className={`p-4 rounded-2xl border ${s.bg}`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by machine, description, operator..."
            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border-mute rounded-xl text-xs font-mono text-foreground placeholder:text-text-muted focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-surface border border-border-mute rounded-xl text-xs font-mono text-foreground focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer">
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-surface border border-border-mute rounded-xl text-xs font-mono text-foreground focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer">
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted pointer-events-none" />
          </div>
          <button onClick={loadData}
            className="p-2.5 bg-surface border border-border-mute rounded-xl text-text-muted hover:text-foreground hover:border-zinc-400 transition-colors cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Reports list */}
      <div className="bg-surface border border-border-mute rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border-mute flex items-center justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
              Issue Report Queue
            </h2>
            <p className="text-[10px] text-text-muted font-mono uppercase mt-0.5">
              {filtered.length} report{filtered.length !== 1 ? "s" : ""} {search || filterStatus !== "all" || filterSeverity !== "all" ? "(filtered)" : ""}
            </p>
          </div>
          <Filter className="h-4 w-4 text-text-muted" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw className="h-4 w-4 text-text-muted animate-spin" />
            <span className="text-xs font-mono text-text-muted">Loading reports...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-background border border-border-mute flex items-center justify-center">
              <FileWarning className="h-5 w-5 text-text-muted" />
            </div>
            <p className="text-xs font-mono text-text-muted">
              {reports.length === 0 ? "No reports yet — be the first to report an issue." : "No reports match your filters."}
            </p>
            {reports.length === 0 && (
              <button onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-mono text-foreground hover:text-text-muted transition-colors">
                <Plus className="h-3.5 w-3.5" /> Report an Issue
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border-mute">
            {filtered.map(report => (
              <button key={report.id} onClick={() => setSelected(report)}
                className="w-full text-left px-5 py-4 hover:bg-background/60 transition-colors group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={report.severity} />
                      <StatusBadge status={report.report_status} />
                      <span className="text-[9px] font-mono text-text-muted px-2 py-0.5 bg-background border border-border-mute rounded">
                        {report.category}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{report.equipmentName}</p>
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                        {report.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-mono text-text-muted">
                      <span>by {report.reported_by}</span>
                      <span>·</span>
                      <span>{report.service_date}</span>
                      <span>·</span>
                      <span>RPT-{String(report.id).padStart(6, "0")}</span>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-text-muted -rotate-90 shrink-0 mt-1 group-hover:text-foreground transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modalOpen && (
        <ReportModal
          equipment={equipment}
          onClose={() => setModalOpen(false)}
          onSubmitted={loadData}
        />
      )}
      {selected && (
        <DetailPanel
          report={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
