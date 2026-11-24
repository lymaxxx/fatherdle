"use client";

import React from "react";
import { ClipboardPaste, Hourglass, MoreHorizontal, Trash2, Zap } from "lucide-react";
import { GAMES } from "@/lib/constants";
import type { FeedDay, FeedItem, FeedResultItem } from "@/lib/analytics/feed";
import type { GameSlug, Player, PlayerStandingRow } from "@/lib/types";
import { GAME_ICON } from "@/lib/game-icons";
import { ColumnChart, GameIcon } from "./ui";

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function relativeShort(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

function dayHeading(date: string, today: string): string {
  const label = new Date(`${date}T12:00:00Z`)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .toUpperCase();
  return date === today ? `TODAY · ${label}` : label;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Avatar({ name, color, size = 28, initials }: { name: string; color: string; size?: number; initials?: string }) {
  return (
    <span
      style={{ backgroundColor: color, width: size, height: size, fontSize: Math.round(size * 0.45) }}
      className="rounded-full text-[#121212] font-bold flex items-center justify-center shrink-0"
    >
      {(initials ?? name.slice(0, 1)).toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Game graphics, drawn for the dark card
// ---------------------------------------------------------------------------------------------

interface GeoRound {
  n: number;
  country: string | null;
  points: number;
  km: number | null;
  seconds: number | null;
  steps: number | null;
}

function formatDistance(km: number | null): string {
  if (km === null) return "";
  if (km >= 1) return `${Math.round(km).toLocaleString("en-GB")} km`;
  return `${Math.round(km * 1000)} m`;
}

const CONNECTION_COLOURS: Record<string, string> = {
  "🟨": "#F9DF6D",
  "🟩": "#A0C35A",
  "🟦": "#B0C4EF",
  "🟪": "#BA81C5",
};

function Graphic({ item, reveal }: { item: FeedResultItem; reveal: boolean }) {
  const slug = item.gameSlug;
  const accent = GAME_ICON[slug]?.from ?? "#E6EB5E";

  if (slug === "wordle" && item.grid) {
    return (
      <div className="flex flex-col gap-1">
        {item.grid.map((row, i) => (
          <div key={i} className="flex gap-1">
            {Array.from(row).map((c, j) => (
              <span
                key={j}
                className={`w-[18px] h-[18px] md:w-[22px] md:h-[22px] rounded-[4px] ${
                  c === "🟩" ? "bg-[#8FD14F]" : c === "🟨" ? "bg-lime" : "bg-[#3A3935]"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (slug === "maptap" && item.rounds) {
    return (
      <div className="w-[170px] md:w-[340px]">
        <ColumnChart
          height={96}
          gap={6}
          radius={4}
          labelClass="text-[10px] md:text-[11px] text-muted"
          bars={item.rounds.map((pts, i) => ({
            label: `R${i + 1}`,
            // scale from 0–100 so a single round never fills the chart on its own
            value: pts,
            color: "#FF8A3D",
            valueText: pts,
            valueClass: "text-orange",
          }))}
        />
      </div>
    );
  }

  if (slug === "connections" && item.grid) {
    return (
      <div className="flex flex-col gap-1">
        {item.grid.map((row, i) => (
          <div key={i} className="flex gap-1">
            {Array.from(row).map((c, j) => (
              <span
                key={j}
                style={{ backgroundColor: CONNECTION_COLOURS[c] ?? "#3A3935" }}
                className="w-[22px] h-[16px] md:w-[26px] md:h-[18px] rounded-[3px]"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (slug === "strands" && item.grid) {
    return (
      <div className="flex flex-col gap-1.5">
        {item.grid.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {Array.from(row).map((c, j) =>
              c === "🟡" ? (
                <span key={j} className="w-[18px] h-[18px] md:w-[22px] md:h-[22px] rounded-full bg-[#F5D547]" />
              ) : c === "💡" ? (
                <span key={j} className="w-[18px] h-[18px] md:w-[22px] md:h-[22px] rounded-full border-2 border-dashed border-muted" />
              ) : (
                <span key={j} className="w-[18px] h-[18px] md:w-[22px] md:h-[22px] rounded-full bg-sky" />
              )
            )}
          </div>
        ))}
      </div>
    );
  }

  if (slug === "catfishing") {
    const filled = Math.round(item.primaryValue);
    return (
      <div className="grid grid-cols-5 gap-1.5 md:gap-2 w-fit">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={`w-[16px] h-[16px] md:w-[20px] md:h-[20px] rounded-full ${i < filled ? "bg-teal" : "bg-[#3A3935]"}`}
          />
        ))}
      </div>
    );
  }

  if (slug === "flagle" || slug === "metrodle") {
    const m = item.displayResult.match(/(\d)\s*\/\s*6/);
    const tries = m ? Number(m[1]) : 6;
    const failed = /X/i.test(item.displayResult);
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => {
          const correct = !failed && i === tries - 1;
          const used = failed || i < tries - 1;
          return (
            <span
              key={i}
              style={correct ? { backgroundColor: accent } : undefined}
              className={`w-[22px] h-[22px] md:w-[30px] md:h-[30px] rounded-[6px] ${
                correct ? "" : used ? "bg-[#4A4843]" : "bg-[#2A2A27]"
              }`}
            />
          );
        })}
      </div>
    );
  }

  if (slug === "geoguessr" && item.detail) {
    const rounds = (item.detail.rounds as GeoRound[]) ?? [];
    const hasNames = rounds.some((r) => r.country);
    return (
      <div className="w-full space-y-1.5">
        {rounds.map((r) => (
          <div key={r.n} className="flex items-center gap-2.5 text-[13px] md:text-[14px]">
            <span className="w-5 h-5 shrink-0 rounded-full bg-surface2 text-[10px] font-bold flex items-center justify-center">
              {r.n}
            </span>
            <span className="flex-1 min-w-0 truncate font-semibold">
              {!r.country ? (
                `Round ${r.n}`
              ) : reveal ? (
                r.country
              ) : (
                <span className="inline-block h-[10px] w-[80px] rounded-full bg-surface2 align-middle" />
              )}
            </span>
            <span className="tabular-nums text-muted w-[54px] text-right">{r.points.toLocaleString("en-GB")}</span>
            <span className="tabular-nums text-muted w-[64px] text-right">{formatDistance(r.km)}</span>
          </div>
        ))}
        {!reveal && hasNames && (
          <div className="text-[11px] text-muted pt-0.5">Locations stay hidden until you post your own GeoGuessr result for this day.</div>
        )}
      </div>
    );
  }

  if (slug === "flagcognito" && item.detail) {
    const flags = (item.detail.flags as Array<{ flag: string; country: string; taps: number }>) ?? [];
    return (
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 text-[13px] md:text-[14px]">
        {flags.map((f, i) => (
          <React.Fragment key={i}>
            <span className="text-[18px] leading-none">{f.flag}</span>
            <span className="font-semibold truncate">{f.country}</span>
            <span className="text-muted whitespace-nowrap">
              {f.taps} {f.taps === 1 ? "tap" : "taps"}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (slug === "whenography" && item.detail) {
    const rounds = (item.detail.rounds as Array<{ tile: string; yearsOff: number }>) ?? [];
    const tileColour: Record<string, string> = {
      "🟩": "#8FD14F",
      "🟨": "#E6EB5E",
      "🟧": "#FF8A3D",
      "🟥": "#FF5A1F",
      "⬜": "#C9CCD1",
      "⬛": "#3A3935",
    };
    const max = Math.max(1, ...rounds.map((r) => r.yearsOff));
    return (
      <div className="w-full max-w-[340px] space-y-1.5">
        {rounds.map((r, i) => (
          <div key={i} className="flex items-center gap-2.5 text-[12px] md:text-[13px]">
            <span style={{ backgroundColor: tileColour[r.tile] ?? "#C9CCD1" }} className="w-3.5 h-3.5 rounded-[3px] shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
              <div
                style={{ width: `${r.yearsOff === 0 ? 100 : Math.max(6, 100 - (r.yearsOff / max) * 90)}%`, backgroundColor: tileColour[r.tile] ?? "#C9CCD1" }}
                className="h-full rounded-full grow-in"
              />
            </div>
            <span className={`w-[76px] text-right tabular-nums ${r.yearsOff === 0 ? "text-lime font-semibold" : "text-muted"}`}>
              {r.yearsOff === 0 ? "spot on" : `${r.yearsOff} yrs off`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (slug === "flagments" && item.detail) {
    const d = item.detail as { solved?: boolean; peeks?: number; misses?: number | null };
    const chip = "rounded-full bg-surface2 px-3 py-1 text-[13px] font-semibold";
    return (
      <div className="flex flex-wrap gap-2">
        {d.solved === false && <span className={`${chip} text-orange`}>Not solved</span>}
        <span className={chip}>
          {d.peeks ?? 0} {d.peeks === 1 ? "peek" : "peeks"}
        </span>
        {d.misses !== null && d.misses !== undefined && (
          <span className={chip}>
            {d.misses} {d.misses === 1 ? "miss" : "misses"}
          </span>
        )}
      </div>
    );
  }

  // Score against the day's best (Krillion, Noillirk, Wordish, Huedle, Poople…)
  if (item.dayBest && item.dayBest > 0) {
    const lower = GAMES[slug]?.rankingDirection === "lower";
    const ratio = lower ? item.dayBest / Math.max(1, item.primaryValue) : item.primaryValue / item.dayBest;
    const pct = Math.max(6, Math.min(100, ratio * 100));
    return (
      <div className="w-full max-w-[300px]">
        <div className="h-3 rounded-full bg-surface2">
          <div style={{ width: `${pct}%`, backgroundColor: accent }} className="h-full rounded-full grow-in" />
        </div>
        <div className="text-[12px] text-muted mt-2">
          Day&apos;s best {item.dayBest.toLocaleString("en-GB")}
        </div>
      </div>
    );
  }
  return <span />;
}

/** One-line caption under the score: who did best, or the stand-out detail of this result. */
function caption(item: FeedResultItem): string {
  if (item.gameSlug === "maptap" && item.rounds?.length) return `Best round ${Math.max(...item.rounds)}`;
  if (item.placement === 1) return item.outOf > 1 ? "Best today" : "First in";
  if (item.dayBestBy && item.dayBest !== null) {
    const g = GAMES[item.gameSlug];
    if (g?.unit === "attempts") return `${item.dayBestBy} got it in ${item.dayBest}`;
    return `${item.dayBestBy} leads · ${item.dayBest.toLocaleString("en-GB")}`;
  }
  return "";
}

// ---------------------------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------------------------

export interface FeedLinks {
  onOpenPlayer: (playerId: string) => void;
  onOpenGame: (slug: GameSlug) => void;
}

export interface FeedActions {
  canManage: (playerId: string) => boolean;
  players: Player[];
  onDelete: (submissionId: string) => void;
  onReassign: (submissionId: string, toPlayerId: string) => void;
}

function ResultMenu({ item, actions }: { item: FeedResultItem; actions: FeedActions }) {
  const [open, setOpen] = React.useState(false);
  const others = actions.players.filter((p) => p.id !== item.playerId);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Manage result"
        onClick={() => setOpen((o) => !o)}
        className="w-7 h-7 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-56 bg-surface2 border border-line rounded-2xl p-2 shadow-2xl">
            {others.length > 0 && (
              <>
                <div className="px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Reassign to</div>
                <div className="max-h-48 overflow-y-auto">
                  {others.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        if (window.confirm(`Move this ${GAMES[item.gameSlug].name} result to ${p.name}?`))
                          actions.onReassign(item.id, p.id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface text-left text-[14px] font-semibold"
                    >
                      <span style={{ backgroundColor: p.color }} className="w-2.5 h-2.5 rounded-full" />
                      {p.name}
                    </button>
                  ))}
                </div>
                <div className="h-px bg-line my-1.5" />
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (window.confirm(`Delete this ${GAMES[item.gameSlug].name} result for ${item.playerName}?`))
                  actions.onDelete(item.id);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface text-left text-[14px] font-semibold text-orange"
            >
              <Trash2 className="w-4 h-4" />
              Delete result
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const WIDE_GRAPHIC: GameSlug[] = ["geoguessr", "flagcognito"];

function ResultCard({
  item,
  today,
  now,
  actions,
  links,
  reveal,
}: {
  item: FeedResultItem;
  today: string;
  now: number;
  actions: FeedActions;
  links: FeedLinks;
  reveal: boolean;
}) {
  const game = GAMES[item.gameSlug];
  const wide = WIDE_GRAPHIC.includes(item.gameSlug);
  const cap = caption(item);
  const time = item.date === today ? relativeShort(item.at, now) : clock(item.at);
  return (
    <div className="bg-surface rounded-[20px] p-4 md:p-5 space-y-3.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => links.onOpenPlayer(item.playerId)} className="flex items-center gap-2.5 min-w-0">
          <Avatar name={item.playerName} color={item.playerColor} size={28} />
          <span className="text-[15px] md:text-[16px] font-bold truncate">{item.playerName}</span>
        </button>
        <span className="hidden md:inline text-[14px] text-muted">posted</span>
        <button
          type="button"
          onClick={() => links.onOpenGame(item.gameSlug)}
          className="btn-secondary inline-flex items-center gap-1.5 rounded-full bg-surface2 pl-1 pr-2.5 py-1 text-[13px] font-semibold min-w-0"
        >
          <GameIcon slug={item.gameSlug} size={20} />
          <span className="truncate max-w-[120px] md:max-w-none">
            {game.name === "Wordishingrilliontapdle" ? "Wordish" : game.name}
          </span>
        </button>
        <span className="ml-auto text-[12px] md:text-[13px] text-muted whitespace-nowrap">{time}</span>
        {actions.canManage(item.playerId) && <ResultMenu item={item} actions={actions} />}
      </div>

      <div className={`flex gap-4 ${wide ? "flex-col" : "items-center justify-between"}`}>
        <div className={`min-w-0 ${wide ? "" : "flex-1"}`}>
          <Graphic item={item} reveal={reveal} />
        </div>
        <div className={`text-right shrink-0 ${wide ? "self-end" : ""}`}>
          <div className="font-serif text-[44px] md:text-[56px] leading-[0.95] tracking-[-1px] whitespace-nowrap">
            {item.displayResult}
          </div>
          {cap && (
            <div className={`text-[12px] md:text-[13px] mt-1 ${item.placement === 1 ? "text-lime" : "text-muted"}`}>{cap}</div>
          )}
        </div>
      </div>

      {item.placement !== null && item.outOf > 0 && (
        <div className="flex items-center gap-2.5">
          <span
            className={`rounded-full px-3 py-1 text-[12px] md:text-[13px] font-bold ${
              item.placement === 1 ? "bg-lime text-[#121212]" : "bg-surface2 text-text"
            }`}
          >
            {ordinal(item.placement)} of {item.outOf} {item.date === today ? "today" : ""}
          </span>
          <span className="text-[12px] md:text-[13px] text-muted">{item.counted ? `+${item.points} pts` : "pending"}</span>
        </div>
      )}
    </div>
  );
}

function LeadCard({ item, now, today }: { item: Extract<FeedItem, { kind: "lead" }>; now: number; today: string }) {
  const max = Math.max(1, ...item.bars.map((b) => b.points));
  return (
    <div className="bg-lime text-[#121212] rounded-[20px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4" />
        <span className="text-[15px] md:text-[16px] font-bold">{item.playerName} takes the lead</span>
        <span className="text-[12px] opacity-60">{item.date === today ? relativeShort(item.at, now) : clock(item.at)}</span>
      </div>
      {item.bars.map((b, i) => (
        <div key={b.name} className="flex items-center gap-3 md:gap-4">
          <span className="w-12 md:w-14 text-[13px] font-bold truncate">{b.name}</span>
          <div className="flex-1 h-4 rounded-[5px] bg-[#121212]/15 overflow-hidden">
            <div style={{ width: `${(b.points / max) * 100}%` }} className="h-full bg-[#121212] rounded-[5px] grow-in" />
          </div>
          <span className="w-10 text-right text-[13px] font-bold tabular-nums">
            {i === 0 ? "▲" : "▼"}
            {b.points}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

export function FeedPage({
  items,
  days,
  selectedDay,
  onSelectDay,
  hasMore,
  onMore,
  filter,
  onFilter,
  games,
  todayDate,
  todayStandings,
  countedLabel,
  onPaste,
  actions,
  links,
  viewerId,
  geoguessrPlayed,
  lastUpdated,
}: {
  items: FeedItem[];
  days: FeedDay[];
  selectedDay: string; // "" = everything
  onSelectDay: (d: string) => void;
  hasMore: boolean;
  onMore: () => void;
  filter: GameSlug | "all";
  onFilter: (f: GameSlug | "all") => void;
  games: Array<{ slug: GameSlug; name: string }>;
  todayDate: string;
  todayStandings: PlayerStandingRow[];
  countedLabel: string;
  onPaste: () => void;
  actions: FeedActions;
  links: FeedLinks;
  viewerId: string;
  geoguessrPlayed: Record<string, string[]>;
  lastUpdated: number;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  const [showAllChips, setShowAllChips] = React.useState(false);
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  const shown = items.filter(
    (it) =>
      (filter === "all" || (it.kind === "result" && it.gameSlug === filter)) &&
      (!selectedDay || it.date === selectedDay)
  );
  const groups: Array<{ date: string; items: FeedItem[] }> = [];
  for (const it of shown) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }

  // Chips: games with results first, the rest behind "+n more"
  const played = new Set(items.filter((i) => i.kind === "result").map((i) => (i as FeedResultItem).gameSlug));
  const orderedGames = [...games].sort((a, b) => Number(played.has(b.slug)) - Number(played.has(a.slug)));
  const chipLimit = 7;
  const chips = showAllChips ? orderedGames : orderedGames.slice(0, chipLimit);

  const todayCount = days.find((d) => d.date === todayDate)?.count ?? 0;
  const maxPts = Math.max(1, ...todayStandings.map((r) => r.totalPoints));
  const notPlayed = todayStandings.filter((r) => r.gamesPlayed === 0).map((r) => r.player.name);
  const yesterday = shiftDate(todayDate, -1);

  // Month headings for the rail
  const railRows: Array<{ month?: string; day?: FeedDay }> = [];
  let lastMonth = "";
  for (const d of days) {
    const month = new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
    if (month !== lastMonth) {
      railRows.push({ month });
      lastMonth = month;
    }
    railRows.push({ day: d });
  }
  const parts = (date: string) => {
    const dt = new Date(`${date}T12:00:00Z`);
    return { num: dt.getUTCDate(), wd: dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }) };
  };
  const secondsAgo = Math.max(0, Math.round((now - lastUpdated) / 1000));
  const liveLabel = secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`;

  const todaySoFar = (
    <div className="bg-surface rounded-[20px] p-5 space-y-3.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[17px] font-bold">Today so far</h3>
        <span className="text-[12px] text-muted">{countedLabel}</span>
      </div>
      {todayStandings.map((r) => {
        const playedAny = r.gamesPlayed > 0;
        return (
          <button
            key={r.player.id}
            type="button"
            onClick={() => links.onOpenPlayer(r.player.id)}
            className="w-full flex items-center gap-3 text-left"
          >
            <span className="w-3 text-[12px] text-muted tabular-nums">{r.rank}</span>
            <Avatar name={r.player.name} color={playedAny ? r.player.color : "#2A2A27"} size={22} initials={r.player.avatarInitials} />
            <span className={`w-16 text-[14px] font-semibold truncate ${playedAny ? "" : "text-muted"}`}>{r.player.name}</span>
            <div className="flex-1 h-[6px] rounded-full bg-surface2 overflow-hidden">
              {playedAny && (
                <div
                  style={{ width: `${Math.max(4, (r.totalPoints / maxPts) * 100)}%`, backgroundColor: r.player.color }}
                  className="h-full rounded-full grow-in"
                />
              )}
            </div>
            <span className="w-8 text-right text-[14px] font-bold tabular-nums">
              {playedAny ? r.totalPoints : <span className="text-muted">–</span>}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Heading */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-[44px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">Feed</h1>
          <span className="hidden md:inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[13px] text-muted">
            <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
            Live · {liveLabel}
          </span>
        </div>
        <span className="hidden md:inline text-[14px] text-muted">
          {todayCount} {todayCount === 1 ? "update" : "updates"} today
        </span>
      </div>

      {/* Phone: day strip, every day with results */}
      <div className="md:hidden flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
        {days.map((d) => {
          const { num, wd } = parts(d.date);
          const sel = selectedDay ? selectedDay === d.date : d.date === todayDate;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelectDay(selectedDay === d.date ? "" : d.date)}
              className={`shrink-0 w-[46px] h-[70px] rounded-[14px] flex flex-col items-center justify-center gap-1 transition-colors ${
                sel ? "bg-surface2 outline outline-1 outline-lime" : "bg-surface"
              }`}
            >
              <span className="font-serif text-[24px] leading-none">{num}</span>
              <span className="text-[10px] text-muted">{wd}</span>
              {d.leader ? (
                <Avatar name={d.leader.name} color={d.leader.color} size={14} initials={d.leader.initials} />
              ) : (
                <span className="w-[14px] h-[14px] rounded-full bg-surface2" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
        <button
          type="button"
          onClick={() => onFilter("all")}
          className={`h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
            filter === "all" ? "bg-text text-[#121212]" : "bg-surface text-muted hover:text-text"
          }`}
        >
          All games
        </button>
        {chips.map((g) => (
          <button
            key={g.slug}
            type="button"
            onClick={() => onFilter(g.slug)}
            className={`h-9 pl-1.5 pr-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-2 transition-colors ${
              filter === g.slug ? "bg-text text-[#121212]" : "bg-surface text-text hover:bg-surface2"
            }`}
          >
            <GameIcon slug={g.slug} size={24} />
            {g.name === "Wordishingrilliontapdle" ? "Wordish" : g.name}
          </button>
        ))}
        {!showAllChips && orderedGames.length > chipLimit && (
          <button
            type="button"
            onClick={() => setShowAllChips(true)}
            className="h-9 px-3.5 rounded-full border-[1.5px] border-line text-[13px] font-semibold text-muted whitespace-nowrap hover:text-text"
          >
            +{orderedGames.length - chipLimit} more
          </button>
        )}
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:grid-cols-[288px_minmax(0,1fr)_400px] md:gap-6 space-y-5 md:space-y-0">
        {/* Desktop: date rail with every day */}
        <aside className="hidden lg:block self-start sticky top-[100px] max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar pr-1">
          <button
            type="button"
            onClick={() => onSelectDay("")}
            className={`rail-item w-full flex items-center justify-between px-3 py-2.5 mb-2 rounded-[14px] text-left ${
              !selectedDay ? "bg-surface2 outline outline-1 outline-lime" : ""
            }`}
          >
            <span className="text-[14px] font-semibold">Latest updates</span>
            <span className="text-[12px] text-muted">all days</span>
          </button>
          {railRows.map((row, i) =>
            row.month ? (
              <div key={`m${i}`} className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-[1.6px] uppercase text-muted">
                {row.month}
              </div>
            ) : (
              (() => {
                const d = row.day!;
                const { num, wd } = parts(d.date);
                const sel = selectedDay === d.date;
                const title = d.date === todayDate ? "Today" : d.date === yesterday ? "Yesterday" : `${d.count} results`;
                const sub =
                  d.date === todayDate || d.date === yesterday
                    ? `${d.count} results`
                    : d.leader
                    ? `${d.leader.name} won`
                    : "no points";
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => onSelectDay(d.date)}
                    className={`rail-item w-full flex items-center gap-3 px-3 py-2 rounded-[14px] text-left ${
                      sel ? "bg-surface2 outline outline-1 outline-lime" : ""
                    }`}
                  >
                    <span className="w-8 flex flex-col items-center">
                      <span className="font-serif text-[26px] leading-none">{num}</span>
                      <span className="text-[10px] text-muted">{wd}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">{title}</span>
                      <span className="block text-[12px] text-muted">{sub}</span>
                    </span>
                    {d.leader && <Avatar name={d.leader.name} color={d.leader.color} size={24} initials={d.leader.initials} />}
                  </button>
                );
              })()
            )
          )}
        </aside>

        {/* Cards */}
        <div className="space-y-3 min-w-0">
          {groups.length === 0 && (
            <div className="bg-surface rounded-[20px] p-8 text-center text-muted text-[15px]">
              Nothing here yet. Results show up as soon as they&apos;re pasted.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.date} className="space-y-3">
              <div className="text-[12px] font-bold tracking-[1.6px] text-muted pt-1">{dayHeading(g.date, todayDate)}</div>
              {g.items.map((it) =>
                it.kind === "result" ? (
                  <ResultCard
                    key={it.id}
                    item={it}
                    today={todayDate}
                    now={now}
                    actions={actions}
                    links={links}
                    reveal={
                      it.gameSlug !== "geoguessr" ||
                      (!!viewerId && (it.playerId === viewerId || (geoguessrPlayed[it.date] ?? []).includes(viewerId)))
                    }
                  />
                ) : (
                  <LeadCard key={it.id} item={it} today={todayDate} now={now} />
                )
              )}
            </div>
          ))}
          {hasMore && !selectedDay && (
            <button
              type="button"
              onClick={onMore}
              className="btn-secondary w-full h-12 rounded-full border-[1.5px] border-line text-[14px] font-semibold text-muted"
            >
              Show earlier updates
            </button>
          )}
        </div>

        {/* Side column (below the cards on phones) */}
        <aside className="space-y-3 self-start md:sticky md:top-[100px]">
          {todaySoFar}
          {notPlayed.length > 0 && (
            <div className="bg-surface rounded-[16px] px-4 py-3 flex items-center gap-2.5 text-[13px] text-text">
              <Hourglass className="w-4 h-4 text-lime shrink-0" />
              <span>
                {notPlayed.length === 1
                  ? `${notPlayed[0]} hasn't played yet today`
                  : `${notPlayed.slice(0, -1).join(", ")} and ${notPlayed[notPlayed.length - 1]} haven't played yet today`}
              </span>
            </div>
          )}
          <div className="hidden md:block bg-lime text-[#121212] rounded-[20px] p-5 space-y-3">
            <h3 className="text-[18px] font-bold">Played something?</h3>
            <p className="text-[14px] opacity-80">Paste the share text and it lands here for everyone.</p>
            <button
              type="button"
              onClick={onPaste}
              className="btn-primary h-11 px-5 rounded-full bg-[#121212] text-text text-[14px] font-bold inline-flex items-center gap-2"
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
