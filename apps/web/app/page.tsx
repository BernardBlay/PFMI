"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AnomalySimulator from "@/components/AnomalySimulator";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Stats from "@/components/Stats";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import DemoGuide from "@/components/DemoGuide";

// Maps demo step index → section id (matches DemoGuide STEPS scrollTarget)
const STEP_SECTION_IDS: Record<number, string> = {
  0: "",                   // Hero — top of page, no id needed
  1: "anomaly-simulator",
  2: "features",
  3: "how-it-works",
  4: "stats",
  5: "cta",
};

export default function Home() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  // Scroll-reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    const targets = document.querySelectorAll(
      ".reveal, .reveal-scale, .reveal-left, .reveal-right, .hero-animate"
    );
    targets.forEach((el) => observer.observe(el));
    return () => targets.forEach((el) => observer.unobserve(el));
  }, []);

  // Determine which section id is currently spotlit
  const spotlitId = activeStep !== null ? STEP_SECTION_IDS[activeStep] : null;

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      {/* Hero — step 0 */}
      <div className={spotlitId === "" && activeStep === 0 ? "demo-spotlight" : ""}>
        <Hero />
      </div>

      {/* Anomaly Simulator — step 1 */}
      <div
        id="anomaly-simulator"
        className={spotlitId === "anomaly-simulator" ? "demo-spotlight" : ""}
      >
        <AnomalySimulator />
      </div>

      {/* Features — step 2 */}
      <div
        id="features"
        className={spotlitId === "features" ? "demo-spotlight" : ""}
      >
        <Features />
      </div>

      {/* How It Works — step 3 */}
      <div
        id="how-it-works"
        className={spotlitId === "how-it-works" ? "demo-spotlight" : ""}
      >
        <HowItWorks />
      </div>

      {/* Prediction Engine / Stats — step 4 */}
      <div
        id="stats"
        className={spotlitId === "stats" ? "demo-spotlight" : ""}
      >
        <Stats />
      </div>

      {/* CTA — step 5 */}
      <div
        id="cta"
        className={spotlitId === "cta" ? "demo-spotlight" : ""}
      >
        <CTA />
      </div>

      <Footer />

      <DemoGuide activeStep={activeStep} onStepChange={setActiveStep} />
    </main>
  );
}
