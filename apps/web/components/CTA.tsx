import styles from "./CTA.module.css";

export default function CTA() {
  return (
    <section className={styles.section}>
      <div className={styles.card}>
        {/* Ambient glow */}
        <div className={styles.glow} />

        {/* Grid overlay */}
        <div className={styles.grid} />

        <div className={styles.content}>
          <span className={styles.eyebrow}>Ready to get started?</span>
          <h2 className={styles.title}>
            Transform your maintenance
            <br />
            <span className={styles.gradientText}>operations today</span>
          </h2>
          <p className={styles.subtitle}>
            Join the growing number of facilities using PFMI to predict failures,
            reduce downtime, and cut maintenance costs by up to 45%.
          </p>

          <div className={styles.actions}>
            <a href="/dashboard" className={styles.btnPrimary} id="cta-get-started">
              Get Started Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
            <a href="#features" className={styles.btnSecondary} id="cta-learn-more">
              Learn More
            </a>
          </div>

          <p className={styles.note}>
            No credit card required · Built for Build Weekend 1.0
          </p>
        </div>
      </div>
    </section>
  );
}
