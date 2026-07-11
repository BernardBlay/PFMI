"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Cpu, Activity, Layers, Move } from "lucide-react";

export default function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const autoSwipeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const slides = [
    {
      title: "Smart Telemetry Dashboard",
      description: "Real-time health overview for all machines. Monitor temperature, vibrations, pressure, and voltage at a glance.",
      icon: Cpu,
      color: "border-emerald-500/20 bg-surface dark:bg-zinc-900 text-emerald-650 dark:text-emerald-400",
    },
    {
      title: "Predictive AI Inference",
      description: "Machine learning models analyze sensor telemetry to forecast Remaining Useful Life (RUL) and anomaly probability.",
      icon: Activity,
      color: "border-indigo-500/20 bg-surface dark:bg-zinc-900 text-indigo-650 dark:text-indigo-400",
    },
    {
      title: "OCR Data Entry Pipeline",
      description: "Upload scans or photos of manual logbooks. The OCR engine digitizes and extracts service notes automatically.",
      icon: Layers,
      color: "border-amber-500/20 bg-surface dark:bg-zinc-900 text-amber-650 dark:text-amber-455",
    }
  ];

  useEffect(() => {
    if (isUserInteracting) return;
    autoSwipeTimerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 3800);
    return () => {
      if (autoSwipeTimerRef.current) clearInterval(autoSwipeTimerRef.current);
    };
  }, [isUserInteracting, slides.length]);

  const handleUserInteraction = useCallback(() => {
    setIsUserInteracting(true);
    const resumeTimer = setTimeout(() => setIsUserInteracting(false), 6000);
    return () => clearTimeout(resumeTimer);
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden">
      <div className="relative h-[250px] flex items-center justify-center">
        {/* Swipe hint */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 2.5, duration: 0.5 }}
          className="absolute top-1 text-center text-[10px] text-text-muted pointer-events-none z-20 flex items-center gap-1 font-mono uppercase tracking-wider"
        >
          <Move className="w-3 h-3 animate-pulse" /> Swipe to navigate features
        </motion.div>

        {/* Drag Container */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragStart={(e, info) => {
            setDragStartX(info.point.x);
            handleUserInteraction();
          }}
          onDragEnd={(e, info) => {
            const dragDistance = info.point.x - dragStartX;
            const threshold = 55;

            if (dragDistance > threshold) {
              setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
            } else if (dragDistance < -threshold) {
              setActiveIndex((prev) => (prev + 1) % slides.length);
            }
          }}
          className="relative w-full h-full cursor-grab active:cursor-grabbing"
        >
          {slides.map((slide, idx) => {
            const offset = (idx - activeIndex) * 90;
            const absOffset = Math.abs(idx - activeIndex);
            const scale = idx === activeIndex ? 1 : Math.max(0.78, 1 - absOffset * 0.12);
            const opacity = idx === activeIndex ? 1 : Math.max(0.15, 1 - absOffset * 0.45);
            const zIndex = 10 - absOffset;

            const Icon = slide.icon;

            return (
              <motion.div
                key={idx}
                animate={{
                  x: `${offset}%`,
                  scale,
                  opacity,
                }}
                transition={{
                  type: "tween",
                  ease: "easeInOut",
                  duration: 0.45,
                }}
                onClick={() => {
                  if (idx !== activeIndex) {
                    setActiveIndex(idx);
                    handleUserInteraction();
                  }
                }}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] p-6 rounded-2xl border transition-all duration-300 ${slide.color} flex flex-col items-center text-center space-y-3.5 shadow-sm relative overflow-hidden`}
                style={{ zIndex, willChange: "transform, opacity" }}
              >
                <div className="p-3 rounded-full bg-surface dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 shadow-xs text-foreground">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h4 className="text-xs font-bold text-foreground tracking-tight">
                  {slide.title}
                </h4>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {slide.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Dot Indicators */}
      <div className="flex justify-center gap-1.5 mt-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveIndex(idx);
              handleUserInteraction();
            }}
            aria-label={`Go to feature ${idx + 1}`}
            className="w-10 h-10 flex items-center justify-center -m-3 touch-manipulation cursor-pointer"
          >
            <motion.div
              animate={{
                width: idx === activeIndex ? 18 : 6,
                backgroundColor: idx === activeIndex ? "#10b981" : "var(--color-card-border, rgba(161,161,170,0.3))",
              }}
              transition={{ duration: 0.25 }}
              className="h-1.5 rounded-full"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
