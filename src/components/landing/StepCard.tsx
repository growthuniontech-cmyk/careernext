"use client";

import { useEffect, useRef, useState } from "react";

export default function StepCard({
  children,
  motif,
  delay = 0,
}: {
  children: React.ReactNode;
  motif: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [motifKey, setMotifKey] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${visible ? "reveal-visible" : ""}`}
      onMouseEnter={() => setMotifKey((k) => k + 1)}
    >
      <div className="glass-card rounded-2xl p-7 h-full">
        <div key={motifKey}>{motif}</div>
        {children}
      </div>
    </div>
  );
}
