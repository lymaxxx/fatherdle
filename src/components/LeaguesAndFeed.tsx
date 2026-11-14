"use client";

import React from "react";
import { ChevronRight, ClipboardPaste, Share2, X } from "lucide-react";
import { GAMES } from "@/lib/constants";
import type { FeedItem, FeedResultItem, LeagueWeek } from "@/lib/analytics/feed";
import type { GameSlug, PlayerStandingRow } from "@/lib/types";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const finishOf = (week: LeagueWeek, playerId: string) => {
  const row = week.standings.find((r) => r.playerId === playerId);
  return row && row.played ? row.rank : null;
};

// ---------------------------------------------------------------------------------------------
// Monday banner
// ---------------------------------------------------------------------------------------------

export function MondayBanner({
  week,
  currentUserId,
  onSeeResults,
  onShare,
  onDismiss,
}: {
  week: LeagueWeek;
  currentUserId: string;
  onSeeResults: () => void;
  onShare: () => void;
  onDismiss: () => void;
}) {
  const podium = week.standings.filter((r) => r.played).slice(0, 3);
  const winner = podium[0];
  if (!winner) return null;
  const mine = finishOf(week, currentUserId);
  const sentence = [
    `${winner.points} ${winner.points === 1 ? "point" : "points"}.`,
    podium[1]
      ? `${podium[1].name} finished 2nd on ${podium[1].points}${
          podium[2] ? `, ${podium[2].name} 3rd on ${podium[2].points}` : ""
        }.`
      : "",
    mine ? `You were ${ordinal(mine)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const places = ["1st", "2nd", "3rd"];

  return (
    <div className="relative bg-text text-[#121212] rounded-[24px] md:rounded-[28px] p-5 md:px-9 md:py-7">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute top-4 right-4 md:top-5 md:right-5 w-7 h-7 flex items-center justify-center"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="md:flex md:items-center md:justify-between md:gap-8">
        <div className="md:flex-1 md:min-w-0">
          <div className="text-[11px] md:text-[13px] font-bold tracking-[0.18em] uppercase">
            Last week&apos;s league · {week.label} · Final
          </div>
          <h2 className="text-[30px] md:text-[44px] lg:text-[52px] font-extrabold tracking-[-1.5px] md:tracking-[-2px] leading-[1.05] mt-2 md:mt-3">
            {winner.name} won last week
          </h2>
          <p className="hidden md:block text-[17px] opacity-80 mt-3">{sentence}</p>
        </div>

        <div className="flex gap-2.5 md:gap-3.5 mt-4 md:mt-0 md:mr-10">
          {podium.map((r, i) => (
            <div
              key={r.playerId}
              style={{ backgroundColor: r.color }}
              className="flex-1 md:flex-none md:w-[150px] lg:w-[170px] rounded-[16px] px-3.5 pt-2.5 pb-1.5 md:px-[18px] md:pt-[14px] md:pb-2"
            >
              <div className="text-[12px] md:text-[14px] font-extrabold truncate">
                {places[i]}
                <span className="md:hidden"> · {r.name}</span>
                <span className="hidden md:block text-[20px] md:text-[22px]">{r.name}</span>
              </div>
              <div className="font-serif text-[44px] md:text-[64px] leading-none">{r.points}</div>
            </div>
          ))}
        </div>

        <div className="flex md:flex-col gap-2.5 mt-4 md:mt-8">
          <button
            type="button"
            onClick={onSeeResults}
            className="flex-1 md:flex-none h-[52px] md:h-12 px-6 rounded-full bg-[#121212] text-text text-[15px] font-extrabold"
          >
            See full results
          </button>
          <button
            type="button"
            onClick={onShare}
            aria-label="Share"
            className="w-[52px] md:w-auto md:px-6 h-[52px] md:h-12 rounded-full border-[1.5px] border-[#121212] text-[14px] font-bold inline-flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden md:inline">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Previous leagues
// ---------------------------------------------------------------------------------------------

export function PreviousLeagues({
  weeks,
  currentUserId,
  onOpen,
  firstLeagueEnds,
}: {
  weeks: LeagueWeek[];
  currentUserId: string;
  onOpen: (week: LeagueWeek) => void;
  firstLeagueEnds: string;
}) {
  const mineByWeek = weeks.map((w) => ({ week: w, rank: finishOf(w, currentUserId) }));
  const played = mineByWeek.filter((m) => m.rank !== null) as Array<{ week: LeagueWeek; rank: number }>;
  const wins = played.filter((m) => m.rank === 1).length;
  const podiums = played.filter((m) => m.rank <= 3).length;
  const chronological = [...mineByWeek].reverse();

  if (weeks.length === 0) {
    return (
      <div className="bg-surface rounded-[22px] p-8 text-center space-y-1">
        <div className="text-[18px] font-extrabold">No finished leagues yet</div>
        <p className="text-[14px] text-muted">
          Leagues run Monday to Sunday. The first one ends on {firstLeagueEnds}.
        </p>
      </div>
    );
  }

  const record = (
    <div className="bg-surface rounded-[24px] p-6 space-y-6">
      <h3 className="text-[24px] md:text-[28px] font-extrabold tracking-[-0.5px]">Your record</h3>
      <div className="flex gap-10">
        <div>
          <div className="font-serif text-[64px] leading-none text-lime">{wins}</div>
          <div className="text-[13px] text-muted mt-1">league {wins === 1 ? "win" : "wins"}</div>
        </div>
        <div>
          <div className="font-serif text-[64px] leading-none">
            {podiums} of {played.length}
          </div>
          <div className="text-[13px] text-muted mt-1">podium finishes</div>
        </div>
      </div>
      <div className="hidden md:block space-y-3">
        <div className="text-[13px] font-bold text-muted">Finish by week</div>
        <div className="flex items-end gap-3 h-[190px]">
          {chronological.map(({ week, rank }) => {
            const n = Math.max(2, week.standings.filter((r) => r.played).length);
            const h = rank ? 30 + ((n - rank + 1) / n) * 120 : 14;
            return (
              <div key={week.startDate} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                <span className="text-[13px] font-bold">{rank ? ordinal(rank) : "–"}</span>
                <div
                  style={{ height: h }}
                  className={`w-full rounded-t-[6px] ${rank === 1 ? "bg-lime" : rank ? "bg-orange" : "bg-surface2"}`}
                />
                <span className="text-[11px] text-muted whitespace-nowrap">{week.label.replace(" Nov", "").replace(" Oct", "")}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[13px] text-muted">Taller bar = better finish.</p>
      </div>
    </div>
  );

  return (
    <div className="md:grid md:grid-cols-[1fr_380px] md:gap-8 space-y-6 md:space-y-0">
      <div className="md:order-2">{record}</div>
      <div className="md:order-1 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-[-0.5px]">Previous leagues</h2>
          <span className="text-[13px] text-muted">
            <span className="md:hidden">Weekly</span>
            <span className="hidden md:inline">Weekly, Monday to Sunday</span>
          </span>
        </div>
        {mineByWeek.map(({ week, rank }) => {
          const podium = week.standings.filter((r) => r.played).slice(0, 3);
          const winner = podium[0];
          if (!winner) return null;
          return (
            <button
              key={week.startDate}
              type="button"
              onClick={() => onOpen(week)}
              className="w-full text-left bg-surface rounded-[22px] px-5 py-4 md:px-7 md:py-6 hover:bg-surface2/70 transition-colors flex items-center gap-4 md:gap-8"
            >
              <div className="md:w-[210px] md:shrink-0 hidden md:block">
                <div className="text-[22px] font-extrabold">{week.label}</div>
                <div className="flex items-center gap-2 mt-1.5 text-[13px] text-muted">
                  Final
                  {rank && (
                    <span className="px-2.5 py-0.5 rounded-full border-[1.5px] border-orange text-orange font-bold">
                      You: {ordinal(rank)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-2 md:space-y-0 md:flex md:items-center md:gap-8">
                <div className="flex items-center justify-between md:hidden">
                  <span className="text-[15px] font-extrabold">{week.label}</span>
                  {rank && (
                    <span className="px-2.5 py-0.5 rounded-full border-[1.5px] border-orange text-orange text-[12px] font-bold">
                      You: {ordinal(rank)}
                    </span>
                  )}
                </div>
                <div className="md:w-[200px] md:shrink-0">
                  <span
                    style={{ color: winner.color }}
                    className="text-[38px] md:text-[56px] font-extrabold tracking-[-1.5px] leading-none"
                  >
                    {winner.name}
                  </span>{" "}
                  <span className="text-[13px] md:text-[15px] text-muted md:block">
                    won with {winner.points}
                    <span className="hidden md:inline"> {winner.points === 1 ? "point" : "points"}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 md:ml-auto">
                  {podium.map((r, i) => (
                    <span
                      key={r.playerId}
                      style={{ backgroundColor: r.color }}
                      className="inline-flex items-center gap-1 md:gap-1.5 rounded-full px-2.5 md:px-3 py-1.5 text-[#121212]"
                    >
                      <span className="text-[11px] font-bold opacity-70">{i + 1}</span>
                      <span className="text-[13px] md:text-[14px] font-extrabold">{r.name}</span>
                      <span className="font-serif text-[20px] md:text-[22px] leading-none">{r.points}</span>
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted shrink-0 hidden md:block" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------------------------

function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function dayHeading(date: string, today: string): string {
  const label = new Date(`${date}T12:00:00Z`)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .toUpperCase();
  return date === today ? `TODAY · ${label}` : label;
}

const INK = "#121212";

function Tile({ kind }: { kind: "correct" | "present" | "absent" }) {
  const base = "w-[30px] h-[30px] md:w-[36px] md:h-[36px] rounded-[7px]";
  if (kind === "correct") return <span className={`${base} bg-[#121212]`} />;
  if (kind === "present")
    return <span className={`${base} border-[3px] border-[#121212]`} />;
  return <span className={`${base} bg-[#121212]/20`} />;
}

function Graphic({ item }: { item: FeedResultItem }) {
  const slug = item.gameSlug;
  if (slug === "wordle" && item.grid) {
    return (
      <div className="flex flex-col gap-1">
        {item.grid.map((row, i) => (
          <div key={i} className="flex gap-1">
            {Array.from(row).map((c, j) => (
              <Tile key={j} kind={c === "🟩" ? "correct" : c === "🟨" ? "present" : "absent"} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (slug === "catfishing") {
    const filled = Math.round(item.primaryValue);
    return (
      <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 max-w-[260px] md:max-w-none">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={`w-[15px] h-[15px] sm:w-[22px] sm:h-[22px] md:w-[26px] md:h-[26px] rounded-full ${
              i < filled ? "bg-[#121212]" : "border-2 border-[#121212]"
            }`}
          />
        ))}
      </div>
    );
  }
  if (slug === "flagle") {
    const m = item.displayResult.match(/(\d)\s*\/\s*6/);
    const tries = m ? Number(m[1]) : 6;
    const failed = /X/i.test(item.displayResult);
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => {
          const wrong = failed ? true : i < tries - 1;
          const correct = !failed && i === tries - 1;
          return (
            <span
              key={i}
              className={`w-[34px] h-[34px] md:w-[44px] md:h-[44px] rounded-[8px] ${
                correct ? "bg-[#121212]" : wrong ? "bg-[#121212]/20" : "border-2 border-[#121212]"
              }`}
            />
          );
        })}
      </div>
    );
  }
  const lowerBetter = GAMES[slug]?.rankingDirection === "lower";
  if (!lowerBetter && item.dayBest && item.dayBest > 0 && ["maptap", "noillirk", "krillion", "wordishingrilliontapdle"].includes(slug)) {
    const pct = Math.max(4, Math.min(100, (item.primaryValue / item.dayBest) * 100));
    return (
      <div className="w-[190px] md:w-[300px]">
        <div className="h-3.5 rounded-full bg-[#121212]/20">
          <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-[#121212]" />
        </div>
        <div className="text-[12px] md:text-[13px] font-semibold opacity-70 mt-2">
          Day&apos;s best {item.dayBest.toLocaleString("en-GB")}
          {GAMES[slug]?.unit === "m" ? "m" : ""}
        </div>
      </div>
    );
  }
  return <span />;
}

function ResultCard({ item, today, now }: { item: FeedResultItem; today: string; now: number }) {
  const game = GAMES[item.gameSlug];
  const place =
    item.placement && item.outOf
      ? `${ordinal(item.placement)} of ${item.outOf}${item.date === today ? " so far" : ""}`
      : "";
  return (
    <div className="bg-surface rounded-[22px] p-4 md:p-5 space-y-3.5">
      <div className="flex items-center gap-3">
        <span
          style={{ backgroundColor: item.playerColor }}
          className="w-10 h-10 md:w-11 md:h-11 rounded-full text-[#121212] font-extrabold text-[17px] flex items-center justify-center shrink-0"
        >
          {item.playerName.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0 text-[16px] md:text-[18px] truncate">
          <span className="font-extrabold">{item.playerName}</span>{" "}
          <span className="text-muted">played</span>{" "}
          <span style={{ color: game.color }} className="font-extrabold">
            {game.name}
          </span>
        </div>
        <span className="text-[12px] md:text-[13px] text-muted whitespace-nowrap">
          {item.date === today ? relativeTime(item.at, now) : ""}
        </span>
      </div>
      <div
        style={{ backgroundColor: game.color, color: INK }}
        className="rounded-[18px] px-4 py-4 md:px-6 md:py-5 flex items-center justify-between gap-4 min-h-[88px]"
      >
        <Graphic item={item} />
        <div className="text-right shrink-0 ml-auto">
          <div className="font-serif text-[44px] md:text-[64px] leading-[0.95] tracking-[-1px] whitespace-nowrap">
            {item.displayResult}
          </div>
          {place && <div className="text-[12px] md:text-[14px] font-extrabold mt-1">{place}</div>}
        </div>
      </div>
    </div>
  );
}

function LeadCard({ item, now, today }: { item: Extract<FeedItem, { kind: "lead" }>; now: number; today: string }) {
  const max = Math.max(1, ...item.bars.map((b) => b.points));
  return (
    <div className="bg-surface rounded-[22px] p-4 md:p-5 space-y-3.5">
      <div className="flex items-center gap-3">
        <span
          style={{ backgroundColor: item.playerColor }}
          className="w-10 h-10 md:w-11 md:h-11 rounded-full text-[#121212] font-extrabold text-[17px] flex items-center justify-center shrink-0"
        >
          {item.playerName.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0 text-[16px] md:text-[18px] leading-tight">
          <span className="font-extrabold">{item.playerName}</span>{" "}
          <span className="text-muted">took the lead in {item.date === today ? "today's" : "that day's"} league</span>
        </div>
        <span className="text-[12px] md:text-[13px] text-muted whitespace-nowrap">
          {item.date === today ? relativeTime(item.at, now) : ""}
        </span>
      </div>
      <div className="bg-surface2 rounded-[16px] px-4 py-3.5 space-y-2.5">
        {item.bars.map((b) => (
          <div key={b.name} className="flex items-center gap-4">
            <span className="w-14 md:w-16 text-[14px] font-bold">{b.name}</span>
            <div className="flex-1">
              <div
                style={{ width: `${Math.max(6, (b.points / max) * 100)}%`, backgroundColor: b.color }}
                className="h-3 rounded-full"
              />
            </div>
            <span className="font-serif text-[26px] leading-none w-9 text-right">{b.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeedView({
  items,
  hasMore,
  onMore,
  filter,
  onFilter,
  games,
  todayDate,
  todayStandings,
  onPaste,
}: {
  items: FeedItem[];
  hasMore: boolean;
  onMore: () => void;
  filter: GameSlug | "all";
  onFilter: (f: GameSlug | "all") => void;
  games: Array<{ slug: GameSlug; name: string; color: string }>;
  todayDate: string;
  todayStandings: PlayerStandingRow[];
  onPaste: () => void;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const shown = items.filter((it) => filter === "all" || (it.kind === "result" && it.gameSlug === filter));
  const groups: Array<{ date: string; items: FeedItem[] }> = [];
  for (const it of shown) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }
  const maxPts = Math.max(1, ...todayStandings.map((r) => r.totalPoints));

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between md:gap-6 space-y-4 md:space-y-0">
        <div className="flex items-center justify-between md:justify-start md:gap-4">
          <h1 className="text-[40px] md:text-[64px] font-extrabold tracking-[-1.5px] md:tracking-[-2.5px] leading-none">
            Feed
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-lime text-lime px-3 py-1 text-[12px] md:text-[13px] font-extrabold">
            <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 md:mx-0 md:px-0">
          <button
            type="button"
            onClick={() => onFilter("all")}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap ${
              filter === "all" ? "bg-text text-[#121212]" : "border-[1.5px] border-line text-muted"
            }`}
          >
            All
          </button>
          {games.map((g) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => onFilter(g.slug)}
              className={`px-3.5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap inline-flex items-center gap-2 ${
                filter === g.slug ? "bg-text text-[#121212]" : "border-[1.5px] border-line text-muted"
              }`}
            >
              <span style={{ backgroundColor: g.color }} className="w-2 h-2 rounded-full" />
              {g.name === "Wordishingrilliontapdle" ? "Wordish" : g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_440px] lg:gap-8 space-y-6 lg:space-y-0">
        <div className="space-y-4">
          {groups.length === 0 && (
            <div className="bg-surface rounded-[22px] p-8 text-center text-muted text-[15px]">
              Nothing here yet. Results show up as soon as they&apos;re pasted.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.date} className="space-y-3">
              <div className="text-[12px] font-bold tracking-[0.18em] text-muted pt-1">
                {dayHeading(g.date, todayDate)}
              </div>
              {g.items.map((it) =>
                it.kind === "result" ? (
                  <ResultCard key={it.id} item={it} today={todayDate} now={now} />
                ) : (
                  <LeadCard key={it.id} item={it} today={todayDate} now={now} />
                )
              )}
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={onMore}
              className="w-full h-[54px] rounded-full border-[1.5px] border-line text-[14px] font-bold text-muted hover:bg-surface"
            >
              Show earlier updates
            </button>
          )}
        </div>

        <aside className="hidden lg:block space-y-5 self-start sticky top-24">
          <div className="bg-surface rounded-[22px] p-6 space-y-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[24px] font-extrabold">Today so far</h3>
              <span className="text-[12px] text-muted">Points</span>
            </div>
            {todayStandings.map((r) => (
              <div key={r.player.id} className="flex items-center gap-4">
                <span className="w-14 text-[14px] font-bold truncate">{r.player.name}</span>
                <div className="flex-1">
                  <div
                    style={{
                      width: `${r.gamesPlayed > 0 ? Math.max(4, (r.totalPoints / maxPts) * 100) : 1.5}%`,
                      backgroundColor: r.gamesPlayed > 0 ? r.player.color : "#2A2A27",
                    }}
                    className="h-3 rounded-full"
                  />
                </div>
                <span className="font-serif text-[26px] leading-none w-9 text-right">
                  {r.gamesPlayed > 0 ? r.totalPoints : <span className="text-muted">–</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="bg-lime text-[#121212] rounded-[22px] p-6 space-y-3">
            <h3 className="text-[24px] font-extrabold">Played today?</h3>
            <p className="text-[14px] opacity-80">Paste your result and it shows up here for everyone.</p>
            <button
              type="button"
              onClick={onPaste}
              className="w-full h-[54px] rounded-full bg-[#121212] text-text text-[15px] font-extrabold inline-flex items-center justify-center gap-2"
            >
              <ClipboardPaste className="w-4 h-4" />
              Paste result
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
