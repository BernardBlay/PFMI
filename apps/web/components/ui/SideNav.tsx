"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/db";
import { User } from "@supabase/supabase-js";
import { 
  Cpu, 
  Activity, 
  Wrench, 
  AlertTriangle, 
  Package, 
  FileText, 
  HelpCircle, 
  LogOut,
  ChevronRight
} from "lucide-react";


const BOTTOM_ITEMS = [
  { href: "/ocr-upload", icon: FileText, label: "OCR Log Upload" },
  { href: "#", icon: HelpCircle, label: "Support" },
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
    href !== "#" && (pathname === href || (href !== "/dashboard" && pathname === href));

  // Dynamic user representation
  const userName = user
    ? user.user_metadata?.full_name || user.email?.split("@")[0] || "Operator"
    : "Operator 04";
  const userInitials = userName.slice(0, 2).toUpperCase();
  
  const rawRole = user?.user_metadata?.role;
  const userRole = user
    ? rawRole === "Admin"
      ? "System Admin"
      : rawRole === "Lead Tech"
      ? "Lead Technician"
      : rawRole === "Sys Eng"
      ? "System Engineer"
      : user.email === "tech@pfmi.ai"
      ? "Lead Technician"
      : "Operator Node 04"
    : "System Admin";

  const isAdmin = rawRole === "Admin";

  const navItems = [
    { href: "/dashboard", icon: Cpu, label: "Fleet Overview" },
    { href: "/dashboard/EQ-101", icon: Activity, label: "Live Telemetry" },
    { href: "/dashboard/personnel", icon: Wrench, label: "Personnel", disabled: !isAdmin },
    { href: "/dashboard/complaints", icon: AlertTriangle, label: "Complaints", disabled: !isAdmin },
    { href: "/dashboard/inventory", icon: Package, label: "Inventory", disabled: !isAdmin },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col p-4 z-40 bg-surface border-r border-border-mute w-64 no-print">
      {/* Brand */}
      <div className="mb-8 px-2 flex items-center gap-2">
        <div className="h-6 w-6 flex items-center justify-center rounded bg-foreground text-background border border-zinc-200 dark:border-zinc-800">
          <Cpu className="h-3.5 w-3.5" />
        </div>
        <div>
          <h1 className="text-xs font-bold text-foreground tracking-tight font-sans">
            Maintenance Hub
          </h1>
          <p className="text-[9px] font-bold font-mono text-text-muted uppercase tracking-widest leading-none mt-0.5">
            Node 04 • active
          </p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              className={[
                "flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-250 group",
                item.disabled ? "opacity-35 cursor-not-allowed pointer-events-none" : "",
                active
                  ? "bg-foreground text-background font-bold scale-[0.98]"
                  : "text-text-muted hover:bg-background hover:text-foreground",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-disabled={item.disabled}
            >
              <div className="flex items-center">
                <Icon className="mr-3 h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {!item.disabled && (
                <ChevronRight className={`h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity ${active ? "text-background" : "text-foreground"}`} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto border-t border-border-mute pt-4 space-y-1.5">
        <button
          onClick={onReportFault}
          className="w-full bg-red-650 hover:bg-red-700 text-white font-bold py-2 rounded-lg mb-4 text-[10px] font-mono tracking-widest uppercase cursor-pointer transition-all active:scale-[0.97]"
        >
          REPORT FAULT
        </button>

        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={[
                "flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200",
                active 
                  ? "bg-foreground text-background font-bold" 
                  : "text-text-muted hover:bg-background hover:text-foreground"
              ].join(" ")}
            >
              <Icon className="mr-3 h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* User Card */}
        <div className="flex items-center mt-5 p-2 bg-background border border-border-mute rounded-xl gap-3 max-w-full overflow-hidden justify-between w-full">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-foreground text-background border border-zinc-200 dark:border-zinc-800 flex items-center justify-center font-bold text-[11px] shrink-0 uppercase">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-foreground truncate" title={userName}>
                {userName}
              </p>
              <p className="text-[9px] font-mono uppercase text-text-muted leading-none mt-0.5 truncate">{userRole}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-text-muted hover:text-red-500 hover:bg-surface rounded transition-all cursor-pointer shrink-0"
            title="Sign Out Operator"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
