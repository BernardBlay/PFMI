import type { Alert } from "@/lib/db";

type Severity = Alert["severity"];

const CONFIG: Record<
  Severity,
  { bg: string; text: string; dot: string }
> = {
  Critical: {
    bg: "bg-error-container",
    text: "text-on-error-container",
    dot: "bg-error",
  },
  High: {
    bg: "bg-error-container/70",
    text: "text-on-error-container",
    dot: "bg-error",
  },
  Medium: {
    bg: "bg-tertiary-fixed",
    text: "text-on-tertiary-fixed-variant",
    dot: "bg-tertiary",
  },
  Low: {
    bg: "bg-surface-container-highest",
    text: "text-on-surface-variant",
    dot: "bg-outline",
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-tighter uppercase ${c.bg} ${c.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {severity}
    </span>
  );
}
