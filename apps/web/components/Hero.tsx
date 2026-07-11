"use client";
import { useEffect, useRef } from "react";
import styles from "./Hero.module.css";

const stats = [
  { value: "2,400+", label: "Machines Monitored" },
  { value: "99.2%", label: "Uptime Achieved" },
  { value: "180+", label: "Parts Auto-Ordered" },
  { value: "45%", label: "Cost Reduction" },
];

export default function Hero() {
  const headlineRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = headlineRef.current;
    if (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(24px)";
      setTimeout(() => {
        el.style.transition = "opacity 0.8s ease, transform 0.8s ease";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, 100);
    }
  }, []);

  return (
    <section className={styles.hero}>
      {/* Ambient orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      {/* Grid overlay */}
      <div className={styles.grid} />

      <div className={styles.content}>
        {/* Headline */}
        <h1 ref={headlineRef} className={styles.headline}>
          Hybrid Preventive
          <br />
          <span className={styles.gradientWord}>Maintenance</span>
          <br />
          Intelligence
        </h1>



        {/* CTA buttons */}
        <div className={styles.actions}>
          <a href="/dashboard" className={styles.btnPrimary} id="hero-cta-primary">
            Get Started Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
          <a href="#how-it-works" className={styles.btnSecondary} id="hero-cta-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            See How It Works
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className={styles.scrollIndicator}>
        <div className={styles.scrollMouse}>
          <div className={styles.scrollWheel} />
        </div>
        <span>Scroll to explore</span>
      </div>
    </section>
  );
}
