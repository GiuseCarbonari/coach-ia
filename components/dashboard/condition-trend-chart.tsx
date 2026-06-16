"use client";

import { useMemo, useState } from "react";

import type { WellnessDay } from "@/lib/intervals-client";

type Point = {
  label: string;
  ctl: number;
  atl: number;
  tsb: number;
};

function formatWeekLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

function toY(value: number, min: number, max: number) {
  if (max === min) return 72;
  return 124 - ((value - min) / (max - min)) * 98;
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;

  return points
    .map((point, index) => {
      if (index === 0) return `M${point.x},${point.y}`;
      const previous = points[index - 1];
      const next = points[index + 1] ?? point;
      const beforePrevious = points[index - 2] ?? previous;
      const cp1x = previous.x + (point.x - beforePrevious.x) / 6;
      const cp1y = previous.y + (point.y - beforePrevious.y) / 6;
      const cp2x = point.x - (next.x - previous.x) / 6;
      const cp2y = point.y - (next.y - previous.y) / 6;
      return `C${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`;
    })
    .join(" ");
}

export function ConditionTrendChart({ days }: { days: WellnessDay[] }) {
  const points = useMemo<Point[]>(() => {
    const usable = days
      .filter((day) => day.ctl != null && day.atl != null)
      .slice(-42);
    const buckets = usable.filter((_, index) => index % 7 === 0 || index === usable.length - 1);
    return buckets.slice(-6).map((day) => {
      const ctl = day.ctl ?? 0;
      const atl = day.atl ?? 0;
      return {
        label: formatWeekLabel(day.date),
        ctl,
        atl,
        tsb: ctl - atl,
      };
    });
  }, [days]);

  const [selected, setSelected] = useState(Math.max(0, points.length - 1));

  if (points.length < 2) {
    return null;
  }

  const values = points.flatMap((point) => [point.ctl, point.atl, point.tsb]);
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  const xs = points.map((_, index) => 20 + (index * 300) / (points.length - 1));
  const ctlPoints = points.map((point, index) => ({
    x: xs[index],
    y: toY(point.ctl, min, max),
  }));
  const atlPoints = points.map((point, index) => ({
    x: xs[index],
    y: toY(point.atl, min, max),
  }));
  const tsbPoints = points.map((point, index) => ({
    x: xs[index],
    y: toY(point.tsb, min, max),
  }));
  const selectedPoint = points[selected] ?? points.at(-1)!;
  const selectedX = xs[selected] ?? xs.at(-1)!;
  const selectedCtlY = ctlPoints[selected]?.y ?? ctlPoints.at(-1)!.y;
  const selectedAtlY = atlPoints[selected]?.y ?? atlPoints.at(-1)!.y;
  const selectedTsbY = tsbPoints[selected]?.y ?? tsbPoints.at(-1)!.y;

  return (
    <section className="aurora-glass rounded-[28px] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-data text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            Andamento · 6 wk
          </p>
          <h2 className="font-display mt-1 text-xl font-bold tracking-[-0.02em] text-foreground">
            Forma, fatica e freschezza
          </h2>
        </div>
        <span className="font-data hidden text-[10px] text-faint sm:inline">
          passa o tocca per esplorare
        </span>
      </div>

      <div className="relative">
        <div
          className="absolute top-0 z-10 -translate-x-1/2 rounded-[12px] border border-border bg-[#121a22]/95 px-3 py-2 shadow-xl backdrop-blur-xl"
          style={{ left: `${(selectedX / 340) * 100}%` }}
        >
          <p className="font-data text-[9px] uppercase tracking-[0.08em] text-muted">
            {selectedPoint.label}
          </p>
          <div className="font-data mt-1 flex gap-3 text-xs font-semibold">
            <span className="text-amber">F {Math.round(selectedPoint.ctl)}</span>
            <span className="text-telemetry-blue">
              A {Math.round(selectedPoint.atl)}
            </span>
            <span className="text-telemetry-gold">
              {selectedPoint.tsb > 0 ? "+" : ""}
              {Math.round(selectedPoint.tsb)}
            </span>
          </div>
        </div>

        <svg viewBox="0 0 340 150" className="mt-3 block w-full">
          <defs>
            <linearGradient id="auroraCtlArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.34" />
              <stop offset="55%" stopColor="#A78BFA" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 80, 120].map((y) => (
            <line
              key={y}
              x1="20"
              y1={y}
              x2="320"
              y2={y}
              stroke="rgba(255,255,255,.06)"
            />
          ))}
          <path
            d={`${smoothPath(ctlPoints)} L320,130 L20,130 Z`}
            fill="url(#auroraCtlArea)"
          />
          <path
            d={smoothPath(tsbPoints)}
            fill="none"
            stroke="#FFC24D"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
          <path
            d={smoothPath(atlPoints)}
            fill="none"
            stroke="#4FA3E0"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
          <path
            d={smoothPath(ctlPoints)}
            fill="none"
            stroke="#A78BFA"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.8"
          />
          <line
            x1={selectedX}
            y1="18"
            x2={selectedX}
            y2="130"
            stroke="rgba(255,255,255,.28)"
            strokeDasharray="3 3"
          />
          <circle cx={selectedX} cy={selectedCtlY} r="4.2" fill="#A78BFA" stroke="#0B0E13" strokeWidth="2" />
          <circle cx={selectedX} cy={selectedAtlY} r="4.2" fill="#4FA3E0" stroke="#0B0E13" strokeWidth="2" />
          <circle cx={selectedX} cy={selectedTsbY} r="4.2" fill="#FFC24D" stroke="#0B0E13" strokeWidth="2" />
          {points.map((point, index) => (
            <rect
              key={point.label}
              x={xs[index] - 26}
              y="14"
              width="52"
              height="116"
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setSelected(index)}
              onMouseEnter={() => setSelected(index)}
            />
          ))}
        </svg>
      </div>

      <div className="font-data mt-2 flex justify-between px-3 text-[9.5px] text-faint">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
      <div className="font-data mt-4 flex flex-wrap gap-4 text-[11px] font-medium text-secondary">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-4 rounded-full bg-amber" />
          Forma
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-4 rounded-full bg-telemetry-blue" />
          Fatica
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-4 rounded-full bg-telemetry-gold" />
          Freschezza
        </span>
      </div>
    </section>
  );
}
