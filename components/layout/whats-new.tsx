"use client";

import { useEffect, useState } from "react";
import { LATEST } from "@/lib/changelog";

const TYPE_LABEL = {
  new: { text: "Novità", bg: "bg-brand-dim", color: "text-brand-hover" },
  fix: { text: "Fix", bg: "bg-ready-go/[0.12]", color: "text-ready-go" },
  improve: { text: "Miglioramento", bg: "bg-accent2-dim", color: "text-accent2-hover" },
} as const;

export function WhatsNew() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/settings/whats-new")
      .then((r) => r.json())
      .then((json: { show: boolean }) => { if (json.show) setVisible(true); })
      .catch(() => null);
  }, []);

  function dismiss() {
    setVisible(false);
    fetch("/api/settings/whats-new", { method: "POST" }).catch(() => null);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-base/80 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-[24px] border border-border bg-surface p-6 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              v{LATEST.version} · {LATEST.date}
            </p>
            <h2
              id="whats-new-title"
              className="mt-1 font-serif text-[20px] font-medium leading-tight text-foreground"
            >
              {LATEST.title}
            </h2>
          </div>
          <button
            onClick={dismiss}
            aria-label="Chiudi"
            className="mt-0.5 shrink-0 text-faint transition-colors hover:text-secondary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <ul className="space-y-2.5">
          {LATEST.items.map((item, i) => {
            const badge = TYPE_LABEL[item.type];
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={`mt-[2px] shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.color}`}
                >
                  {badge.text}
                </span>
                <span className="text-[13px] leading-snug text-secondary">
                  {item.text}
                </span>
              </li>
            );
          })}
        </ul>

        {/* CTA */}
        <button
          onClick={dismiss}
          className="mt-5 w-full rounded-[12px] bg-brand py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}
