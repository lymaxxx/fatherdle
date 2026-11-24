"use client";

import type { GameStatsPanel } from "@/lib/analytics/game-stats";
import { GAME_ICON } from "@/lib/game-icons";
import { GameIcon } from "./ui";

export function Distribution({ bars, color, height = 120 }: { bars: Array<{ label: string; value: number }>; color: string; height?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {bars.map((b) => (
        <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
          <span className="text-[11px] text-muted tabular-nums">{b.value || ""}</span>
          <div
            style={{ height: `${Math.max(3, (b.value / max) * 100)}%`, backgroundColor: b.value ? color : "#2A2A27" }}
            className="chart-bar w-full rounded-t-[6px]"
          />
          <span className="text-[10px] text-muted truncate max-w-full">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export function GameStatsView({ slug, stats }: { slug: string; stats: GameStatsPanel }) {
  const color = GAME_ICON[slug]?.from ?? "#E6EB5E";
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.kpis.map((k) => (
          <div key={k.label} className="stat-tile bg-surface rounded-[18px] p-5">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">{k.label}</div>
            <div className="stat-num font-serif text-[48px] leading-none mt-3">{k.value}</div>
            {k.sub && <div className="text-[12px] text-muted mt-1">{k.sub}</div>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats.distributions.map((d) => (
          <div key={d.title} className="bg-surface rounded-[22px] p-6 space-y-3">
            <h3 className="text-[16px] font-bold">{d.title}</h3>
            <Distribution bars={d.bars} color={color} height={150} />
          </div>
        ))}
        {stats.tiles.length > 0 && (
          <div className="grid grid-cols-2 gap-4 content-start">
            {stats.tiles.map((t) => (
              <div key={t.label} className="stat-tile bg-surface rounded-[18px] p-5">
                <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">{t.label}</div>
                <div className="stat-num font-serif text-[40px] leading-none mt-3">{t.value}</div>
                {t.sub && <div className="text-[12px] text-muted mt-1.5">{t.sub}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlayerGameGrid({
  strengths,
  gameStats,
}: {
  strengths: Array<{ gameSlug: string; gameName: string; played: number; firstPlaces: number; averagePlacement: number | null; bestResult: string }>;
  gameStats: Record<string, GameStatsPanel>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-[24px] font-bold tracking-tight">Game by game</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {strengths.map((g) => {
          const st = gameStats[g.gameSlug];
          const dist = st?.distributions[0];
          const played = g.played > 0;
          return (
            <div key={g.gameSlug} className={`game-tile bg-surface rounded-[20px] p-5 space-y-3 ${played ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-3">
                <GameIcon slug={g.gameSlug} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold truncate">{g.gameName}</div>
                  <div className="text-[12px] text-muted">{played ? `${g.played} played` : "Not played"}</div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-[32px] leading-none">
                    {g.averagePlacement ? g.averagePlacement.toFixed(1) : "–"}
                  </div>
                  <div className="text-[10px] uppercase tracking-[1.2px] text-muted">avg place</div>
                </div>
              </div>
              {played && dist && <Distribution bars={dist.bars} color={GAME_ICON[g.gameSlug]?.from ?? "#E6EB5E"} height={64} />}
              <div className="text-[12px] text-muted">
                {played ? `First place ${g.firstPlaces}×${g.bestResult ? ` · best ${g.bestResult}` : ""}` : "Nothing in this range yet"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
