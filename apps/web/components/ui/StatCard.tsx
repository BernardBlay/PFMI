import { ReactNode } from "react";

interface StatusPill {
  label: string;
  bg: string;
  text: string;
}

interface Props {
  icon: string; // Material Symbol name
  iconBg?: string;
  iconColor?: string;
  label: string;
  value: string | number;
  statusPill?: StatusPill;
  subLabel?: string;
  /** 0–100 progress bar value; omit to hide */
  progress?: number;
  progressColor?: string;
  trend?: ReactNode;
  className?: string;
}

export default function StatCard({
  icon,
  iconBg = "bg-secondary/10",
  iconColor = "text-secondary",
  label,
  value,
  statusPill,
  subLabel,
  progress,
  progressColor = "bg-secondary",
  trend,
  className = "",
}: Props) {
  return (
    <div
      className={`bg-surface-container-lowest border border-outline-variant p-5 rounded-xl shadow-sm transition-all duration-200 hover:border-secondary/40 ${className}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 ${iconBg} ${iconColor} rounded-lg`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        {statusPill && (
          <span
            className={`${statusPill.bg} ${statusPill.text} px-2 py-0.5 rounded text-[10px] font-bold tracking-tighter uppercase`}
          >
            {statusPill.label}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="text-headline-md font-headline text-on-surface font-semibold leading-none">
        {value}
      </div>

      {/* Sub-label */}
      {subLabel && (
        <p className="text-on-surface-variant text-xs mt-1 font-label">{subLabel}</p>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="mt-4 h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
          <div
            className={`${progressColor} h-full rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {/* Trend */}
      {trend && (
        <div className="mt-3 text-xs text-on-surface-variant font-label flex items-center gap-1">
          {trend}
        </div>
      )}
    </div>
  );
}
