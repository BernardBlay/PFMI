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
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  fontSize: 11,
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
    <div className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-label-sm font-label shadow-xl">
      <p className="text-on-surface-variant mb-1">{label}</p>
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

  const axisStyle = { fill: "#909097", fontSize: 11, fontFamily: "JetBrains Mono" };

  return (
    <div className="space-y-6">
      {/* Temperature */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-on-error-container text-xl">thermostat</span>
          <h3 className="text-headline-md font-headline font-semibold text-on-surface">
            Temperature
          </h3>
          <span className="text-label-sm font-label text-on-surface-variant ml-auto">
            24h rolling window
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={sampled} style={CHART_STYLE} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#45464d" />
            <XAxis dataKey="time" tick={axisStyle} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="temperature"
              name="Temp"
              unit="°C"
              stroke="#ffb4ab"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#ffb4ab" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Vibration */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-secondary text-xl">graphic_eq</span>
          <h3 className="text-headline-md font-headline font-semibold text-on-surface">
            Vibration
          </h3>
          <span className="text-label-sm font-label text-on-surface-variant ml-auto">
            mm/s RMS
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={sampled} style={CHART_STYLE} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#45464d" />
            <XAxis dataKey="time" tick={axisStyle} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="vibration"
              name="Vibration"
              unit=" mm/s"
              stroke="#adc6ff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#adc6ff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pressure + Voltage combined */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-tertiary text-xl">speed</span>
          <h3 className="text-headline-md font-headline font-semibold text-on-surface">
            Pressure &amp; Voltage
          </h3>
          <span className="text-label-sm font-label text-on-surface-variant ml-auto">
            Combined
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={sampled} style={CHART_STYLE} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#45464d" />
            <XAxis dataKey="time" tick={axisStyle} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "#909097", fontSize: 11, fontFamily: "JetBrains Mono" }} />
            <Line
              type="monotone"
              dataKey="pressure"
              name="Pressure"
              unit=" bar"
              stroke="#ffb95f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="voltage"
              name="Voltage"
              unit=" V"
              stroke="#bec6e0"
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
