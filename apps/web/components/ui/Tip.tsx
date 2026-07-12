"use client";

/** Lightweight hover tooltip. Wraps its trigger inline; shows a floating
 *  label (+ optional mono sub-line) above or below on hover/focus. */
export default function Tip({
  label,
  sub,
  side = "top",
  children,
}: {
  label: string;
  sub?: string;
  side?: "top" | "bottom";
  children: React.ReactNode;
}) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-mute bg-surface px-2.5 py-1.5 text-left shadow-lg opacity-0 transition-all duration-150 group-hover/tip:opacity-100 ${
          side === "top"
            ? "bottom-full mb-1.5 translate-y-1 group-hover/tip:translate-y-0"
            : "top-full mt-1.5 -translate-y-1 group-hover/tip:translate-y-0"
        }`}
      >
        <span className="block text-[9px] font-bold leading-tight text-foreground">{label}</span>
        {sub && (
          <span className="mt-0.5 block text-[8px] font-mono uppercase tracking-wider leading-tight text-text-muted">
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}
