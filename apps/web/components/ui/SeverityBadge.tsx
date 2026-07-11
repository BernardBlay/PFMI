import type { Alert } from "@/lib/db";

type Severity = Alert["severity"];

const CONFIG: Record<
  Severity,
  { bgClass: string; dotClass: string }
> = {
  Critical: {
    bgClass: "bg-red-500/10 text-red-500 border border-red-500/20",
    dotClass: "bg-red-500",
  },
  High: {
    bgClass: "bg-red-500/10 text-red-500 border border-red-500/20",
    dotClass: "bg-red-500",
  },
  Medium: {
    bgClass: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    dotClass: "bg-amber-500",
  },
  Low: {
    bgClass: "bg-background border border-border-mute text-text-muted",
    dotClass: "bg-text-muted",
  },
};

interface Props {
  severity: Severity;
  className?: string;
}

export default function SeverityBadge({ severity, className = "" }: Props) {
  const c = CONFIG[severity] ?? CONFIG.Low;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${c.bgClass} ${className}`}
    >
      <span className={`w-1 h-1 rounded-full ${c.dotClass}`} />
      {severity}
    </span>
  );
}
