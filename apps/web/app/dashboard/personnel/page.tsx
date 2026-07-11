"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Wrench, Shield, CheckCircle, Clock } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";

interface PersonnelRecord {
  id: string;
  name: string;
  role: string;
  clearance: string;
  assignedNode: string;
  status: "active" | "standby" | "off-duty";
}

const COLUMNS: Column<PersonnelRecord>[] = [
  {
    key: "name",
    header: "Staff Member",
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-[9px]">
          {r.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="font-bold text-foreground text-xs">{r.name}</span>
      </div>
    ),
  },
  {
    key: "role",
    header: "Specialization",
    render: (r) => <span className="text-text-muted">{r.role}</span>,
  },
  {
    key: "clearance",
    header: "Clearance Level",
    render: (r) => (
      <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border bg-zinc-500/10 text-zinc-400 border-zinc-500/20 uppercase">
        {r.clearance}
      </span>
    ),
  },
  {
    key: "assignedNode",
    header: "Active Node",
    render: (r) => <span className="font-mono text-xs">{r.assignedNode}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (r) => {
      const colors = {
        active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        standby: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        "off-duty": "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      };
      return (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${colors[r.status]}`}>
          {r.status}
        </span>
      );
    },
  },
];

const MOCK_PERSONNEL: PersonnelRecord[] = [
  { id: "STF-01", name: "Kofi Mensah", role: "Hydraulics Lead", clearance: "Level 3", assignedNode: "Node 04 - Pump Station A", status: "active" },
  { id: "STF-02", name: "Amara Diallo", role: "Vibration Analyst", clearance: "Level 4", assignedNode: "Node 04 - Control Room", status: "active" },
  { id: "STF-03", name: "Kwame Boateng", role: "Maintenance Tech", clearance: "Level 2", assignedNode: "Node 02 - Conveyor Drive", status: "standby" },
  { id: "STF-04", name: "Fatima Laroui", role: "Reliability Engineer", clearance: "Level 4", assignedNode: "Node 04 - Diagnostics", status: "active" },
  { id: "STF-05", name: "Yao Appiah", role: "Electrical Specialist", clearance: "Level 3", assignedNode: "Standby Pool", status: "standby" },
  { id: "STF-06", name: "Zara Chen", role: "Systems Engineer", clearance: "Level 5 (Super)", assignedNode: "Tarkwa HQ", status: "off-duty" },
];

export default function PersonnelPage() {
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
          SECURITY PROTOCOL ACTIVE. YOUR ACCOUNT ROLE IS INSUFFICIENT TO VIEW PERSONNEL CLEARANCE REGISTRIES. THIS ATTEMPT HAS BEEN LOGGED.
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
        <span className="text-text-muted text-xs font-mono font-bold">Personnel</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-mute pb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground font-sans tracking-tight">
            Security Roster &amp; Personnel
          </h1>
          <p className="text-xs text-text-muted mt-1 leading-none font-mono uppercase tracking-wider">
            Node 04 Personnel clearance logs
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
            Clearance Registry
          </h2>
          <p className="text-[10px] text-text-muted font-mono uppercase mt-1">
            {MOCK_PERSONNEL.length} active technicians on duty
          </p>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={MOCK_PERSONNEL}
          emptyMessage="No personnel records found."
        />
      </div>
    </div>
  );
}
