"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Package, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";

interface InventoryRecord {
  id: string;
  name: string;
  category: string;
  stock: number;
  threshold: number;
  location: string;
  reorder: "nominal" | "low-stock" | "reordered";
}

const COLUMNS: Column<InventoryRecord>[] = [
  {
    key: "id",
    header: "Part ID",
    render: (r) => <span className="font-mono text-xs font-bold text-foreground">{r.id}</span>,
  },
  {
    key: "name",
    header: "Item Name",
    render: (r) => <span className="font-bold text-xs">{r.name}</span>,
  },
  {
    key: "category",
    header: "Category",
    render: (r) => <span className="text-text-muted">{r.category}</span>,
  },
  {
    key: "stock",
    header: "In Stock",
    render: (r) => <span className="font-mono text-xs">{r.stock} units</span>,
  },
  {
    key: "location",
    header: "Warehouse Bin",
    render: (r) => <span className="font-mono text-xs text-text-muted">{r.location}</span>,
  },
  {
    key: "reorder",
    header: "Reorder Status",
    render: (r) => {
      const colors = {
        nominal: "text-emerald-500 bg-emerald-500/5 border-emerald-500/10",
        "low-stock": "text-red-500 bg-red-500/5 border-red-500/10",
        reordered: "text-amber-500 bg-amber-500/5 border-amber-500/10",
      };
      const text = {
        nominal: "nominal",
        "low-stock": "CRITICAL LOW",
        reordered: "reordered",
      };
      return (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${colors[r.reorder]}`}>
          {text[r.reorder]}
        </span>
      );
    },
  },
];

const MOCK_INVENTORY: InventoryRecord[] = [
  { id: "PRT-901", name: "High-Temp Bearing Pack B", category: "Bearings", stock: 12, threshold: 5, location: "Aisle 3 - Shelf B", reorder: "nominal" },
  { id: "PRT-902", name: "Hydraulic Seals 120-bar", category: "Seals", stock: 2, threshold: 10, location: "Aisle 1 - Shelf A", reorder: "low-stock" },
  { id: "PRT-903", name: "Oil Filter Cartridges (3μm)", category: "Filters", stock: 45, threshold: 15, location: "Aisle 2 - Shelf D", reorder: "nominal" },
  { id: "PRT-904", name: "Replacement Fan Blade Assembly", category: "Fans", stock: 1, threshold: 2, location: "Aisle 4 - Heavy Storage", reorder: "reordered" },
  { id: "PRT-905", name: "Hydraulic Fluid Shell Tellus (20L)", category: "Lubricants", stock: 8, threshold: 4, location: "Aisle 1 - Fluid Rack", reorder: "nominal" },
];

export default function InventoryPage() {
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
          SECURITY PROTOCOL ACTIVE. YOUR ACCOUNT ROLE IS INSUFFICIENT TO ACCESS WAREHOUSE SPARE PARTS INVENTORY DATABASES. THIS ATTEMPT HAS BEEN LOGGED.
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
        <span className="text-text-muted text-xs font-mono font-bold">Inventory</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-mute pb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground font-sans tracking-tight">
            Spare Parts &amp; Inventory
          </h1>
          <p className="text-xs text-text-muted mt-1 leading-none font-mono uppercase tracking-wider">
            Critical maintenance components registry
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
            Warehouse Diagnostics
          </h2>
          <p className="text-[10px] text-text-muted font-mono uppercase mt-1">
            {MOCK_INVENTORY.filter(i => i.reorder === "low-stock").length} parts low in stock
          </p>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={MOCK_INVENTORY}
          emptyMessage="No inventory records found."
        />
      </div>
    </div>
  );
}
