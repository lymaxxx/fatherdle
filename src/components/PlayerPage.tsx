"use client";

import type { DailyPointsSeriesPoint, PlayerGameStrengthRow, PlayerRecordItem } from "@/lib/analytics/engine";
import type { LeaguesPayload } from "@/lib/analytics/feed";
import type { DatePeriod, Player, PlayerStandingRow } from "@/lib/types";
import { Share2 } from "lucide-react";
import { CountUp, GameIcon } from "./ui";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function isoWeek(d: string): number {
  const dt = new Date(`${d}T12:00:00Z`);
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((dt.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function addDays(d: string, n: number): string {
  const dt = new Date(`${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Readable text on a player's colour: dark on light colours, light on dark ones. */
function inkFor(hex: string): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 120 ? "#121212" : "#F4F1EA";
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

export function PlayerHero({
  player,
  row,
  period,
  series,
  strengths,
  extra,
  todayDate,
  dailySubCounts,
  periodControl,
  onShare,
}: {
  player: Player;
  row: PlayerStandingRow;
  period: DatePeriod;
  series: DailyPointsSeriesPoint[];
  strengths: PlayerGameStrengthRow[];
  extra: { streak: number; submittedRate: number | null; weeksIn: number };
  todayDate: string;
  dailySubCounts: Record<string, number>;
  periodControl: React.ReactNode;
  onShare: () => void;
}) {
  const ink = inkFor(player.color);
  // Bars: one per day for short ranges, one per league week for long ones
  let bars: Array<{ label: string; value: number }> = series.map((p) => ({
    label: new Date(`${p.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    value: p.dailyByPlayer[player.id] ?? 0,
  }));
  if (series.length > 14) {
    const byWeek = new Map<number, number>();
    for (const p of series) {
      const w = isoWeek(p.date);
      byWeek.set(w, (byWeek.get(w) || 0) + (p.dailyByPlayer[player.id] ?? 0));
    }
    bars = [...byWeek.entries()].slice(-10).map(([w, v]) => ({ label: `w${w}`, value: v }));
  }
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  const periodWord =
    period.preset === "today" ? "today" : period.preset === "week" ? "this week" : period.preset === "month" ? "this month" : period.preset === "all" ? "all time" : period.label;
  const best = [...strengths].filter((s) => s.totalPoints > 0).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3);
  const strongest = [...strengths]
    .filter((s) => s.played > 0)
    .sort((a, b) => b.firstPlaces - a.firstPlaces || (a.averagePlacement ?? 9) - (b.averagePlacement ?? 9))[0];
  const change = row.positionChange;
  const last10 = Array.from({ length: 10 }, (_, i) => addDays(todayDate, i - 9));
  const joined = new Date(`${player.joinedAt}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 md:gap-5">
      {/* Player card */}
      <div style={{ backgroundColor: player.color, color: ink }} className="rounded-[24px] p-5 md:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[44px] md:text-[48px] font-bold tracking-[-1.5px] leading-none truncate">{player.name}</h1>
            <div className="text-[13px] opacity-70 mt-1.5">
              Joined {joined} · {extra.weeksIn} {extra.weeksIn === 1 ? "week" : "weeks"} in
            </div>
          </div>
          <button
            type="button"
            onClick={onShare}
            aria-label="Share these stats"
            style={{ backgroundColor: ink === "#121212" ? "rgba(18,18,18,0.12)" : "rgba(255,255,255,0.15)" }}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
        <div>{periodControl}</div>
        <div className="flex items-end gap-1.5 md:gap-2.5 h-[120px] md:h-[136px]">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1.5 h-full min-w-0">
              <div className="flex-1 flex flex-col justify-end">
                <span className="text-[11px] md:text-[12px] font-bold text-center mb-1">{b.value || ""}</span>
                <div
                  style={{ height: `${Math.max(3, (b.value / maxBar) * 100)}%`, backgroundColor: ink === "#121212" ? "#121212" : "#F4F1EA" }}
                  className="chart-bar w-full rounded-[5px]"
                />
              </div>
              <span className="text-[10px] md:text-[11px] font-semibold text-center opacity-70 truncate">
                <span className="md:hidden">{b.label.startsWith("w") ? b.label : b.label[0]}</span>
                <span className="hidden md:inline">{b.label}</span>
              </span>
            </div>
          ))}
          {bars.length === 0 && <span className="text-[13px] opacity-70">No results in this range yet</span>}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="font-serif text-[64px] md:text-[72px] leading-[0.9]">
              <CountUp value={row.totalPoints} />
            </div>
            <div className="text-[13px] opacity-75">points {periodWord}</div>
          </div>
          <div className="hidden md:flex gap-1.5">
            {best.map((g) => (
              <GameIcon key={g.gameSlug} slug={g.gameSlug} size={34} />
            ))}
          </div>
        </div>
      </div>

      {/* Four stat blocks */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 content-start">
        <div className="stat-tile col-span-1 md:col-span-2 bg-surface rounded-[20px] p-4 md:p-5 flex flex-col min-h-[124px] md:min-h-[150px]">
          <div className="text-[13px] text-muted">League position</div>
          <div className="flex items-end justify-between gap-2 mt-auto flex-wrap">
            <span className="stat-num font-serif text-[52px] md:text-[64px] leading-none">{row.gamesPlayed > 0 ? ordinal(row.rank) : "–"}</span>
            {change !== null && change !== 0 && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${change > 0 ? "bg-lime text-[#121212]" : "bg-orange text-[#121212]"}`}>
                {change > 0 ? "▲" : "▼"} {Math.abs(change)} from last {period.preset === "week" ? "week" : "period"}
              </span>
            )}
          </div>
        </div>
        <div className="stat-tile md:hidden bg-lime text-[#121212] rounded-[20px] p-4 flex flex-col min-h-[124px]">
          <div className="text-[13px] opacity-70">Current streak</div>
          <div className="stat-num font-serif text-[36px] leading-none mt-auto">
            {extra.streak} {extra.streak === 1 ? "day" : "days"}
          </div>
          <div className="text-[12px] opacity-70 mt-1">
            {extra.submittedRate === null ? "" : `${Math.round(extra.submittedRate * 100)}% submitted`}
          </div>
        </div>
        <div className="stat-tile col-span-2 md:col-span-1 bg-surface rounded-[20px] p-4 md:p-5 flex flex-col md:min-h-[150px]">
          <div className="text-[13px] text-muted hidden md:block">Strongest game</div>
          {strongest ? (
            <div className="flex items-center gap-3 md:mt-auto">
              <GameIcon slug={strongest.gameSlug} size={44} />
              <div className="min-w-0">
                <div className="md:hidden text-[12px] text-muted">Strongest game</div>
                <div className="text-[17px] md:text-[18px] font-bold truncate">{strongest.gameName}</div>
                <div className="text-[12px] text-muted">
                  1st in {strongest.firstPlaces} of {strongest.played} {strongest.played === 1 ? "day" : "days"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[14px] text-muted md:mt-auto">No games yet</div>
          )}
        </div>
        <div className="stat-tile hidden md:flex bg-surface rounded-[20px] p-5 flex-col min-h-[150px]">
          <div className="text-[13px] text-muted">Submitted</div>
          <div className="mt-auto">
            <div className="stat-num font-serif text-[48px] leading-none">
              {extra.submittedRate === null ? "–" : `${Math.round(extra.submittedRate * 100)}%`}
            </div>
            <div className="text-[12px] text-muted mt-1">of games you could have played</div>
          </div>
        </div>
        <div className="stat-tile hidden md:flex col-span-2 bg-lime text-[#121212] rounded-[20px] p-5 items-end justify-between min-h-[120px]">
          <div>
            <div className="text-[13px] opacity-70">Current streak</div>
            <div className="stat-num font-serif text-[44px] leading-none mt-1">
              {extra.streak} {extra.streak === 1 ? "day" : "days"}
            </div>
          </div>
          <div className="flex gap-1.5 pb-1.5">
            {last10.map((d) => (
              <span key={d} className={`w-3 h-3 rounded-full ${dailySubCounts[d] ? "bg-[#121212]" : "bg-[#121212]/20"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerGeneral({
  player,
  leagues,
  records,
  dailySubCounts,
  todayDate,
}: {
  player: Player;
  leagues: LeaguesPayload;
  records: PlayerRecordItem[];
  dailySubCounts: Record<string, number>;
  todayDate: string;
}) {
  const weeks = [...leagues.previous].reverse().concat(leagues.current).slice(-9);
  const weekly = weeks.map((w) => {
    const r = w.standings.find((x) => x.playerId === player.id);
    return { label: `w${isoWeek(w.startDate)}`, value: r?.points ?? 0, rank: r && r.played ? r.rank : null, current: w === leagues.current };
  });
  const maxWeek = Math.max(1, ...weekly.map((w) => w.value));
  const allWeeks = [...leagues.previous].filter((w) => w.final);
  const nPlayers = Math.max(1, leagues.current.standings.length);
  const finishCounts = Array.from({ length: nPlayers }, (_, i) =>
    allWeeks.filter((w) => w.standings.find((x) => x.playerId === player.id && x.played)?.rank === i + 1).length
  );
  const maxFinish = Math.max(1, ...finishCounts);
  const peakFinish = finishCounts.indexOf(Math.max(...finishCounts));

  // Activity: every day since the player joined (up to 26 weeks), weeks as columns
  const start = (() => {
    const first = Object.keys(dailySubCounts).sort()[0] ?? player.joinedAt ?? todayDate;
    const limit = addDays(todayDate, -26 * 7 + 1);
    const s = first > limit ? first : limit;
    const dt = new Date(`${s}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); // back to Monday
    return dt.toISOString().slice(0, 10);
  })();
  const cols: string[][] = [];
  for (let d = start; d <= todayDate; d = addDays(d, 7)) cols.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  const maxCount = Math.max(1, ...Object.values(dailySubCounts));
  const since = new Date(`${start}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] md:text-[24px] font-bold tracking-tight">General</h2>
        <span className="hidden md:inline text-[13px] text-muted">Everything across the games</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 md:gap-5">
        <Panel title="Points over time" note={`Last ${weekly.length} league ${weekly.length === 1 ? "week" : "weeks"}`}>
          <div className="flex items-end gap-2 h-[150px] md:h-[170px]">
            {weekly.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col gap-1.5 h-full min-w-0">
                <div className="flex-1 flex flex-col justify-end">
                  <span
                    style={w.current ? { color: player.color } : undefined}
                    className={`hidden md:block text-[12px] font-bold text-center mb-1 ${w.current ? "" : "text-muted"}`}
                  >
                    {w.value}
                  </span>
                  <div
                    style={{ height: `${Math.max(3, (w.value / maxWeek) * 100)}%`, backgroundColor: w.current ? player.color : "#2A2A27" }}
                    className="chart-bar w-full rounded-[6px]"
                  />
                </div>
                <span className="text-[10px] md:text-[11px] text-muted text-center">
                  <span className="md:hidden">{w.value}</span>
                  <span className="hidden md:inline">{w.label}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="hidden md:block">
          <Panel title="League position" note="Finish each week">
            <div className="space-y-2.5">
              {finishCounts.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-8 text-[13px] text-muted">{ordinal(i + 1)}</span>
                  <div className="flex-1 h-5 rounded-[5px] bg-surface2 overflow-hidden">
                    <div
                      style={{ width: `${c ? Math.max(8, (c / maxFinish) * 100) : 0}%`, backgroundColor: i === peakFinish && c ? player.color : "#5d5a52" }}
                      className="h-full rounded-[5px] grow-in"
                    />
                  </div>
                  <span className="w-5 text-right text-[13px] font-bold tabular-nums">{c}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 md:gap-5">
        <div className="hidden md:block">
          <Panel title="Activity" note={`Every day since ${since}`}>
            <div className="flex gap-2">
              <div className="flex flex-col gap-[4px] text-[10px] text-muted pt-[1px]">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} className="h-[16px] leading-[16px]">
                    {d}
                  </span>
                ))}
              </div>
              <div className="flex-1 flex gap-[4px] overflow-hidden">
                {cols.map((col, ci) => (
                  <div key={ci} className="flex flex-col gap-[4px] flex-1 max-w-[18px]">
                    {col.map((d) => {
                      const c = dailySubCounts[d] || 0;
                      const future = d > todayDate;
                      return (
                        <span
                          key={d}
                          title={`${d}: ${c} results`}
                          style={c ? { backgroundColor: player.color, opacity: 0.3 + 0.7 * (c / maxCount) } : undefined}
                          className={`h-[16px] rounded-[3px] ${c ? "" : future ? "bg-transparent" : "bg-surface2"}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
        <Panel title="Records" note="All time">
          <div className="divide-y divide-line/70">
            {records.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{r.label}</div>
                  <div className="text-[12px] text-muted truncate">{r.sublabel}</div>
                </div>
                <div className="font-serif text-[30px] leading-none whitespace-nowrap">{r.value}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
