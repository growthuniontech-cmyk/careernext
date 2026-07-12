"use client";

import { useState } from "react";

/** Simple add/remove editor for a flat string list (Awards, Certifications,
 *  Memberships, Publications, Volunteer, Core Competencies). */
export default function ListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-1.5 rounded-full bg-teal-soft text-indigo text-sm font-medium px-3 py-1"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-charcoal/40 hover:text-coral-dark"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-charcoal/15 px-3.5 py-2 text-sm focus:outline-none focus:border-teal"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-xl bg-indigo hover:bg-indigo-light transition-colors px-4 py-2 text-sm font-semibold text-white"
        >
          Add
        </button>
      </div>
    </div>
  );
}
