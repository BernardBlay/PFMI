import styles from "./Features.module.css";

const features = [
  {
    id: "dashboard",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    color: "#3b82f6",
    title: "Smart Dashboard",
    desc: "Real-time health overview for all your machines. Monitor status, alerts, and KPIs at a glance from a single control center.",
  },
  {
    id: "predictive",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><path d="M22 2l-5 5"/><path d="M17 2h5v5"/>
      </svg>
    ),
    color: "#8b5cf6",
    title: "Predictive Analytics",
    desc: "ML-powered models analyze historical patterns to forecast failures before they happen — reducing unplanned downtime by up to 70%.",
  },
  {
    id: "ocr",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>
    ),
    color: "#06b6d4",
    title: "OCR Data Entry",
    desc: "Snap a photo of any maintenance log, form, or manual. Our OCR engine extracts and digitizes data instantly — zero manual typing.",
  },
  {
    id: "api",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    ),
    color: "#10b981",
    title: "API Integration",
    desc: "Connect to simulated or real sensor data via REST API. Plug in any machine data source with our flexible integration layer.",
  },
  {
    id: "alerts",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    color: "#f59e0b",
    title: "Smart Alerts",
    desc: "Context-aware notifications prioritized by severity and impact. Get alerted before critical failures — not after the damage is done.",
  },
  {
    id: "reports",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
    color: "#ec4899",
    title: "Reports & Insights",
    desc: "Automated maintenance reports, part consumption trends, and cost analytics. Export-ready for management reviews and audits.",
  },
];

export default function Features() {
  return (
    <section className={styles.section} id="features">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.eyebrow}>Features</span>
          <h2 className={styles.title}>
            Everything you need to{" "}
            <span className={styles.gradientText}>maintain smarter</span>
          </h2>
        </div>

        {/* Grid */}
        <div className={styles.grid}>
          {features.map((f) => (
            <div key={f.id} className={styles.card} id={`feature-${f.id}`}>
              <div className={styles.iconWrap} style={{ "--feature-color": f.color } as React.CSSProperties}>
                {f.icon}
              </div>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
              <div className={styles.cardGlow} style={{ background: `radial-gradient(ellipse at 50% 100%, ${f.color}18 0%, transparent 70%)` }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
