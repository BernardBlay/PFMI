"use client";
import { useState, useEffect } from "react";
import styles from "./Navbar.module.css";
import { useTheme } from "./ThemeProvider";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setMobileOpen(false);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <a href="/" className={styles.logo}>
          <img src="/logo.png" alt="PFMI Logo" className={styles.logoImg} />
          <span className={styles.logoText}>PFMI</span>
        </a>

        {/* Desktop links */}
        <ul className={styles.links}>
          <li><a href="#features" className={styles.link}>Features</a></li>
          <li><a href="#how-it-works" className={styles.link}>How It Works</a></li>
          <li><a href="#stats" className={styles.link}>Stats</a></li>
          <li><a href="/dashboard" className={styles.link}>Dashboard</a></li>
        </ul>

        {/* Desktop actions */}
        <div className={styles.actions}>
          <button onClick={toggleTheme} className={styles.themeToggle} aria-label="Toggle theme">
            {mounted && theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            )}
          </button>
          <a href="/login" className={styles.btnGhost}>Sign In</a>
          <a href="/dashboard" className={styles.btnPrimary}>
            Get Started
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>

        {/* Hamburger */}
        <button
          className={`${styles.hamburger} ${mobileOpen ? styles.open : ""}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle mobile menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`${styles.mobile} ${mobileOpen ? styles.mobileOpen : ""}`}>
        <a href="#features" onClick={close}>Features</a>
        <a href="#how-it-works" onClick={close}>How It Works</a>
        <a href="#stats" onClick={close}>Stats</a>
        <a href="/dashboard" onClick={close}>Dashboard</a>
        <div className={styles.mobileDivider} />
        <a href="/login" onClick={close}>Sign In</a>
        <a href="/dashboard" onClick={close} className={styles.mobilePrimary}>Get Started →</a>
      </div>
    </nav>
  );
}
