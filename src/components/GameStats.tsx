"use client";

import type { GameStatsBar, GameStatsPanel } from "@/lib/analytics/game-stats";
import type { DailyGameStanding } from "@/lib/types";
import { GAME_ICON } from "@/lib/game-icons";
import { GameIcon } from "./ui";

const CONNECTION_COLOURS: Record<string, string> = {
  "🟨": "#F9DF6D",
  "🟩": "#A0C35A",
  "🟦": "#B0C4EF",
  "🟪": "#BA81C5",
};

/** Columns: the best outcome (first bar) in the game's colour, a fail bar in orange, the rest quiet. */
export function Distribution({
  bars,
  accent,
  height = 150,
  compact = false,
}: {
  bars: GameStatsBar[];
  accent: string;
  height?: number;
  compact?: boolean;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const peak = bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0);
  return (
    <div className="flex items-end gap-1.5 md:gap-2" style={{ height }}>
      {bars.map((b, i) => {
        const fail = /^(fail|x)$/i.test(b.label);
        const colour = b.color ?? (fail ? "#FF5A1F" : i === (compact ? peak : 0) ? accent : "#2A2A27");
        return (
          <div key={b.label} className="flex-1 flex flex-col gap-1.5 h-full min-w-0">
            <div className={`flex-1 flex flex-col justify-end ${compact ? "" : "pt-5"}`}>
              {!compact && (
                <span className="text-[11px] text-muted tabular-nums mb-1">{b.value || ""}</span>
              )}
              <div
                style={{ height: `${Math.max(compact ? 6 : 3, (b.value / max) * 100)}%`, backgroundColor: colour }}
                className="chart-bar w-full rounded-[4px]"
              />
            </div>
            <span className={`text-[10px] md:text-[11px] font-semibold truncate ${compact ? "text-muted text-center" : "text-text"}`}>
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RowsChart({ bars }: { bars: GameStatsBar[] }) {
  const total = Math.max(1, bars.reduce((a, b) => a + b.value, 0));
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="space-y-3.5">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <span style={{ backgroundColor: b.color ?? "#E6EB5E" }} className="w-3 h-3 rounded-[3px] shrink-0" />
          <span className="w-16 text-[14px]">{b.label}</span>
          <div className="flex-1 h-6 md:h-7 rounded-[6px] bg-surface2 overflow-hidden">
            <div
              style={{ width: `${(b.value / max) * 100}%`, backgroundColor: b.color ?? "#E6EB5E" }}
              className="h-full rounded-[6px] grow-in"
            />
          </div>
          <span className="w-12 text-right font-serif text-[24px] md:text-[28px] leading-none">
            {Math.round((b.value / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-[22px] p-5 md:p-6 space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[18px] md:text-[19px] font-bold">{title}</h3>
        {note && <span className="text-[12px] text-muted text-right">{note}</span>}
      </div>
      {children}
    </div>
  );
}

/** Rebuilt share grids for today's results (Connections, Wordle, Strands). */
function TodaysGrids({ slug, today }: { slug: string; today: DailyGameStanding }) {
  const rows = today.rankings
    .map((r) => {
      const lines = r.rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^[🟨🟩🟦🟪⬛⬜🟡🔵💡]+$/u.test(l));
      return { r, lines };
    })
    .filter((x) => x.lines.length);
  if (!rows.length) return null;
  const tile = (c: string) => {
    if (slug === "connections") return CONNECTION_COLOURS[c] ?? "#3A3935";
    if (c === "🟩") return "#8FD14F";
    if (c === "🟨" || c === "🟡") return slug === "strands" ? "#F5D547" : "#E6EB5E";
    if (c === "🔵") return "#6FA8DC";
    if (c === "💡") return "#948F84";
    return "#3A3935";
  };
  return (
    <Panel title="Today's grids" note="Rebuilt from the pasted share codes">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
        {rows.map(({ r, lines }) => (
          <div key={r.id} className="space-y-2">
            <div className="flex flex-col gap-[3px]">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-[3px]">
                  {Array.from(l).map((c, j) => (
                    <span
                      key={j}
                      style={{ backgroundColor: tile(c) }}
                      className={`flex-1 max-w-[24px] h-[16px] ${slug === "strands" ? "rounded-full max-w-[16px]" : "rounded-[3px]"}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div>
              <div className="text-[14px] font-semibold">{r.playerName}</div>
              <div className={`text-[12px] ${r.placement === 1 ? "text-lime" : "text-muted"}`}>{r.displayResult}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function GameStatsView({
  slug,
  stats,
  today,
}: {
  slug: string;
  stats: GameStatsPanel;
  today?: DailyGameStanding;
}) {
  const accent = GAME_ICON[slug]?.from ?? "#E6EB5E";
  const grids = today && ["connections", "wordle", "strands"].includes(slug) ? <TodaysGrids slug={slug} today={today} /> : null;
  const panels = stats.distributions.map((d) => (
    <Panel key={d.title} title={d.title} note={d.note ?? `${stats.results} results`}>
      {d.kind === "rows" ? <RowsChart bars={d.bars} /> : <Distribution bars={d.bars} accent={accent} height={160} />}
    </Panel>
  ));
  const records = stats.tiles.length ? (
    <Panel title="Records" note="This range">
      <div className="divide-y divide-line/70">
        {stats.tiles.map((t) => (
          <div key={t.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">{t.label}</div>
              {t.sub && <div className="text-[12px] text-muted">{t.sub}</div>}
            </div>
            <div className="font-serif text-[30px] md:text-[34px] leading-none whitespace-nowrap">{t.value}</div>
          </div>
        ))}
      </div>
    </Panel>
  ) : null;
  const items = [...panels, grids, records].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 items-start">
      {items.map((el, i) => (
        <div key={i} className="min-w-0">
          {el}
        </div>
      ))}
    </div>
  );
}

/** Players page: one card per game with the player's average, wins and distribution. */
export function PlayerGameGrid({
  strengths,
  gameStats,
  playerName,
  accent,
}: {
  strengths: Array<{ gameSlug: string; gameName: string; played: number; firstPlaces: number; averagePlacement: number | null; bestResult: string }>;
  gameStats: Record<string, GameStatsPanel>;
  playerName: string;
  accent: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] md:text-[24px] font-bold tracking-tight">Game by game</h2>
        <span className="hidden md:inline text-[13px] text-muted">
          {playerName}&apos;s numbers in each game, read from the share codes
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {strengths.map((g) => {
          const st = gameStats[g.gameSlug];
          const main = st?.kpis[0];
          const dist = st?.distributions[0];
          const showDist = dist && dist.kind !== "rows" && dist.bars.length <= 8 && st.results > 0;
          const note = st?.tiles[0] ? `${st.tiles[0].label} · ${st.tiles[0].value}` : st?.kpis[1] ? `${st.kpis[1].label} ${st.kpis[1].value}` : "";
          const played = g.played > 0;
          return (
            <div
              key={g.gameSlug}
              className={`stat-tile bg-surface rounded-[18px] p-4 md:p-5 ${played ? "" : "opacity-50"}`}
            >
              <div className="flex items-center gap-2.5">
                <GameIcon slug={g.gameSlug} size={26} />
                <span className="text-[14px] font-semibold truncate flex-1">{g.gameName}</span>
                <span
                  style={g.firstPlaces > 0 ? { backgroundColor: accent } : undefined}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    g.firstPlaces > 0 ? "text-[#121212]" : "bg-surface2 text-muted"
                  }`}
                >
                  {g.firstPlaces}× 1st
                </span>
              </div>
              {/* Phone: one line with the average on the right */}
              <div className="md:hidden flex items-baseline justify-between mt-2">
                <span className="text-[12px] text-muted">{main?.label ?? ""}</span>
                <span className="font-serif text-[30px] leading-none">{played ? main?.value ?? "–" : "–"}</span>
              </div>
              <div className="hidden md:block">
                <div className="flex items-baseline gap-2.5 mt-3">
                  <span className="stat-num font-serif text-[40px] leading-none">{played ? main?.value ?? "–" : "–"}</span>
                  <span className="text-[12px] text-muted">{main?.label ?? ""}</span>
                </div>
                {showDist && (
                  <div className="mt-3">
                    <Distribution bars={dist!.bars} accent={accent} height={44} compact />
                  </div>
                )}
                <div className="text-[12px] text-muted mt-3">{played ? note : "Not played in this range"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
