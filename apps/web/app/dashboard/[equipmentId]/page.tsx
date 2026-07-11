import { notFound } from "next/navigation";
import Link from "next/link";
import { db, Equipment, MaintenanceLog, SensorReading } from "@/lib/db";
import TelemetryChart from "@/components/TelemetryChart";
import DataTable from "@/components/ui/DataTable";
import SeverityBadge from "@/components/ui/SeverityBadge";
import type { Column } from "@/components/ui/DataTable";

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
    Healthy: "bg-secondary/10 text-secondary",
    Warning: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
    Critical: "bg-error-container text-on-error-container",
  };
  return (
    <span
      className={`px-3 py-1 rounded-lg text-label-sm font-label font-bold tracking-wider uppercase ${
        map[status] ?? "bg-surface-container-highest text-on-surface-variant"
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
      <span className="font-label text-label-md">{r.service_date}</span>
    ),
  },
  {
    key: "technician",
    header: "Technician",
    render: (r) => <span className="font-bold">{r.technician}</span>,
  },
  {
    key: "status_after_service",
    header: "Status After",
    render: (r) => <StatusChip status={r.status_after_service} />,
  },
  {
    key: "notes",
    header: "Notes",
    className: "max-w-xs truncate",
    render: (r) => (
      <span title={r.notes} className="text-on-surface-variant">
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
    <div className="space-y-6">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors text-label-md font-label"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Fleet Overview
        </Link>
        <span className="text-on-surface-variant">/</span>
        <span className="text-on-surface font-label text-label-md">{eq.name}</span>
      </div>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-headline-lg font-headline font-bold text-on-surface">
              {eq.name}
            </h1>
            <StatusChip status={eq.status} />
          </div>
          <p className="text-body-sm font-label text-on-surface-variant">
            Unit ID: {eq.id} ·{" "}
            {sensorReadings.length > 0
              ? `${sensorReadings.length} sensor readings`
              : "No sensor readings"}{" "}
            · {equipAlerts.length} active alert{equipAlerts.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Health score */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl px-5 py-3 text-center shrink-0">
          <p className="text-label-sm font-label text-on-surface-variant uppercase tracking-wider mb-1">
            Health Score
          </p>
          <p
            className={`text-headline-md font-label font-bold ${
              eq.health_score >= 80
                ? "text-secondary"
                : eq.health_score >= 60
                ? "text-tertiary"
                : "text-error"
            }`}
          >
            {eq.health_score}%
          </p>
        </div>
      </div>

      {/* Live sensor readings row */}
      {live && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: "thermostat", label: "Temperature", value: `${live.temperature} °C`, color: "text-error" },
            { icon: "graphic_eq", label: "Vibration", value: `${live.vibration} mm/s`, color: "text-secondary" },
            { icon: "speed", label: "Pressure", value: `${live.pressure} bar`, color: "text-tertiary" },
            { icon: "bolt", label: "Voltage", value: `${live.voltage} V`, color: "text-md-primary" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`material-symbols-outlined text-base ${s.color}`}>{s.icon}</span>
                <span className="text-label-sm font-label text-on-surface-variant uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
              <p className={`text-headline-md font-label font-bold ${s.color}`}>{s.value}</p>
              <p className="text-label-sm text-on-surface-variant font-label mt-0.5">Latest reading</p>
            </div>
          ))}
        </div>
      )}

      {/* Telemetry charts */}
      <div>
        <h2 className="text-headline-md font-headline font-semibold text-on-surface mb-4">
          Sensor Telemetry — 24h Window
        </h2>
        <TelemetryChart data={sensorReadings} equipmentName={eq.name} />
      </div>

      {/* Active alerts for this unit */}
      {equipAlerts.length > 0 && (
        <div className="bg-surface-container-lowest border border-error-container/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-on-error-container">error</span>
            <h2 className="text-headline-md font-headline font-semibold text-on-surface">
              Active Alerts
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {equipAlerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 bg-surface-container-low border border-outline-variant rounded-lg"
              >
                <div>
                  <p className="text-body-sm font-body text-on-surface">{a.message}</p>
                  <p className="text-label-sm font-label text-on-surface-variant mt-0.5">{a.id}</p>
                </div>
                <SeverityBadge severity={a.severity} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance logs table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant">
          <h2 className="text-headline-md font-headline font-semibold text-on-surface">
            Maintenance Activity
          </h2>
          <p className="text-body-sm font-body text-on-surface-variant mt-0.5">
            {logs.length} service record{logs.length !== 1 ? "s" : ""} for this unit
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
