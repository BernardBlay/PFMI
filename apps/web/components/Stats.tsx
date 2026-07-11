import styles from "./Stats.module.css";

const stats = [
  {
    value: "2,400+",
    label: "Machines Monitored",
    sublabel: "across connected facilities",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    value: "99.2%",
    label: "Uptime Achieved",
    sublabel: "average across all clients",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
  {
    value: "180+",
    label: "Parts Auto-Ordered",
    sublabel: "per month, predictively",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    value: "45%",
    label: "Cost Reduction",
    sublabel: "in maintenance spending",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
        <polyline points="17 18 23 18 23 12"/>
      </svg>
    ),
  },
];

export default function Stats() {
  return (
    <section className={styles.section} id="stats">
      <div className={styles.bg} />
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>By The Numbers</span>
          <h2 className={styles.title}>
            Results that speak{" "}
            <span className={styles.gradientText}>for themselves</span>
          </h2>
        </div>

        <div className={styles.grid}>
          {stats.map((s) => (
            <div key={s.label} className={styles.card}>
              <div className={styles.cardInner}>
                <span className={styles.icon}>{s.icon}</span>
                <span className={styles.value}>{s.value}</span>
                <span className={styles.label}>{s.label}</span>
                <span className={styles.sublabel}>{s.sublabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
