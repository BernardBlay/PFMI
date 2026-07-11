"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Sun, Moon, Menu, X, Cpu, LogIn, Activity } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { name: "Features", href: "/#features" },
    { name: "How It Works", href: "/#how-it-works" },
    { name: "Prediction Engine", href: "/#stats" },
    { name: "Dashboard", href: "/dashboard" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-background/85 dark:bg-background/85 border-b border-border-mute backdrop-blur-md md:bg-transparent md:backdrop-blur-none md:border-b-0 md:pt-4 md:pb-1 md:px-6 no-print">
      <div className="mx-auto max-w-6xl w-full bg-transparent border-0 rounded-none shadow-none md:border md:border-border-mute md:bg-background/80 md:dark:bg-surface/80 md:backdrop-blur-md md:rounded-2xl md:shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] transition-all duration-300">
        <div className="flex h-14 items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-7.5 w-7.5 flex items-center justify-center rounded bg-foreground text-background border border-zinc-200 dark:border-zinc-800 transition-transform duration-300 group-hover:scale-105">
              <Cpu className="h-4.5 w-4.5" />
            </div>
            <span className="font-sans font-bold tracking-tight text-foreground">
              PFMI<span className="text-zinc-400 font-normal">.ai</span>
            </span>
          </Link>

          {/* Navigation Items (Desktop) */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[12px] font-medium tracking-wide transition-all rounded-full px-3.5 py-1.5 duration-200 hover:text-foreground hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80 ${
                    isActive 
                      ? "text-foreground bg-zinc-100 dark:bg-zinc-900 font-semibold" 
                      : "text-zinc-550 dark:text-zinc-400"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right side: CTA + hamburger */}
          <div className="flex items-center gap-3">
            {/* Light/Dark Toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full border border-zinc-250 dark:border-zinc-850 text-zinc-400 hover:text-foreground hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80 transition-all cursor-pointer active:scale-95"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-3.5 w-3.5 text-yellow-500" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-zinc-500" />
                )}
              </button>
            )}

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-zinc-200 dark:border-zinc-800 px-4 py-1.5 text-[11px] font-medium text-zinc-555 dark:text-zinc-400 hover:text-foreground hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full bg-zinc-950 dark:bg-zinc-50 px-4.5 py-1.5 text-[11px] font-bold text-white dark:text-black transition-transform duration-200 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full border border-zinc-200 dark:border-zinc-850 text-zinc-400 hover:text-foreground hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80 transition-colors cursor-pointer active:scale-95"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border-mute bg-background/40 backdrop-blur-lg rounded-b-2xl mobile-menu-enter">
            <nav className="flex flex-col px-6 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-xs font-medium py-2.5 px-4 rounded-full transition-colors ${
                      isActive
                        ? "text-foreground bg-zinc-100 dark:bg-zinc-900 font-semibold"
                        : "text-zinc-550 dark:text-zinc-455 hover:text-foreground hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <div className="border-t border-border-mute my-2" />
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href="/login"
                  className="flex items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-555 dark:text-zinc-455 hover:text-foreground hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center rounded-full bg-zinc-950 dark:bg-zinc-50 px-4 py-2.5 text-xs font-bold text-white dark:text-black transition-all hover:bg-zinc-800 dark:hover:bg-zinc-200"
                >
                  Get Started
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
