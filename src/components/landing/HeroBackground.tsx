"use client";

import { useEffect, useRef, useState } from "react";

type Node = { x: number; y: number; vx: number; vy: number; r: number };
type Tracer = { t: number; speed: number; baseY: number; amp: number; phase: number };

const TEAL = "18, 184, 134";
const LINK_DIST = 150;

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoMissing, setVideoMissing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;
    let nodes: Node[] = [];
    const tracers: Tracer[] = [
      { t: 0.0, speed: 0.00055, baseY: 0.72, amp: 40, phase: 0 },
      { t: 0.45, speed: 0.0004, baseY: 0.55, amp: 55, phase: 2.1 },
      { t: 0.8, speed: 0.0005, baseY: 0.85, amp: 30, phase: 4.4 },
    ];

    function resize() {
      if (!canvas) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.floor((width * height) / 16000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 0.8 + Math.random() * 1.6,
      }));
    }

    // Career-path tracer: a glowing line climbing left-to-right across the canvas
    function tracerPoint(tr: Tracer, t: number) {
      const x = t * (width + 200) - 100;
      const y =
        height * tr.baseY -
        t * height * 0.35 +
        Math.sin(t * 7 + tr.phase) * tr.amp;
      return { x, y };
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < LINK_DIST) {
            ctx!.strokeStyle = `rgba(${TEAL}, ${(1 - d / LINK_DIST) * 0.13})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx!.fillStyle = `rgba(${TEAL}, 0.55)`;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = width + 10;
        if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        if (n.y > height + 10) n.y = -10;
      }

      for (const tr of tracers) {
        const steps = 24;
        for (let s = 0; s < steps; s++) {
          const t0 = tr.t - (s / steps) * 0.09;
          const t1 = tr.t - ((s + 1) / steps) * 0.09;
          if (t1 < 0) break;
          const p0 = tracerPoint(tr, t0);
          const p1 = tracerPoint(tr, t1);
          ctx!.strokeStyle = `rgba(${TEAL}, ${(1 - s / steps) * 0.7})`;
          ctx!.lineWidth = 1.8 * (1 - s / steps) + 0.4;
          ctx!.beginPath();
          ctx!.moveTo(p0.x, p0.y);
          ctx!.lineTo(p1.x, p1.y);
          ctx!.stroke();
        }
        const head = tracerPoint(tr, tr.t);
        ctx!.fillStyle = `rgba(${TEAL}, 0.9)`;
        ctx!.beginPath();
        ctx!.arc(head.x, head.y, 2.4, 0, Math.PI * 2);
        ctx!.fill();
        tr.t += tr.speed * 16;
        if (tr.t > 1.15) tr.t = -0.05;
      }
    }

    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }

    resize();
    if (reduced) {
      draw();
    } else {
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Drops in automatically once public/videos/hero-loop.mp4 exists */}
      {!videoMissing && (
        <video
          src="/videos/hero-loop.mp4"
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoMissing(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            videoReady ? "opacity-45" : "opacity-0"
          }`}
        />
      )}
      <div className="absolute inset-0 hero-vignette" />
    </div>
  );
}
