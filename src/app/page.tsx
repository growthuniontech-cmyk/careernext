import Link from "next/link";
import Header from "@/components/Header";
import HeroBackground from "@/components/landing/HeroBackground";
import Reveal from "@/components/landing/Reveal";
import CountUp from "@/components/landing/CountUp";
import StepCard from "@/components/landing/StepCard";

const EXPLAINERS = [
  {
    step: "01",
    title: "Find your real match",
    body: "Upload your resume and see the 3-5 job titles you're actually closest to, each with a compatibility score and a plain-English reason.",
    motif: (
      <svg viewBox="0 0 120 48" className="h-12 w-full" aria-hidden="true">
        <path
          d="M4 42 C 28 42, 38 18, 62 18 S 94 32, 106 10"
          fill="none"
          stroke="#12b886"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="draw-path"
          style={{ "--len": 160 } as React.CSSProperties}
        />
        <circle cx="34" cy="30" r="2.5" fill="#12b886" opacity="0.25" />
        <circle cx="80" cy="26" r="2.5" fill="#12b886" opacity="0.25" />
        <circle
          cx="106"
          cy="10"
          r="4"
          fill="#12b886"
          className="motif-dot"
          style={{ "--d": "1.4s" } as React.CSSProperties}
        />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Get the exact toolkit",
    body: "For your chosen role, see which AI tools matter most, ranked by impact, with the real task each one helps you do.",
    motif: (
      <svg viewBox="0 0 120 48" className="h-12 w-full" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <circle
            key={i}
            cx={18 + (i % 4) * 28}
            cy={i < 4 ? 14 : 34}
            r={i === 1 ? 5 : 3.5}
            fill="#12b886"
            fillOpacity={i === 1 ? 1 : 0.45}
            className="motif-dot"
            style={{ "--d": `${0.35 + i * 0.12}s` } as React.CSSProperties}
          />
        ))}
      </svg>
    ),
  },
  {
    step: "03",
    title: "Learn in the right order",
    body: "A sequenced path built around your gaps, a time-to-job-ready estimate, and one small task a day to keep you moving.",
    motif: (
      <svg viewBox="0 0 120 48" className="h-12 w-full" aria-hidden="true">
        <path
          d="M6 42 H30 V30 H54 V18 H78 V8 H102"
          fill="none"
          stroke="#12b886"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="draw-path"
          style={{ "--len": 180 } as React.CSSProperties}
        />
        <circle
          cx="102"
          cy="8"
          r="4"
          fill="#ffc857"
          className="motif-dot"
          style={{ "--d": "1.5s" } as React.CSSProperties}
        />
      </svg>
    ),
  },
];

const TESTIMONIAL_PLACEHOLDERS = [
  {
    quote:
      "I'd bounced between three different tutorials that all told me to learn something different first. CareerNext showed me the two tools that actually mattered for the role I wanted, and the order to learn them in.",
    name: "Sofia M.",
    role: "Now a Marketing Analyst",
  },
  {
    quote:
      "I knew AI would be part of my next job, I just didn't know where to start or which title to even aim for. This gave me an actual plan instead of a list of buzzwords.",
    name: "Daniel K.",
    role: "Now an Operations Coordinator",
  },
  {
    quote:
      "The one small task a day kept me moving on the days I would've just closed my laptop. Six weeks in, I had two interviews lined up.",
    name: "Priya R.",
    role: "Now a Junior Data Analyst",
  },
];

const STATS = [
  { end: 225, suffix: "+", label: "AI tools mapped and ranked" },
  { end: 5, prefix: "3-", label: "role matches per resume" },
  { end: 1, label: "small task a day to job-ready" },
];

export default function Home() {
  return (
    <main className="flex-1 landing-surface text-white">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden min-h-[92svh] flex items-center">
        <HeroBackground />
        <div className="relative z-10 mx-auto max-w-5xl px-5 pt-32 pb-24 text-center">
          <h1 className="rise-in font-heading font-bold text-5xl sm:text-7xl leading-[1.05] tracking-tight bg-gradient-to-r from-white via-white to-[#7fe0c3] bg-clip-text text-transparent">
            Wrong tools. Wrong role.
            <br />
            Wrong order.
          </h1>
          <p className="rise-in rise-in-delay-1 mt-7 text-lg sm:text-xl text-white/75 max-w-2xl mx-auto leading-relaxed">
            Most job seekers aren&apos;t behind, they&apos;re just aimed wrong.
            CareerNext reads your resume and shows you the role to target, the
            AI tools to learn for it, and the order to learn them in.
          </p>
          <div className="rise-in rise-in-delay-2 mt-11">
            <Link
              href="/start"
              className="inline-block rounded-full bg-coral hover:bg-coral-dark transition-all px-9 py-4 text-lg font-heading font-semibold text-white shadow-[0_8px_40px_-8px_rgba(255,107,74,0.55)] hover:shadow-[0_10px_48px_-6px_rgba(255,107,74,0.7)]"
            >
              Find your path
            </Link>
            <p className="mt-4 text-sm text-white/50">
              Free · No signup needed to see your matches
            </p>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="relative border-y border-white/10 bg-white/[0.02]">
        <Reveal>
          <div className="mx-auto max-w-5xl px-5 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-heading font-bold text-4xl text-teal">
                  <CountUp end={s.end} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm text-white/55">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Explainer */}
      <section className="glow-band">
        <div className="mx-auto max-w-5xl px-5 py-24">
          <Reveal>
            <p className="font-accent italic text-teal text-center text-lg">
              Clarity first. Momentum second. Job offers follow.
            </p>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white text-center mt-3">
              How it works
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {EXPLAINERS.map((item, i) => (
              <StepCard key={item.step} delay={i * 120} motif={item.motif}>
                <span className="mt-5 inline-block font-heading font-bold text-teal text-sm">
                  {item.step}
                </span>
                <h3 className="font-heading font-semibold text-xl text-white mt-2">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  {item.body}
                </p>
              </StepCard>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof placeholder */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-5 py-24">
          <Reveal>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white text-center">
              People are finding their path
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {TESTIMONIAL_PLACEHOLDERS.map((t, i) => (
              <Reveal key={i} delay={i * 120}>
                <figure className="glass-card rounded-2xl p-7 h-full">
                  <blockquote className="font-accent italic text-white/65 text-sm leading-relaxed">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-4 text-xs text-white/40">
                    {t.name} · {t.role}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="glow-band">
        <Reveal>
          <div className="mx-auto max-w-5xl px-5 py-24 text-center">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white">
              Your next role is closer than you think.
            </h2>
            <p className="mt-4 text-white/60">
              Two minutes to upload. A clear plan by the time you finish your
              coffee.
            </p>
            <Link
              href="/start"
              className="mt-9 inline-block rounded-full bg-coral hover:bg-coral-dark transition-all px-9 py-4 text-lg font-heading font-semibold text-white shadow-[0_8px_40px_-8px_rgba(255,107,74,0.55)] hover:shadow-[0_10px_48px_-6px_rgba(255,107,74,0.7)]"
            >
              Find your path
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-8 text-center text-xs text-white/40">
          © {new Date().getFullYear()} CareerNext. Built for job seekers
          everywhere.
        </div>
      </footer>
    </main>
  );
}
