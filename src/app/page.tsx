import Link from "next/link";
import Header from "@/components/Header";

const EXPLAINERS = [
  {
    step: "01",
    title: "Find your real match",
    body: "Upload your resume and see the 3–5 job titles you're actually closest to — each with a compatibility score and a plain-English reason.",
  },
  {
    step: "02",
    title: "Get the exact toolkit",
    body: "For your chosen role, see which AI tools matter most — ranked by impact, with the real task each one helps you do.",
  },
  {
    step: "03",
    title: "Learn in the right order",
    body: "A sequenced path built around your gaps, a time-to-job-ready estimate, and one small task a day to keep you moving.",
  },
];

const TESTIMONIAL_PLACEHOLDERS = [
  {
    quote:
      "Testimonial coming soon — this space is reserved for someone whose job search just got a lot clearer.",
    name: "Early user",
    role: "Placeholder",
  },
  {
    quote:
      "Testimonial coming soon — real stories from real career changers will live here.",
    name: "Early user",
    role: "Placeholder",
  },
  {
    quote:
      "Testimonial coming soon — watch this space as our first cohort lands interviews.",
    name: "Early user",
    role: "Placeholder",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <Header />

      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-5 pt-32 pb-24 text-center">
          <h1 className="rise-in font-heading font-bold text-4xl sm:text-6xl text-white leading-tight">
            Wrong tools. Wrong role.
            <br />
            Wrong order.
          </h1>
          <p className="rise-in rise-in-delay-1 mt-6 text-lg sm:text-xl text-white/85 max-w-2xl mx-auto">
            Most job seekers aren&apos;t behind — they&apos;re just aimed wrong.
            CareerNext reads your resume and shows you the role to target, the
            AI tools to learn for it, and the order to learn them in.
          </p>
          <div className="rise-in rise-in-delay-2 mt-10">
            <Link
              href="/start"
              className="inline-block rounded-full bg-coral hover:bg-coral-dark transition-colors px-8 py-4 text-lg font-heading font-semibold text-white shadow-lg shadow-black/20"
            >
              Find your path
            </Link>
            <p className="mt-4 text-sm text-white/60">
              Free · No signup needed to see your matches
            </p>
          </div>
        </div>
      </section>

      {/* Explainer */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="font-accent italic text-teal text-center text-lg">
          Clarity first. Momentum second. Job offers follow.
        </p>
        <h2 className="font-heading font-bold text-3xl text-indigo text-center mt-3">
          How it works
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {EXPLAINERS.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl bg-white border border-charcoal/5 shadow-sm p-7"
            >
              <span className="font-heading font-bold text-teal text-sm">
                {item.step}
              </span>
              <h3 className="font-heading font-semibold text-xl text-indigo mt-2">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-charcoal/70">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof placeholder */}
      <section className="bg-indigo">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="font-heading font-bold text-3xl text-white text-center">
            People are finding their path
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {TESTIMONIAL_PLACEHOLDERS.map((t, i) => (
              <figure
                key={i}
                className="rounded-2xl bg-white/5 border border-white/10 p-7"
              >
                <blockquote className="font-accent italic text-white/70 text-sm leading-relaxed">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-4 text-xs text-white/50">
                  {t.name} · {t.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-5xl px-5 py-20 text-center">
        <h2 className="font-heading font-bold text-3xl text-indigo">
          Your next role is closer than you think.
        </h2>
        <p className="mt-3 text-charcoal/70">
          Two minutes to upload. A clear plan by the time you finish your
          coffee.
        </p>
        <Link
          href="/start"
          className="mt-8 inline-block rounded-full bg-coral hover:bg-coral-dark transition-colors px-8 py-4 text-lg font-heading font-semibold text-white shadow-md"
        >
          Find your path
        </Link>
      </section>

      <footer className="border-t border-charcoal/10">
        <div className="mx-auto max-w-5xl px-5 py-8 text-center text-xs text-charcoal/50">
          © {new Date().getFullYear()} CareerNext. Built for job seekers
          everywhere.
        </div>
      </footer>
    </main>
  );
}
