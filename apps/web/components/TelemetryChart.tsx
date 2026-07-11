"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { SensorReading } from "@/lib/db";
import { Thermometer, Activity, Gauge } from "lucide-react";

interface Props {
  data: SensorReading[];
  equipmentName: string;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatValue(v: number | null) {
  return v !== null ? parseFloat(v.toFixed(2)) : null;
}

const CHART_STYLE = {
  background: "transparent",
  fontFamily: 'ui-monospace, monospace',
  fontSize: 10,
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border-mute rounded-xl px-3 py-2 text-[11px] shadow-xl font-mono">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span> {p.unit}
        </p>
      ))}
    </div>
  );
};

export default function TelemetryChart({ data, equipmentName }: Props) {
  const chartData = data.map((r) => ({
    time: formatTime(r.timestamp),
    temperature: formatValue(r.temperature),
    vibration: formatValue(r.vibration),
    pressure: formatValue(r.pressure),
    voltage: formatValue(r.voltage),
  }));

  // Downsample to max 32 points for readable chart
  const step = Math.max(1, Math.floor(chartData.length / 32));
  const sampled = chartData.filter((_, i) => i % step === 0);

  const axisStyle = { fill: "#71717a", fontSize: 10, fontFamily: "monospace" };

  return (
    <div className="space-y-6">
      {/* Temperature */}
      <div className="bg-surface border border-border-mute rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Thermometer className="h-4.5 w-4.5 text-red-500 shrink-0" />
          <h3 className="text-xs font-bold text-foreground font-sans tracking-tight">
            Temperature Diagnostics
          </h3>
          <span className="text-[10px] font-mono text-text-muted ml-auto uppercase tracking-wider">
            °C · 24h rolling window
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={sampled} style={CHART_STYLE} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-mute)" strokeOpacity={0.5} />
            <XAxis dataKey="time" tick={axisStyle} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="temperature"
              name="Temperature"
              unit="°C"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#ef4444" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Vibration */}
      <div className="bg-surface border border-border-mute rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
          <h3 className="text-xs font-bold text-foreground font-sans tracking-tight">
            Vibration Amplitude
          </h3>
          <span className="text-[10px] font-mono text-text-muted ml-auto uppercase tracking-wider">
            mm/s RMS
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={sampled} style={CHART_STYLE} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-mute)" strokeOpacity={0.5} />
            <XAxis dataKey="time" tick={axisStyle} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="vibration"
              name="Vibration"
              unit=" mm/s"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#6366f1" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pressure & Voltage combined */}
      <div className="bg-surface border border-border-mute rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="h-4.5 w-4.5 text-amber-500 shrink-0" />
          <h3 className="text-xs font-bold text-foreground font-sans tracking-tight">
            Pressure &amp; Electrical Voltage
          </h3>
          <span className="text-[10px] font-mono text-text-muted ml-auto uppercase tracking-wider">
            Combined Parametric Logs
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={sampled} style={CHART_STYLE} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-mute)" strokeOpacity={0.5} />
            <XAxis dataKey="time" tick={axisStyle} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "monospace", paddingTop: 10 }} />
            <Line
              type="monotone"
              dataKey="pressure"
              name="Pressure"
              unit=" bar"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="voltage"
              name="Voltage"
              unit=" V"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
