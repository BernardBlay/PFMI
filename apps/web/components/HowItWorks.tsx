import styles from "./HowItWorks.module.css";

const steps = [
  {
    number: "01",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
    title: "Connect Your Machines",
    desc: "Hook up your equipment via our REST API or use OCR to scan and import existing maintenance logs and manuals in seconds.",
    tag: "Setup",
  },
  {
    number: "02",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>
        <path d="M22 2l-5 5"/><path d="M17 2h5v5"/>
      </svg>
    ),
    title: "Analyze & Predict",
    desc: "Our ML model processes usage patterns, maintenance history, and sensor data to forecast failures and auto-schedule part orders.",
    tag: "Intelligence",
  },
  {
    number: "03",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "Act & Optimize",
    desc: "Receive prioritized maintenance tasks, automated alerts, and detailed reports — keeping machines running and costs low.",
    tag: "Action",
  },
];

export default function HowItWorks() {
  return (
    <section className={styles.section} id="how-it-works">
      {/* Background accent */}
      <div className={styles.bg} />

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.eyebrow}>How It Works</span>
          <h2 className={styles.title}>
            From machines to{" "}
            <span className={styles.gradientText}>intelligent insights</span>
            {" "}in 3 steps
          </h2>
          <p className={styles.subtitle}>
            PFMI is designed to be operational from day one — no complex setup, no lengthy onboarding.
          </p>
        </div>

        {/* Steps */}
        <div className={styles.steps}>
          {steps.map((step, i) => (
            <div key={step.number} className={styles.step}>
              {/* Connector line */}
              {i < steps.length - 1 && <div className={styles.connector} />}

              <div className={styles.stepCard} id={`step-${step.number}`}>
                <div className={styles.stepHeader}>
                  <div className={styles.iconBox}>{step.icon}</div>
                  <span className={styles.stepTag}>{step.tag}</span>
                </div>
                <div className={styles.stepNum}>{step.number}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
