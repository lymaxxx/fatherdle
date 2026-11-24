"use client";

import { useEffect, useRef, useState } from "react";
import type { GameSlug } from "@/lib/types";

/** Gradient + short code per game (HANDOVER §3). */
export const GAME_ICON: Record<string, { code: string; sub?: string; from: string; to: string; fg?: string }> = {
  wordle: { code: "WD", from: "#E6EB5E", to: "#8FD14F" },
  maptap: { code: "MT", from: "#FF8A3D", to: "#FF5A1F" },
  krillion: { code: "K", from: "#F6F3EA", to: "#F2A7C3" },
  noillirk: { code: "N", from: "#C9CC6A", to: "#6B7036" },
  huedle: { code: "H", from: "#6FA8DC", to: "#B79CF5" },
  flagle: { code: "F", from: "#F2A7C3", to: "#FF5A1F" },
  catfishing: { code: "C", from: "#5CC8B0", to: "#6FA8DC" },
  poople: { code: "P", from: "#E3A77A", to: "#B8794F" },
  wordishingrilliontapdle: { code: "WD", sub: "GT", from: "#FFD93D", to: "#3FA34D" },
  metrodle: { code: "MR", from: "#4F8FE8", to: "#F2F6FF" },
  connections: { code: "C", from: "#E6EB5E", to: "#F2A7C3" },
  strands: { code: "S", from: "#5CC8B0", to: "#E6EB5E" },
  geoguessr: { code: "G", from: "#1E3A8A", to: "#DC2626", fg: "#FFFFFF" },
  flagcognito: { code: "FC", from: "#F2A7C3", to: "#6FA8DC" },
  flagments: { code: "FM", from: "#FF8A3D", to: "#E6EB5E" },
};

export function gameGradient(slug: string, angle = 90): string {
  const g = GAME_ICON[slug];
  return g ? `linear-gradient(${angle}deg, ${g.from}, ${g.to})` : "#2A2A27";
}

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
        background: `radial-gradient(circle at 20% 15%, ${g.from}, ${g.to})`,
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
