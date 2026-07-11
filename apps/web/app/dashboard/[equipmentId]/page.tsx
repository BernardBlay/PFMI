import { notFound } from "next/navigation";
import Link from "next/link";
import { db, Equipment, MaintenanceLog, SensorReading } from "@/lib/db";
import TelemetryChart from "@/components/TelemetryChart";
import DataTable from "@/components/ui/DataTable";
import SeverityBadge from "@/components/ui/SeverityBadge";
import type { Column } from "@/components/ui/DataTable";
import { ArrowLeft, Thermometer, Activity, Gauge, Bolt, AlertTriangle, Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const { equipmentId } = await params;
  const eq = await db.getEquipmentById(equipmentId);
  return {
    title: eq ? `${eq.name} — Telemetry | PFMI` : "Telemetry | PFMI",
  };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    Healthy: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    Warning: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    Critical: "bg-red-500/10 text-red-500 border border-red-500/20",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${
        map[status] ?? "bg-background border border-border-mute text-text-muted"
      }`}
    >
      {status}
    </span>
  );
}

function getLastSensorValues(readings: SensorReading[]) {
  if (!readings.length) return null;
  const last = readings[readings.length - 1];
  return {
    temperature: last.temperature?.toFixed(1) ?? "—",
    vibration: last.vibration?.toFixed(2) ?? "—",
    pressure: last.pressure?.toFixed(2) ?? "—",
    voltage: last.voltage?.toFixed(1) ?? "—",
  };
}

const LOG_COLUMNS: Column<MaintenanceLog>[] = [
  {
    key: "service_date",
    header: "Date",
    render: (r) => (
      <span className="font-mono text-xs">{r.service_date}</span>
    ),
  },
  {
    key: "technician",
    header: "Technician",
    render: (r) => <span className="font-bold text-xs">{r.technician}</span>,
  },
  {
    key: "status_after_service",
    header: "Status After",
    render: (r) => <StatusChip status={r.status_after_service} />,
  },
  {
    key: "notes",
    header: "Notes",
    className: "max-w-xs truncate text-xs",
    render: (r) => (
      <span title={r.notes} className="text-text-muted">
        {r.notes}
      </span>
    ),
  },
];

export default async function TelemetryPage({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const { equipmentId } = await params;

  const [eq, sensorReadings, logs, alerts] = await Promise.all([
    db.getEquipmentById(equipmentId),
    db.getSensorReadings(equipmentId),
    db.getMaintenanceLogs(equipmentId),
    db.getAlerts(),
  ]);

  if (!eq) notFound();

  const equipAlerts = alerts.filter((a) => a.equipment_id === equipmentId);
  const live = getLastSensorValues(sensorReadings);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-text-muted hover:text-foreground transition-colors text-xs font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Fleet Overview
        </Link>
        <span className="text-border-mute text-xs">/</span>
        <span className="text-text-muted text-xs font-mono font-bold">{eq.name}</span>
      </div>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-mute pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
              {eq.name}
            </h1>
            <StatusChip status={eq.status} />
          </div>
          <p className="text-xs font-mono text-text-muted">
            Unit ID: {eq.id} ·{" "}
            {sensorReadings.length > 0
              ? `${sensorReadings.length} sensor parameters logged`
              : "No telemetry logged"}{" "}
            · {equipAlerts.length} active alarm{equipAlerts.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Health score */}
        <div className="bg-surface border border-border-mute rounded-2xl px-5 py-3 text-center shrink-0 shadow-sm">
          <p className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider mb-1">
            Health Score
          </p>
          <p
            className={`text-xl font-bold font-mono ${
              eq.health_score >= 80
                ? "text-emerald-500"
                : eq.health_score >= 60
                ? "text-amber-500"
                : "text-red-500"
            }`}
          >
            {eq.health_score}%
          </p>
        </div>
      </div>

      {/* Live sensor readings row */}
      {live && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Thermometer, label: "Temperature", value: `${live.temperature} °C`, color: "text-red-500 border-red-500/20 bg-red-500/5" },
            { icon: Activity, label: "Vibration", value: `${live.vibration} mm/s`, color: "text-indigo-500 border-indigo-500/20 bg-indigo-500/5" },
            { icon: Gauge, label: "Pressure", value: `${live.pressure} bar`, color: "text-amber-500 border-amber-500/20 bg-amber-500/5" },
            { icon: Bolt, label: "Voltage", value: `${live.voltage} V`, color: "text-purple-500 border-purple-500/20 bg-purple-500/5" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="bg-surface border border-border-mute rounded-2xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.01)]"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`p-1.5 rounded-lg border ${s.color}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                    {s.label}
                  </span>
                </div>
                <p className="text-base font-bold text-foreground font-mono">{s.value}</p>
                <p className="text-[9px] text-text-muted font-mono mt-1">Live Sensor Stream</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Telemetry charts */}
      <div>
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted mb-4">
          Real-Time Sensor Telemetry Window
        </h2>
        <TelemetryChart data={sensorReadings} equipmentName={eq.name} />
      </div>

      {/* Active alerts for this unit */}
      {equipAlerts.length > 0 && (
        <div className="bg-surface border border-red-500/25 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border-mute flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
              Active Unit Alerts
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {equipAlerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 bg-background border border-border-mute rounded-xl"
              >
                <div>
                  <p className="text-xs text-foreground font-sans leading-relaxed">{a.message}</p>
                  <p className="text-[9px] font-mono text-text-muted mt-0.5">{a.id}</p>
                </div>
                <SeverityBadge severity={a.severity} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance logs table */}
      <div className="bg-surface border border-border-mute rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border-mute">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
            Maintenance &amp; Service History
          </h2>
          <p className="text-[10px] text-text-muted font-mono uppercase mt-1">
            {logs.length} service report{logs.length !== 1 ? "s" : ""} on archive
          </p>
        </div>
        <DataTable
          columns={LOG_COLUMNS}
          rows={logs}
          emptyMessage="No maintenance records for this unit yet."
        />
      </div>
    </div>
  );
}
