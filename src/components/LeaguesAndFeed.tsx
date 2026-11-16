"use client";

import React from "react";
import { ChevronRight, ClipboardPaste, MoreHorizontal, Share2, Trash2, X } from "lucide-react";
import { GAMES } from "@/lib/constants";
import type { FeedItem, FeedResultItem, LeagueWeek } from "@/lib/analytics/feed";
import type { GameSlug, Player, PlayerStandingRow } from "@/lib/types";

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

interface GeoRound {
  n: number;
  country: string | null;
  points: number;
  km: number | null;
  seconds: number | null;
  steps: number | null;
}

/** Whole kilometres, or metres for anything under a kilometre. */
function formatDistance(km: number | null): string {
  if (km === null) return "";
  if (km >= 1) return `${Math.round(km).toLocaleString("en-GB")} km`;
  return `${Math.round(km * 1000)} m`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60 ? `${seconds % 60} s` : ""}`.trim();
}

const STACKED_GAMES: GameSlug[] = ["geoguessr", "flagcognito"];

/** Flagcognito stacks its total under the list on phones, but sits beside it on desktop. */
const stackedOnDesktop = (slug: GameSlug) => slug === "geoguessr";

function Graphic({ item, reveal }: { item: FeedResultItem; reveal: boolean }) {
  const slug = item.gameSlug;
  if (slug === "geoguessr" && item.detail) {
    const rounds = (item.detail.rounds as GeoRound[]) ?? [];
    const hasTimes = rounds.some((r) => r.seconds !== null);
    const hasNames = rounds.some((r) => r.country);
    return (
      <div className="w-full space-y-1.5">
        {rounds.map((r) => (
          <div key={r.n} className="md:flex md:items-center md:gap-2.5">
            <div className="flex items-center gap-2.5 md:flex-1 md:min-w-0">
              <span className="w-[22px] h-[22px] shrink-0 rounded-full border-2 border-[#121212] text-[11px] font-extrabold flex items-center justify-center">
                {r.n}
              </span>
              {!r.country ? (
                <span className="text-[14px] md:text-[16px] font-extrabold truncate min-w-0 flex-1">Round {r.n}</span>
              ) : reveal ? (
                <span className="text-[14px] md:text-[16px] font-extrabold truncate min-w-0 flex-1">{r.country}</span>
              ) : (
                <span className="flex-1 min-w-0">
                  <span className="block h-[14px] w-[88px] md:w-[120px] rounded-full bg-[#121212]/25" />
                </span>
              )}
            </div>
            <div className="pl-[32px] md:pl-0 flex text-[12px] md:text-[14px] font-bold tabular-nums whitespace-nowrap opacity-80 md:opacity-100">
              <span className="w-[52px] md:w-[60px] text-right">{r.points.toLocaleString("en-GB")}</span>
              <span className="w-[68px] md:w-[84px] text-right">{formatDistance(r.km)}</span>
              {hasTimes && (
                <span className="w-[68px] md:w-[84px] text-right">{formatDuration(r.seconds)}</span>
              )}
              <span className="w-[56px] md:w-[72px] text-right">
                {r.steps !== null ? `${r.steps} ${r.steps === 1 ? "step" : "steps"}` : ""}
              </span>
            </div>
          </div>
        ))}
        {!reveal && hasNames && (
          <div className="text-[11px] md:text-[12px] font-semibold opacity-70 pt-0.5">
            Locations stay hidden until you submit your own GeoGuessr result for this day.
          </div>
        )}
      </div>
    );
  }
  if (slug === "flagcognito" && item.detail) {
    const flags = (item.detail.flags as Array<{ flag: string; country: string; taps: number }>) ?? [];
    return (
      <div className="grid grid-cols-[auto_auto_auto] justify-start items-center gap-x-3 md:gap-x-5 gap-y-1.5">
        {flags.map((f, i) => (
          <React.Fragment key={i}>
            <span className="text-[22px] md:text-[26px] leading-none">{f.flag}</span>
            <span className="text-[14px] md:text-[16px] font-extrabold">{f.country}</span>
            <span className="text-[13px] md:text-[15px] font-bold whitespace-nowrap">
              {f.taps} {f.taps === 1 ? "tap" : "taps"}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  }
  if (slug === "flagments" && item.detail) {
    const d = item.detail as { solved?: boolean; peeks?: number; misses?: number };
    const chip = "rounded-full border-2 border-[#121212] px-3 py-1 text-[13px] md:text-[15px] font-extrabold";
    return (
      <div className="flex flex-wrap gap-2">
        {d.solved === false && <span className={`${chip} bg-[#121212] text-text`}>Not solved</span>}
        <span className={chip}>
          {d.peeks ?? 0} {d.peeks === 1 ? "peek" : "peeks"}
        </span>
        <span className={chip}>
          {d.misses ?? 0} {d.misses === 1 ? "miss" : "misses"}
        </span>
      </div>
    );
  }
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
  if (slug === "connections" && item.grid) {
    const colours: Record<string, string> = {
      "🟨": "#F9DF6D",
      "🟩": "#A0C35A",
      "🟦": "#B0C4EF",
      "🟪": "#BA81C5",
    };
    return (
      <div className="flex flex-col gap-1">
        {item.grid.map((row, i) => (
          <div key={i} className="flex gap-1">
            {Array.from(row).map((c, j) => (
              <span
                key={j}
                style={{ backgroundColor: colours[c] ?? "#fff" }}
                className="w-[22px] h-[22px] md:w-[26px] md:h-[26px] rounded-[5px] border-[1.5px] border-[#121212]/60"
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
                <span key={j} className="w-[20px] h-[20px] md:w-[24px] md:h-[24px] rounded-full bg-[#F5D547] border-2 border-[#121212]" />
              ) : c === "💡" ? (
                <span key={j} className="w-[20px] h-[20px] md:w-[24px] md:h-[24px] rounded-full border-2 border-[#121212] border-dashed" />
              ) : (
                <span key={j} className="w-[20px] h-[20px] md:w-[24px] md:h-[24px] rounded-full bg-[#121212]" />
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
  if (slug === "flagle" || slug === "metrodle") {
    const m = item.displayResult.match(/(\d)\s*\/\s*6/);
    const tries = m ? Number(m[1]) : 6;
    const failed = /X/i.test(item.displayResult);
    return (
      <div className="flex gap-1 sm:gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => {
          const wrong = failed ? true : i < tries - 1;
          const correct = !failed && i === tries - 1;
          return (
            <span
              key={i}
              className={`w-[24px] h-[24px] sm:w-[34px] sm:h-[34px] md:w-[44px] md:h-[44px] rounded-[6px] sm:rounded-[8px] ${
                correct ? "bg-[#121212]" : wrong ? "bg-[#121212]/20" : "border-2 border-[#121212]"
              }`}
            />
          );
        })}
      </div>
    );
  }
  if (slug === "maptap" && item.rounds) {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-2 max-w-[250px] md:max-w-[420px]">
        {item.rounds.map((points, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className="w-[22px] h-[22px] md:w-[26px] md:h-[26px] rounded-full border-2 border-[#121212] text-[11px] md:text-[12px] font-extrabold flex items-center justify-center">
              {i + 1}
            </span>
            <span className="text-[16px] md:text-[20px] font-extrabold tabular-nums">{points}</span>
          </span>
        ))}
      </div>
    );
  }
  const lowerBetter = GAMES[slug]?.rankingDirection === "lower";
  if (!lowerBetter && item.dayBest && item.dayBest > 0 && ["noillirk", "krillion", "wordishingrilliontapdle"].includes(slug)) {
    const pct = Math.max(4, Math.min(100, (item.primaryValue / item.dayBest) * 100));
    return (
      <div className="w-[190px] md:w-[300px]">
        <div className="h-3.5 rounded-full bg-[#121212]/20">
          <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-[#121212]" />
        </div>
        <div className="text-[12px] md:text-[13px] font-semibold opacity-70 mt-2">
          Day&apos;s best {item.dayBest.toLocaleString("en-GB")}
        </div>
      </div>
    );
  }
  return <span />;
}

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
        className="w-8 h-8 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-56 bg-surface2 border border-line rounded-2xl p-2 shadow-2xl">
            {others.length > 0 && (
              <>
                <div className="px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Reassign to
                </div>
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface text-left text-[14px] font-bold"
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
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface text-left text-[14px] font-bold text-orange"
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
  const stacked = STACKED_GAMES.includes(item.gameSlug);
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
        <div className="flex-1 min-w-0 text-[16px] md:text-[18px] leading-tight">
          <button
            type="button"
            onClick={() => links.onOpenPlayer(item.playerId)}
            className="font-extrabold hover:underline"
          >
            {item.playerName}
          </button>{" "}
          <span className="text-muted">played</span>{" "}
          <button
            type="button"
            onClick={() => links.onOpenGame(item.gameSlug)}
            style={{ color: game.color }}
            className="font-extrabold hover:underline"
          >
            {game.name}
          </button>
        </div>
        <span className="text-[12px] md:text-[13px] text-muted whitespace-nowrap">
          {item.date === today ? relativeTime(item.at, now) : ""}
        </span>
        {actions.canManage(item.playerId) && <ResultMenu item={item} actions={actions} />}
      </div>
      <div
        style={{ backgroundColor: game.color, color: INK }}
        className={`rounded-[18px] px-4 py-4 md:px-6 md:py-5 flex gap-3 min-h-[88px] overflow-hidden ${
          !stacked
            ? "items-center justify-between"
            : stackedOnDesktop(item.gameSlug)
            ? "flex-col"
            : "flex-col md:flex-row md:items-center md:justify-between"
        }`}
      >
        <div className={`min-w-0 ${stacked && !stackedOnDesktop(item.gameSlug) ? "w-full md:w-auto" : "w-full"}`}>
          <Graphic item={item} reveal={reveal} />
        </div>
        <div
          className={`text-right shrink-0 ml-auto ${
            stacked ? (stackedOnDesktop(item.gameSlug) ? "w-full" : "w-full md:w-auto") : ""
          }`}
        >
          <div className="font-serif text-[40px] md:text-[64px] leading-[0.95] tracking-[-1px] whitespace-nowrap">
            {item.displayResult}
          </div>
          {place && <div className="text-[12px] md:text-[14px] font-extrabold mt-1">{place}</div>}
        </div>
      </div>
    </div>
  );
}

function LeadCard({
  item,
  now,
  today,
  links,
}: {
  item: Extract<FeedItem, { kind: "lead" }>;
  now: number;
  today: string;
  links: FeedLinks;
}) {
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
          <button
            type="button"
            onClick={() => links.onOpenPlayer(item.playerId)}
            className="font-extrabold hover:underline"
          >
            {item.playerName}
          </button>{" "}
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
  actions,
  links,
  viewerId,
  geoguessrPlayed,
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
  actions: FeedActions;
  links: FeedLinks;
  viewerId: string;
  geoguessrPlayed: Record<string, string[]>;
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
          <h1 className="text-[36px] md:text-[64px] font-extrabold tracking-[-1.4px] md:tracking-[-2.5px] leading-none">
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
                  <ResultCard
                    key={it.id}
                    item={it}
                    today={todayDate}
                    now={now}
                    actions={actions}
                    links={links}
                    reveal={
                      it.gameSlug !== "geoguessr" ||
                      (!!viewerId &&
                        (it.playerId === viewerId || (geoguessrPlayed[it.date] ?? []).includes(viewerId)))
                    }
                  />
                ) : (
                  <LeadCard key={it.id} item={it} today={todayDate} now={now} links={links} />
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
