"use client";

import React, { useEffect, useRef, useState } from "react";
import type { GameSlug } from "@/lib/types";

import { GAME_ICON, gameGradient, gameHalo } from "@/lib/game-icons";
export { GAME_ICON, gameGradient, gameHalo };

export function GameIcon({ slug, size = 36, className = "" }: { slug: GameSlug | string; size?: number; className?: string }) {
  const g = GAME_ICON[slug] ?? { code: slug.slice(0, 2).toUpperCase(), from: "#E6EB5E", to: "#8A8C45" };
  const fs = g.sub ? size * 0.3 : g.code.length > 1 ? size * 0.38 : size * 0.5;
  return (
    <span
      className={`game-icon inline-flex shrink-0 items-center justify-center font-bold select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: gameHalo(slug, "circle"),
        color: g.fg ?? "#121212",
        fontSize: fs,
        lineHeight: 1,
        flexDirection: "column",
      }}
    >
      <span>{g.code}</span>
      {g.sub && <span>{g.sub}</span>}
    </span>
  );
}

/** Counts up from 0 to `value` in `ms` (respects reduced motion). */
export function CountUp({ value, ms = 600, decimals = 0 }: { value: number; ms?: number; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const from = first.current ? 0 : shown;
    first.current = false;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(from + (value - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms]);
  return <>{decimals ? shown.toFixed(decimals) : Math.round(shown)}</>;
}

export function Confetti({ colors = ["#E6EB5E", "#FF8A3D", "#F2A7C3", "#6FA8DC", "#5CC8B0"] }: { colors?: string[] }) {
  const bits = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {bits.map((i) => (
        <span
          key={i}
          className="confetti-bit"
          style={{
            left: `${(i * 97) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 9) * 90}ms`,
            borderRadius: i % 3 === 0 ? 99 : 2,
          }}
        />
      ))}
    </div>
  );
}

export interface ColumnBar {
  label: React.ReactNode;
  value: number;
  color: string;
  valueText?: React.ReactNode; // shown above the bar; defaults to the value (hidden when 0)
  valueClass?: string;
  title?: string;
}

/**
 * Column chart with pixel heights only (no percentage heights inside flex items), so bars sit
 * exactly on the baseline in every browser, Safari included.
 */
export function ColumnChart({
  bars,
  height,
  showValues = true,
  minBar = 4,
  gap = 8,
  radius = 6,
  labelClass = "text-[11px] text-muted",
}: {
  bars: ColumnBar[];
  height: number; // total height, labels included
  showValues?: boolean;
  minBar?: number;
  gap?: number;
  radius?: number;
  labelClass?: string;
}) {
  const valueH = showValues ? 18 : 0;
  const labelH = 18;
  const area = Math.max(10, height - valueH - labelH - 6);
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex" style={{ height, gap }}>
      {bars.map((b, i) => {
        const h = Math.max(minBar, Math.round((b.value / max) * area));
        return (
          <div key={i} className="flex-1 min-w-0 flex flex-col" title={b.title}>
            <div className="flex flex-col justify-end" style={{ height: valueH + area }}>
              {showValues && (
                <div
                  className={`text-center text-[11px] font-semibold tabular-nums leading-[18px] h-[18px] truncate ${b.valueClass ?? "text-muted"}`}
                >
                  {b.valueText ?? (b.value ? b.value.toLocaleString("en-GB") : "")}
                </div>
              )}
              <div className="chart-bar w-full shrink-0" style={{ height: h, backgroundColor: b.color, borderRadius: radius }} />
            </div>
            <div className={`mt-[6px] text-center truncate leading-[18px] h-[18px] ${labelClass}`}>{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}
