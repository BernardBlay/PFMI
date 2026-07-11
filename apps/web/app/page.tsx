"use client";

import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AnomalySimulator from "@/components/AnomalySimulator";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Stats from "@/components/Stats";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  // Intersection Observer for scroll-reveal animations
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
        rootMargin: "0px 0px -50px 0px" // triggers slightly before entering viewport
      }
    );

    // Track all reveal animation classes
    const targets = document.querySelectorAll(
      ".reveal, .reveal-scale, .reveal-left, .reveal-right, .hero-animate"
    );
    targets.forEach((el) => observer.observe(el));

    return () => {
      targets.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <Hero />
      <AnomalySimulator />
      <Features />
      <HowItWorks />
      <Stats />
      <CTA />
      <Footer />
    </main>
  );
}
