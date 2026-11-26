"use client";

import type { GameStatsBar, GameStatsPanel } from "@/lib/analytics/game-stats";
import type { DailyGameStanding } from "@/lib/types";
import { GAME_ICON } from "@/lib/game-icons";
import { ColumnChart, GameIcon } from "./ui";

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
  // Highlight the most common outcome (never the fail bar, which has its own colour)
  const peak = bars.reduce(
    (best, b, i) => (!/^(fail|x)$/i.test(b.label) && b.value > (bars[best]?.value ?? -1) ? i : best),
    0
  );
  return (
    <ColumnChart
      height={height}
      showValues={!compact}
      gap={compact ? 4 : 8}
      radius={4}
      minBar={compact ? 4 : 3}
      labelClass={compact ? "text-[10px] text-muted" : "text-[11px] font-semibold text-text"}
      bars={bars.map((b, i) => {
        const fail = /^(fail|x)$/i.test(b.label);
        return {
          label: b.label,
          value: b.value,
          color: b.color ?? (fail && b.value ? "#FF5A1F" : (i === peak || compact) && b.value ? accent : "#2A2A27"),
        };
      })}
    />
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
  const cx = stats.connections;
  const COLS: Record<string, string> = { P: "#BA81C5", B: "#B0C4EF", G: "#A0C35A", Y: "#F9DF6D" };
  const solveOrder = cx && cx.solveOrder.length ? (
    <Panel title="Solve order · Purple-first club" note="Reverse rainbow & 1st-group hits">
      <div className="space-y-3">
        {cx.solveOrder.map((r) => (
          <div key={r.name} className="flex items-center gap-3 text-[13px]">
            <span className="w-14 font-semibold truncate">{r.name}</span>
            <span className="flex gap-1">
              {r.order.map((c, i) => (
                <span key={i} style={{ backgroundColor: COLS[c] }} className="w-3.5 h-3.5 rounded-full" />
              ))}
            </span>
            <span style={{ color: COLS.P }} className="font-semibold whitespace-nowrap">{r.purpleFirst}× purple 1st</span>
            <span className="ml-auto text-muted text-[12px] whitespace-nowrap hidden sm:inline">
              {r.reverse} reverse {r.reverse === 1 ? "rainbow" : "rainbows"}
            </span>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-muted">Typical order shown per player</div>
    </Panel>
  ) : null;
  const mistakesPanel = cx && cx.mistakes.length ? (
    <Panel title="Player avg mistakes & fails" note="Lower is better · 0–4 scale">
      <div className="space-y-3">
        {cx.mistakes.map((r) => (
          <div key={r.name} className="flex items-center gap-3 text-[13px]">
            <span className="w-14 font-semibold truncate">{r.name}</span>
            <div className="flex-1 h-2.5 rounded-full bg-surface2 overflow-hidden">
              <div style={{ width: `${Math.max(3, Math.min(100, (r.avg / 4) * 100))}%`, backgroundColor: r.color }} className="h-full rounded-full grow-in" />
            </div>
            <span className="w-8 text-right font-bold tabular-nums">{r.avg.toFixed(1)}</span>
            <span className="w-14 text-right text-[12px] text-muted">{r.failPct}% fail</span>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-muted">Group averages {cx.groupAvg.toFixed(1)} mistakes · {cx.zeroPct}% zero-mistake solves</div>
    </Panel>
  ) : null;
  const items = [...panels, grids, records, solveOrder, mistakesPanel].filter(Boolean);
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

const CURVE_GAMES = new Set([
  "maptap", "krillion", "noillirk", "huedle", "wordishingrilliontapdle",
  "geoguessr", "flagcognito", "flagments", "whenography",
]);
const ATTEMPT_GAMES = new Set(["wordle", "flagle", "metrodle"]);

function fmtNum(n: number): string {
  if (n >= 10000) return `${Math.round(n / 100) / 10}k`;
  return Math.round(n).toLocaleString("en-GB");
}

/** Smooth density curve of a player's scores: range labels, a faint peak guide and a dot on the peak. */
export function DensityCurve({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <div className="h-[56px] flex items-end text-[11px] text-muted">Needs a few more results</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || span / 4;
  const bw = Math.max(span / 18, 1.06 * sd * Math.pow(values.length, -0.2));
  const lo = min - bw * 1.5;
  const hi = max + bw * 1.5;
  const N = 48;
  const pts: Array<[number, number]> = [];
  let peak = 0;
  let peakAt = 0;
  for (let i = 0; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    let d = 0;
    for (const v of values) d += Math.exp(-0.5 * ((x - v) / bw) ** 2);
    pts.push([x, d]);
    if (d > peak) {
      peak = d;
      peakAt = x;
    }
  }
  const W = 200;
  const H = 44;
  const X = (x: number) => ((x - lo) / (hi - lo)) * W;
  const Y = (d: number) => H - 3 - (d / (peak || 1)) * (H - 10);
  const path = pts.map(([x, d], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(d).toFixed(1)}`).join(" ");
  const px = X(peakAt);
  const gid = `g${Math.abs(Math.round(peakAt * 7 + values.length))}${color.replace("#", "")}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[48px]" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L${W},${H} L0,${H} Z`} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="draw-line" />
        <line x1={px} x2={px} y1={Y(peak)} y2={H} stroke={color} strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" className="fade-in-late" />
      </svg>
      <div className="relative -mt-[27px] h-[6px] pointer-events-none">
        <span style={{ left: `${(px / W) * 100}%`, backgroundColor: color }} className="absolute -top-[14px] w-[7px] h-[7px] rounded-full -translate-x-1/2 fade-in-late" />
      </div>
      <div className="mt-[22px] flex items-center justify-between text-[10px] text-muted tabular-nums">
        <span>{fmtNum(min)}</span>
        <span style={{ color }} className="font-semibold">peak ~{fmtNum(peakAt)}</span>
        <span>{fmtNum(max)}</span>
      </div>
    </div>
  );
}

/** Catfishing: ten slots filled to the player's average. */
function TenSlots({ avg, color }: { avg: number; color: string }) {
  return (
    <div>
      <div className="flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => {
          const fill = Math.max(0, Math.min(1, avg - i));
          return (
            <span key={i} className="flex-1 h-[10px] rounded-[3px] bg-surface2 overflow-hidden">
              <span style={{ width: `${fill * 100}%`, backgroundColor: color }} className="block h-full" />
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>0/10</span>
        <span style={{ color }} className="font-semibold">avg {avg.toFixed(1)}</span>
        <span>10/10</span>
      </div>
    </div>
  );
}

/** Poople: a rank ladder #1..#5+ with the most common rank lit. */
function RankLadder({ values, color }: { values: number[]; color: string }) {
  const counts = [1, 2, 3, 4, 5].map((r) => values.filter((v) => (r === 5 ? v >= 5 : Math.round(v) === r)).length);
  const top = counts.indexOf(Math.max(...counts));
  return (
    <div>
      <div className="flex gap-1.5">
        {counts.map((c, i) => (
          <span
            key={i}
            style={i === top && c > 0 ? { backgroundColor: color, color: "#121212" } : undefined}
            className={`flex-1 text-center rounded-[6px] py-1 text-[11px] font-semibold ${i === top && c > 0 ? "" : "bg-surface2 text-muted"}`}
          >
            #{i + 1}{i === 4 ? "+" : ""}
          </span>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-muted">Rank 1–5+ · mostly #{top + 1}</div>
    </div>
  );
}

/** Connections: one segmented bar, 0 / 1 / 2 / 3 mistakes then fails. */
function MistakeBar({ bars }: { bars: GameStatsBar[] }) {
  const total = Math.max(1, bars.reduce((a, b) => a + b.value, 0));
  const colours = ["#BA81C5", "#B0C4EF", "#A0C35A", "#F9DF6D", "#FF5A1F"];
  return (
    <div>
      <div className="flex h-[8px] gap-[3px]">
        {bars.map((b, i) =>
          b.value ? <span key={b.label} style={{ flex: b.value / total, backgroundColor: colours[i] }} className="rounded-full" /> : null
        )}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span style={{ color: colours[0] }} className="font-semibold">0 mistakes {Math.round(((bars[0]?.value ?? 0) / total) * 100)}%</span>
        <span>Fail {Math.round(((bars[bars.length - 1]?.value ?? 0) / total) * 100)}%</span>
      </div>
    </div>
  );
}

/** Strands: hint-bucket pills with the most common lit. */
function HintPills({ bars, color }: { bars: GameStatsBar[]; color: string }) {
  const b = [bars[0]?.value ?? 0, bars[1]?.value ?? 0, bars[2]?.value ?? 0, (bars[3]?.value ?? 0) + (bars[4]?.value ?? 0)];
  const top = b.indexOf(Math.max(...b));
  const total = Math.max(1, b.reduce((a, c) => a + c, 0));
  const lab = ["0 hints", "1", "2", "3+"];
  return (
    <div className="flex gap-1.5">
      {b.map((c, i) => (
        <span
          key={i}
          style={i === top && c > 0 ? { backgroundColor: color, color: "#121212" } : undefined}
          className={`flex-1 text-center rounded-[6px] py-1 text-[10px] font-semibold whitespace-nowrap ${i === top && c > 0 ? "" : "bg-surface2 text-muted"}`}
        >
          {lab[i]} · {Math.round((c / total) * 100)}%
        </span>
      ))}
    </div>
  );
}

function GameVisual({ slug, st, accent }: { slug: string; st: GameStatsPanel; accent: string }) {
  const dist = st.distributions[0];
  if (ATTEMPT_GAMES.has(slug) && dist) {
    return <Distribution bars={dist.bars.filter((b) => !/fail/i.test(b.label)).slice(0, 6)} accent={accent} height={56} compact />;
  }
  if (CURVE_GAMES.has(slug)) return <DensityCurve values={st.values} color={accent} />;
  if (slug === "catfishing") {
    const avg = st.values.length ? st.values.reduce((a, b) => a + b, 0) / st.values.length : 0;
    return <TenSlots avg={avg} color={accent} />;
  }
  if (slug === "poople") return <RankLadder values={st.values} color={accent} />;
  if (slug === "connections" && dist) return <MistakeBar bars={dist.bars} />;
  if (slug === "strands" && dist) return <HintPills bars={dist.bars} color={accent} />;
  return null;
}

/** Players page: one card per game, drawn for that game's own mechanics. */
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
        {[...strengths]
          .sort((a, b) => Object.keys(GAME_ICON).indexOf(a.gameSlug) - Object.keys(GAME_ICON).indexOf(b.gameSlug))
          .map((g) => {
            const st = gameStats[g.gameSlug];
            const main = st?.kpis[0];
            const played = g.played > 0;
            const gcol = GAME_ICON[g.gameSlug]?.to ?? accent;
            const color = g.gameSlug === "wordle" || g.gameSlug === "flagle" || g.gameSlug === "metrodle" ? accent : gcol;
            const note = st?.tiles[0] ? `${st.tiles[0].label} · ${st.tiles[0].value}` : st?.kpis[1] ? `${st.kpis[1].label} ${st.kpis[1].value}` : "";
            return (
              <div key={g.gameSlug} className={`bg-surface rounded-[18px] p-4 md:p-5 ${played ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-2.5">
                  <GameIcon slug={g.gameSlug} size={28} />
                  <span className="text-[14px] font-semibold truncate flex-1">{g.gameName}</span>
                  <span
                    style={g.firstPlaces > 0 ? { backgroundColor: accent, color: "#121212" } : undefined}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${g.firstPlaces > 0 ? "" : "bg-surface2 text-muted"}`}
                  >
                    {g.firstPlaces}× 1st
                  </span>
                </div>
                <div className="flex items-baseline gap-2.5 mt-3">
                  <span className="font-serif text-[40px] leading-none">{played ? main?.value ?? "–" : "–"}</span>
                  <span className="text-[12px] text-muted">{main?.label ?? ""}</span>
                </div>
                <div className="mt-3 min-h-[64px]">
                  {played && st ? <GameVisual slug={g.gameSlug} st={st} accent={color} /> : null}
                </div>
                <div className="text-[12px] text-muted mt-3">{played ? note : "Not played in this range"}</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
