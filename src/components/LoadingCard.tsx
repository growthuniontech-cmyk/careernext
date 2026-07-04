"use client";

import { useEffect, useState } from "react";

/** Friendly loading state for the 10-20s AI steps, rotating reassurance so
 *  the screen never feels broken. */
export default function LoadingCard({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      3200,
    );
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-charcoal/5 p-10 flex flex-col items-center text-center gap-5">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-teal-soft" />
        <div className="absolute inset-0 rounded-full border-4 border-teal border-t-transparent animate-spin" />
      </div>
      <p
        key={index}
        className="font-heading font-semibold text-lg text-indigo rise-in"
      >
        {messages[index]}
      </p>
      <p className="text-sm text-charcoal/60 max-w-xs">
        This usually takes 10-20 seconds. Good things are happening.
      </p>
    </div>
  );
}
