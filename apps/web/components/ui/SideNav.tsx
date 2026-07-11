"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/db";

import { User } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "precision_manufacturing", label: "Fleet Overview" },
  { href: "/dashboard/telemetry", icon: "insights", label: "Telemetry" },
  { href: "#", icon: "engineering", label: "Personnel", disabled: true },
  { href: "#", icon: "report_problem", label: "Complaints", disabled: true },
  { href: "#", icon: "inventory_2", label: "Inventory", disabled: true },
];

const BOTTOM_ITEMS = [
  { href: "/ocr-upload", icon: "assignment", label: "OCR Upload" },
  { href: "#", icon: "help", label: "Support" },
];

interface Props {
  onReportFault?: () => void;
  user: User | null;
}

export default function SideNav({ onReportFault, user }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("pfmi-mock-user");
    }
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) =>
    href !== "#" && (pathname === href || (href !== "/dashboard" && pathname.startsWith(href)));

  // Dynamic user representation
  const userName = user
    ? user.user_metadata?.full_name || user.email?.split("@")[0] || "Operator"
    : "Operator 04";
  const userInitials = userName.slice(0, 2).toUpperCase();
  const userRole = user
    ? user.email === "tech@pfmi.ai"
      ? "Lead Technician"
      : "Operator Node 04"
    : "System Admin";

  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col p-4 z-40 bg-surface-container-lowest border-r border-outline-variant w-64">
      {/* Brand */}
      <div className="mb-8 px-2">
        <Link href="/" className="block">
          <h1 className="text-headline-md font-headline font-bold text-on-surface">
            Maintenance Hub
          </h1>
          <p className="text-label-sm font-label text-on-surface-variant mt-0.5">
            Industrial Node 04
          </p>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              className={[
                "flex items-center px-3 py-2 rounded-lg transition-all duration-200 group",
                item.disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "",
                active
                  ? "bg-secondary text-on-secondary font-bold scale-95"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-disabled={item.disabled}
            >
              <span className="material-symbols-outlined mr-3 text-xl">{item.icon}</span>
              <span className="text-label-sm font-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto border-t border-outline-variant pt-4 space-y-1">
        <button
          onClick={onReportFault}
          className="w-full bg-secondary text-on-secondary font-bold py-2.5 rounded-lg mb-4 text-label-sm font-label tracking-wider hover:opacity-90 transition-opacity"
        >
          REPORT FAULT
        </button>

        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center px-3 py-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-all duration-200"
          >
            <span className="material-symbols-outlined mr-3 text-xl">{item.icon}</span>
            <span className="text-label-sm font-label">{item.label}</span>
          </Link>
        ))}

        {/* User chip */}
        <div className="flex items-center mt-5 px-2 gap-3 max-w-full overflow-hidden justify-between w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary font-bold text-xs shrink-0 uppercase">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-label-sm font-label font-bold text-on-surface truncate" title={userName}>
                {userName}
              </p>
              <p className="text-[10px] text-on-surface-variant truncate">{userRole}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-on-surface-variant hover:text-error hover:bg-surface-container-high rounded transition-all cursor-pointer shrink-0"
            title="Sign Out Operator"
          >
            <span className="material-symbols-outlined text-base">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
