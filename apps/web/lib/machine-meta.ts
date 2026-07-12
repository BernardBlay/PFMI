import {
  ArrowLeftRight, Cog, Construction, Cpu, Disc3, Drill, Fan, Gauge,
  Thermometer, Tractor, Truck, Waves, Zap, type LucideIcon,
} from "lucide-react";

export interface MachineMeta {
  icon: LucideIcon;
  type: string;
}

/** Infer a machine type + icon from the equipment name. */
const RULES: { match: RegExp; icon: LucideIcon; type: string }[] = [
  { match: /truck|haul|\bHT-?\d/i, icon: Truck, type: "Haul Truck" },
  { match: /excavator|digger|shovel|\bEX-?\d/i, icon: Construction, type: "Excavator" },
  { match: /drill|\bDR-?\d/i, icon: Drill, type: "Drill Rig" },
  { match: /bulldozer|dozer|\bBD-?\d/i, icon: Tractor, type: "Bulldozer" },
  { match: /fan|cooling/i, icon: Fan, type: "Cooling Fan" },
  { match: /grind|mill|crusher|\bOG-?\d/i, icon: Disc3, type: "Grinder" },
  { match: /conveyor|belt|\bCV-?\d/i, icon: ArrowLeftRight, type: "Conveyor" },
  { match: /pump|hydraulic|compressor/i, icon: Gauge, type: "Hydraulic Pump" },
  { match: /motor|rotary/i, icon: Cog, type: "Rotary Motor" },
];

export function getMachineMeta(name: string): MachineMeta {
  return RULES.find((r) => r.match.test(name)) ?? { icon: Cpu, type: "Equipment Node" };
}

/** The monitored subsystems ("parts") of every machine, mapped to the
 *  sensor channel that watches them. */
export const MACHINE_PARTS = [
  { key: "motor", label: "Motor", channel: "temperature", icon: Thermometer },
  { key: "bearings", label: "Bearings", channel: "vibration", icon: Waves },
  { key: "hydraulics", label: "Hydraulics", channel: "pressure", icon: Gauge },
  { key: "electrical", label: "Electrical", channel: "voltage", icon: Zap },
] as const;

/** Deterministic per-part condition score derived from the unit's overall
 *  health — stable across renders, unique per unit+part. */
export function partScore(id: string, health: number, partIndex: number): number {
  const seed = `${id}:${partIndex}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = ((h ^ seed.charCodeAt(i)) * 16777619) >>> 0;
  const offset = (h % 25) - 12; // -12 .. +12
  return Math.max(5, Math.min(100, Math.round(health + offset)));
}

export function scoreColor(score: number): string {
  return score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
}
