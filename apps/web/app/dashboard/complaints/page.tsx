"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, AlertTriangle, Shield, CheckCircle } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";

interface ComplaintRecord {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  reportedBy: string;
  description: string;
  timestamp: string;
  status: "open" | "investigating" | "resolved";
}

const COLUMNS: Column<ComplaintRecord>[] = [
  {
    key: "id",
    header: "Ticket ID",
    render: (r) => <span className="font-mono text-xs font-bold text-foreground">{r.id}</span>,
  },
  {
    key: "severity",
    header: "Severity",
    render: (r) => {
      const colors = {
        critical: "bg-red-500/10 text-red-500 border-red-500/20",
        high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      };
      return (
        <span className={`px-2 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wide border ${colors[r.severity]}`}>
          {r.severity}
        </span>
      );
    },
  },
  {
    key: "reportedBy",
    header: "Operator",
    render: (r) => <span className="font-bold text-xs">{r.reportedBy}</span>,
  },
  {
    key: "description",
    header: "Description",
    className: "max-w-xs truncate text-xs text-text-muted",
    render: (r) => <span title={r.description}>{r.description}</span>,
  },
  {
    key: "timestamp",
    header: "Logged At",
    render: (r) => <span className="font-mono text-xs text-text-muted">{r.timestamp}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (r) => {
      const colors = {
        open: "text-red-500 bg-red-500/5 border-red-500/10",
        investigating: "text-amber-500 bg-amber-500/5 border-amber-500/10",
        resolved: "text-emerald-500 bg-emerald-500/5 border-emerald-500/10",
      };
      return (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${colors[r.status]}`}>
          {r.status}
        </span>
      );
    },
  },
];

const MOCK_COMPLAINTS: ComplaintRecord[] = [
  { id: "TKT-309", severity: "critical", reportedBy: "operator04", description: "Hydraulic Pump A overheating; vibration spike detected on Node 04", timestamp: "2026-07-11 15:42:01", status: "investigating" },
  { id: "TKT-298", severity: "high", reportedBy: "chen", description: "Rotary Motor C lubrication levels dropping rapidly below safety margin", timestamp: "2026-07-11 11:20:15", status: "open" },
  { id: "TKT-285", severity: "medium", reportedBy: "miller", description: "Cooling Fan B making rattling noises on start; needs bearing inspection", timestamp: "2026-07-10 09:12:44", status: "resolved" },
  { id: "TKT-274", severity: "low", reportedBy: "operator04", description: "Slight temperature variance on sensor block 12; recalibrated", timestamp: "2026-07-09 18:31:00", status: "resolved" },
];

export default function ComplaintsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const mockUserStr = localStorage.getItem("pfmi-mock-user");
    if (mockUserStr) {
      try {
        const user = JSON.parse(mockUserStr);
        setIsAdmin(user?.user_metadata?.role === "Admin");
      } catch (e) {
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
  }, []);

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-xs font-mono text-text-muted">
        Verifying cryptographic credentials...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mb-6 animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-bold text-foreground font-mono uppercase tracking-widest mb-2">
          Access Denied
        </h1>
        <p className="text-xs text-text-muted leading-relaxed mb-6 font-mono text-center">
          SECURITY PROTOCOL ACTIVE. YOUR ACCOUNT ROLE IS INSUFFICIENT TO VIEW GENERAL MAINTENANCE COMPLAINT LOGS. THIS ATTEMPT HAS BEEN LOGGED.
        </p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-surface hover:bg-background border border-border-mute hover:border-zinc-400 text-foreground font-mono text-[10px] uppercase tracking-wider rounded-lg transition-all"
        >
          Return to Control Room
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-text-muted hover:text-foreground transition-colors text-xs font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Fleet Overview
        </Link>
        <span className="text-border-mute text-xs">/</span>
        <span className="text-text-muted text-xs font-mono font-bold">Complaints</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-mute pb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground font-sans tracking-tight">
            Maintenance Complaints &amp; Logs
          </h1>
          <p className="text-xs text-text-muted mt-1 leading-none font-mono uppercase tracking-wider">
            Industrial active ticket queue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          <span className="text-[10px] font-bold font-mono text-emerald-650 dark:text-emerald-400 uppercase tracking-widest">
            SECURE ACCESS AUTHORIZED
          </span>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-surface border border-border-mute rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border-mute">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
            Ticket Priority Queue
          </h2>
          <p className="text-[10px] text-text-muted font-mono uppercase mt-1">
            {MOCK_COMPLAINTS.filter(c => c.status !== "resolved").length} active complaints, {MOCK_COMPLAINTS.filter(c => c.status === "resolved").length} resolved
          </p>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={MOCK_COMPLAINTS}
          emptyMessage="No complaints recorded."
        />
      </div>
    </div>
  );
}
