"use client";

import type { User } from "@supabase/supabase-js";
import { Search, Bell, AlertTriangle, Settings } from "lucide-react";

interface Props {
  onEmergencyClick?: () => void;
  pageTitle?: string;
  user: User | null;
}

export default function TopNav({ onEmergencyClick, pageTitle, user }: Props) {
  const userName = user
    ? user.user_metadata?.full_name || user.email?.split("@")[0] || "Operator"
    : "Operator 04";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <header className="flex justify-between items-center h-16 px-6 w-full sticky top-0 z-35 bg-surface/85 backdrop-blur-md border-b border-border-mute">
      {/* Left: Brand + Page Title */}
      <div className="flex items-center gap-6">
        <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wider">
          PREVENTIVE INTEL
        </span>
        {pageTitle && (
          <span className="hidden md:block text-[10px] font-mono uppercase text-text-muted">
            / {pageTitle}
          </span>
        )}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted h-3.5 w-3.5" />
          <input
            className="pl-9 pr-4 py-1.5 bg-background border border-border-mute rounded-lg text-xs w-64 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700 transition-all text-foreground placeholder:text-text-muted"
            placeholder="Search fleet..."
            type="text"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-background rounded-full text-text-muted hover:text-foreground transition-colors cursor-pointer">
          <Bell className="h-4 w-4" />
        </button>

        {/* Emergency Trigger */}
        <button
          onClick={onEmergencyClick}
          className="p-2 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20 transition-colors cursor-pointer"
          aria-label="Open emergency alert"
          title="Emergency"
        >
          <AlertTriangle className="h-4 w-4" />
        </button>

        <button className="p-2 hover:bg-background rounded-full text-text-muted hover:text-foreground transition-colors cursor-pointer">
          <Settings className="h-4 w-4" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full border border-border-mute bg-foreground text-background flex items-center justify-center font-bold text-[10px] ml-1 select-none cursor-default uppercase">
          {userInitials}
        </div>
      </div>
    </header>
  );
}
