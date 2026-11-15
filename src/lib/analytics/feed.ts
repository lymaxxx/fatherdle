import { ACTIVE_GAME_SLUGS } from "../constants";
import { DatePeriod, GameSlug, Player, Submission } from "../types";
import { addDays, listDatesInRange, mondayOf, resolveDatePeriod } from "./dates";
import {
  calculateAllDailyStandings,
  calculateLeagueStandings,
  calculateTimeSeries,
} from "./engine";

// ---------------------------------------------------------------------------------------------
// Weekly leagues (Monday to Sunday)
// ---------------------------------------------------------------------------------------------

export interface LeagueWeekRow {
  playerId: string;
  name: string;
  color: string;
  points: number;
  rank: number;
  played: boolean;
  gamesPlayed: number;
  qualifiedGames: number;
  firstPlaces: number;
}

export interface LeagueWeek {
  startDate: string;
  endDate: string; // the Sunday, even for the league in progress
  label: string;
  final: boolean;
  daysPlayed: number; // days with at least one result so far
  daysElapsed: number; // 1..7
  gamesCounted: number;
  leadChanges: number;
  standings: LeagueWeekRow[];
}

export interface LeaguesPayload {
  current: LeagueWeek;
  previous: LeagueWeek[]; // finished weeks, newest first
}

function buildWeek(
  start: string,
  todayDate: string,
  submissions: Submission[],
  players: Player[]
): LeagueWeek {
  const sunday = addDays(start, 6);
  const final = sunday < todayDate;
  const end = final ? sunday : todayDate;
  const period: DatePeriod = resolveDatePeriod("custom", todayDate, start, end);

  const rows = calculateLeagueStandings(period, submissions, players, todayDate);
  const daily = calculateAllDailyStandings(start, end, submissions, players, todayDate);
  const { leadChangesCount } = calculateTimeSeries(period, submissions, players, todayDate);
  const datesWithResults = new Set(
    submissions.filter((s) => s.leagueDate >= start && s.leagueDate <= end).map((s) => s.leagueDate)
  );

  return {
    startDate: start,
    endDate: sunday,
    label: labelFor(start, sunday),
    final,
    daysPlayed: datesWithResults.size,
    daysElapsed: listDatesInRange(start, end).length,
    gamesCounted: daily.filter((g) => g.status === "Qualified").length,
    leadChanges: leadChangesCount,
    standings: rows.map((r) => ({
      playerId: r.player.id,
      name: r.player.name,
      color: r.player.color,
      points: r.totalPoints,
      rank: r.rank,
      played: r.gamesPlayed > 0,
      gamesPlayed: r.gamesPlayed,
      qualifiedGames: r.qualifiedGamesPlayed,
      firstPlaces: r.firstPlaces,
    })),
  };
}

function labelFor(start: string, end: string): string {
  const fmt = (d: string, withMonth: boolean) => {
    const dt = new Date(`${d}T12:00:00Z`);
    const day = dt.getUTCDate();
    const month = dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
    return withMonth ? `${day} ${month}` : `${day}`;
  };
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth ? `${fmt(start, false)}–${fmt(end, true)}` : `${fmt(start, true)}–${fmt(end, true)}`;
}

export function buildLeagues(
  todayDate: string,
  submissions: Submission[],
  players: Player[]
): LeaguesPayload {
  const currentMonday = mondayOf(todayDate);
  const first = submissions.length
    ? submissions.reduce((min, s) => (s.leagueDate < min ? s.leagueDate : min), submissions[0].leagueDate)
    : todayDate;

  const previous: LeagueWeek[] = [];
  for (let m = mondayOf(first); m < currentMonday; m = addDays(m, 7)) {
    const week = buildWeek(m, todayDate, submissions, players);
    if (week.daysPlayed > 0) previous.push(week);
  }
  previous.reverse();

  return { current: buildWeek(currentMonday, todayDate, submissions, players), previous };
}

// ---------------------------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------------------------

export interface FeedResultItem {
  kind: "result";
  id: string;
  at: string; // ISO timestamp
  date: string; // league date
  playerId: string;
  playerName: string;
  playerColor: string;
  gameSlug: GameSlug;
  displayResult: string;
  primaryValue: number;
  placement: number | null;
  outOf: number;
  dayBest: number | null;
  grid: string[] | null; // Wordle-style tile rows
  rounds: number[] | null; // MapTap round scores
}

export interface FeedLeadItem {
  kind: "lead";
  id: string;
  at: string;
  date: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  bars: Array<{ name: string; color: string; points: number }>;
}

export type FeedItem = FeedResultItem | FeedLeadItem;

const TILE = /^[⬛⬜🟨🟩🟥🟦🟪🟧🟫]+$/u;

function gridFrom(raw: string): string[] | null {
  const rows = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => TILE.test(l));
  return rows.length ? rows : null;
}

/** Round scores from a MapTap share ("98🔥 89🎉 85💫 90👑 75😂"), whatever badge each round got. */
function roundsFrom(rawText: string): number[] | null {
  const scores = rawText
    .split(/\s+/)
    .map((t) => t.match(/^(\d{1,3})([^\d\s]+)$/u))
    .filter((m): m is RegExpMatchArray => m !== null && parseInt(m[1], 10) <= 100)
    .map((m) => parseInt(m[1], 10));
  return scores.length ? scores : null;
}

export function buildFeed(
  todayDate: string,
  submissions: Submission[],
  players: Player[],
  limit: number
): { items: FeedItem[]; hasMore: boolean } {
  const byId = new Map(players.map((p) => [p.id, p]));
  const indexed = submissions
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => byId.has(s.playerId))
    .sort(
      (a, b) =>
        b.s.leagueDate.localeCompare(a.s.leagueDate) ||
        b.s.submittedAt.localeCompare(a.s.submittedAt) ||
        b.i - a.i
    );
  const window = indexed.slice(0, limit);
  const dates = [...new Set(window.map(({ s }) => s.leagueDate))];

  // Standings per game for each date shown, for "2nd of 5 so far" and the day's best
  const placement = new Map<string, { place: number; outOf: number; best: number | null }>();
  for (const d of dates) {
    for (const g of calculateAllDailyStandings(d, d, submissions, players, todayDate, ACTIVE_GAME_SLUGS)) {
      for (const r of g.rankings) {
        placement.set(`${d}|${g.gameSlug}|${r.playerId}`, {
          place: r.placement,
          outOf: g.submissionCount,
          best: g.rankings[0]?.primaryValue ?? null,
        });
      }
    }
  }

  const items: Array<FeedItem & { order: number }> = [];
  window.forEach(({ s }, n) => {
    const p = byId.get(s.playerId)!;
    const pl = placement.get(`${s.leagueDate}|${s.gameSlug}|${s.playerId}`);
    items.push({
      kind: "result",
      id: s.id,
      at: s.submittedAt,
      date: s.leagueDate,
      playerId: p.id,
      playerName: p.name,
      playerColor: p.color,
      gameSlug: s.gameSlug,
      displayResult: s.displayResult,
      primaryValue: s.primaryValue,
      placement: pl?.place ?? null,
      outOf: pl?.outOf ?? 0,
      dayBest: pl?.best ?? null,
      grid: s.gameSlug === "wordle" ? gridFrom(s.rawText) : null,
      rounds: s.gameSlug === "maptap" ? roundsFrom(s.rawText) : null,
      order: -n * 2,
    });
  });

  // Lead-change events: replay each shown day in order and note when the day's leader changes
  for (const d of dates) {
    const daySubs = submissions
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.leagueDate === d && byId.has(s.playerId))
      .sort((a, b) => a.s.submittedAt.localeCompare(b.s.submittedAt) || a.i - b.i);
    const period = resolveDatePeriod("today", d);
    let leader: string | null = null;
    const soFar: Submission[] = [];
    for (const { s } of daySubs) {
      soFar.push(s);
      const rows = calculateLeagueStandings(period, soFar, players, todayDate).filter(
        (r) => r.totalPoints > 0
      );
      const top = rows[0];
      if (!top) continue;
      const tied = rows[1] && rows[1].totalPoints === top.totalPoints;
      if (leader && !tied && top.player.id !== leader) {
        const cause = items.find((it) => it.kind === "result" && it.id === s.id);
        if (cause) {
          items.push({
            kind: "lead",
            id: `lead_${d}_${s.id}`,
            at: s.submittedAt,
            date: d,
            playerId: top.player.id,
            playerName: top.player.name,
            playerColor: top.player.color,
            bars: rows.slice(0, 2).map((r) => ({
              name: r.player.name,
              color: r.player.color,
              points: r.totalPoints,
            })),
            order: cause.order + 1, // sorts just above the result that caused it
          } as FeedItem & { order: number });
        }
      }
      if (!tied) leader = top.player.id;
    }
  }

  items.sort((a, b) => b.order - a.order);
  return {
    items: items.map(({ order: _order, ...rest }) => rest as FeedItem),
    hasMore: indexed.length > limit,
  };
}
