"use client";

import { useEffect, useState } from "react";
import { X, Sun, Moon, Bell, Zap, Database, Shield, Monitor, Save } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [mlUrl, setMlUrl] = useState("");
  const [alerts, setAlerts] = useState(true);
  const [telemetryInterval, setTelemetryInterval] = useState("400");
  const [saved, setSaved] = useState(false);

  // Load persisted prefs
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMlUrl(localStorage.getItem("pfmi-ml-url") || "http://localhost:8000");
    setAlerts(localStorage.getItem("pfmi-alerts-enabled") !== "false");
    setTelemetryInterval(localStorage.getItem("pfmi-telemetry-ms") || "400");
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const save = () => {
    localStorage.setItem("pfmi-ml-url", mlUrl);
    localStorage.setItem("pfmi-alerts-enabled", String(alerts));
    localStorage.setItem("pfmi-telemetry-ms", telemetryInterval);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40 backdrop-blur-[2px] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <aside
        className={`fixed top-0 right-0 h-full z-50 w-80 bg-surface border-l border-border-mute shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-mute">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-text-muted" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-foreground">
              System Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-background transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Appearance */}
          <section>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-3">
              Appearance
            </p>
            <div className="flex items-center justify-between p-3 bg-background border border-border-mute rounded-xl">
              <div className="flex items-center gap-2">
                {theme === "dark" ? (
                  <Moon className="h-3.5 w-3.5 text-indigo-400" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className="text-xs font-semibold text-foreground">
                  {theme === "dark" ? "Dark Mode" : "Light Mode"}
                </span>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                  theme === "dark" ? "bg-indigo-500" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    theme === "dark" ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* ML Service */}
          <section>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-3">
              ML Service
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-background border border-border-mute rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-foreground">FastAPI Endpoint</span>
                </div>
                <input
                  type="text"
                  value={mlUrl}
                  onChange={(e) => setMlUrl(e.target.value)}
                  className="w-full bg-surface border border-border-mute rounded-lg px-3 py-1.5 text-[11px] font-mono text-foreground placeholder:text-text-muted focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                  placeholder="http://localhost:8000"
                />
              </div>
              <div className="p-3 bg-background border border-border-mute rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-foreground">Telemetry Sync (ms)</span>
                </div>
                <select
                  value={telemetryInterval}
                  onChange={(e) => setTelemetryInterval(e.target.value)}
                  className="w-full bg-surface border border-border-mute rounded-lg px-3 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors cursor-pointer"
                >
                  <option value="200">200ms — Fast</option>
                  <option value="400">400ms — Standard</option>
                  <option value="1000">1000ms — Slow</option>
                  <option value="2000">2000ms — Low power</option>
                </select>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-3">
              Notifications
            </p>
            <div className="flex items-center justify-between p-3 bg-background border border-border-mute rounded-xl">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">Alert Notifications</span>
              </div>
              <button
                onClick={() => setAlerts((p) => !p)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                  alerts ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    alerts ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Security info */}
          <section>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted mb-3">
              Security
            </p>
            <div className="p-3 bg-background border border-border-mute rounded-xl flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-mono text-text-muted leading-relaxed">
                Supabase auth active. Sessions expire after 7 days. All telemetry is transmitted over TLS 1.3.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-mute">
          <button
            onClick={save}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer ${
              saved
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved!" : "Save Preferences"}
          </button>
        </div>
      </aside>
    </>
  );
}
