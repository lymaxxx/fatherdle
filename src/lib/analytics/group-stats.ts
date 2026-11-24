import type { Player, Submission } from "../types";
import { GAMES } from "../constants";
import type { LeaguesPayload } from "./feed";

export interface GroupStats {
  totalResults: number;
  activeDays: number;
  weeksLed: Array<{ playerId: string; name: string; color: string; weeks: number }>;
  weeksTotal: number;
  busiestWeekday: { label: string; count: number } | null;
  peakHour: { label: string; count: number } | null;
  resultsByWeekday: number[]; // Mon..Sun
  participation: Array<{ playerId: string; name: string; color: string; days: number; rate: number }>;
  mostPlayed: Array<{ slug: string; name: string; count: number }>;
  qualificationRate: number | null; // 0..1
  leadChangesPerWeek: Array<{ label: string; value: number }>;
  records: {
    closestFinish: { label: string; detail: string } | null;
    biggestBlowout: { label: string; detail: string } | null;
    hardestDay: { label: string; detail: string } | null;
    longestRun: { label: string; detail: string } | null;
  };
}

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekdayIdx(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function londonHour(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }).format(d)
  ) % 24;
}

function fmtDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function buildGroupStats(
  startDate: string,
  endDate: string,
  submissions: Submission[],
  players: Player[],
  leagues: LeaguesPayload
): GroupStats {
  const subs = submissions.filter((s) => s.leagueDate >= startDate && s.leagueDate <= endDate);
  const days = Array.from(new Set(subs.map((s) => s.leagueDate))).sort();

  // Weeks led: winner of each league week that overlaps the period (finished weeks only, plus current if started)
  const weeks = [...leagues.previous, leagues.current].filter(
    (w) => w.endDate >= startDate && w.startDate <= endDate && w.daysPlayed > 0
  );
  const ledMap = new Map<string, number>();
  for (const w of weeks) {
    const top = w.standings.find((r) => r.rank === 1 && r.played);
    if (top) ledMap.set(top.playerId, (ledMap.get(top.playerId) || 0) + 1);
  }
  const weeksLed = players
    .map((p) => ({ playerId: p.id, name: p.name, color: p.color, weeks: ledMap.get(p.id) || 0 }))
    .filter((r) => r.weeks > 0)
    .sort((a, b) => b.weeks - a.weeks);

  const byWd = [0, 0, 0, 0, 0, 0, 0];
  const byHour = new Array(24).fill(0);
  for (const s of subs) {
    byWd[weekdayIdx(s.leagueDate)]++;
    const h = londonHour(s.submittedAt);
    if (h !== null) byHour[h]++;
  }
  const maxWd = Math.max(...byWd);
  const maxHr = Math.max(...byHour);

  const participation = players
    .map((p) => {
      const mine = new Set(subs.filter((s) => s.playerId === p.id).map((s) => s.leagueDate));
      return { playerId: p.id, name: p.name, color: p.color, days: mine.size, rate: days.length ? mine.size / days.length : 0 };
    })
    .sort((a, b) => b.rate - a.rate);

  const gameCount = new Map<string, number>();
  for (const s of subs) gameCount.set(s.gameSlug, (gameCount.get(s.gameSlug) || 0) + 1);
  const mostPlayed = Array.from(gameCount.entries())
    .map(([slug, count]) => ({ slug, name: GAMES[slug as keyof typeof GAMES]?.name ?? slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Qualification: per day, active players = distinct submitters; a game qualifies at ceil(active/2)
  let qualified = 0;
  let gameDays = 0;
  for (const d of days) {
    const day = subs.filter((s) => s.leagueDate === d);
    const active = new Set(day.map((s) => s.playerId)).size;
    const need = Math.ceil(active / 2);
    const per = new Map<string, number>();
    for (const s of day) per.set(s.gameSlug, (per.get(s.gameSlug) || 0) + 1);
    for (const n of per.values()) {
      gameDays++;
      if (n >= need) qualified++;
    }
  }

  // Records from weekly leagues
  const margins = weeks
    .filter((w) => w.standings.length > 1 && w.standings[0].played)
    .map((w) => ({ w, margin: w.standings[0].points - w.standings[1].points }));
  const closest = margins.length ? margins.reduce((a, b) => (b.margin < a.margin ? b : a)) : null;
  const blowout = margins.length ? margins.reduce((a, b) => (b.margin > a.margin ? b : a)) : null;
  const dayCounts = days.map((d) => ({ d, n: subs.filter((s) => s.leagueDate === d).length }));
  const hardest = dayCounts.length ? dayCounts.reduce((a, b) => (b.n < a.n ? b : a)) : null;

  // Longest run of consecutive days where every player posted something
  let best = 0;
  let bestEnd = "";
  let run = 0;
  let prev = "";
  for (const d of days) {
    const everyone = players.every((p) => subs.some((s) => s.leagueDate === d && s.playerId === p.id));
    const consecutive = prev && new Date(`${d}T12:00:00Z`).getTime() - new Date(`${prev}T12:00:00Z`).getTime() === 86400000;
    run = everyone ? (consecutive ? run + 1 : 1) : 0;
    if (run > best) {
      best = run;
      bestEnd = d;
    }
    prev = d;
  }

  const top = (w: { w: (typeof weeks)[number]; margin: number } | null, verb: string) =>
    w ? { label: `${w.margin} pts`, detail: `${w.w.standings[0].name} ${verb} · ${w.w.label}` } : null;

  return {
    totalResults: subs.length,
    activeDays: days.length,
    weeksLed,
    weeksTotal: weeks.length,
    busiestWeekday: subs.length ? { label: WD[byWd.indexOf(maxWd)], count: maxWd } : null,
    peakHour: subs.length && maxHr > 0 ? { label: `${String(byHour.indexOf(maxHr)).padStart(2, "0")}:00`, count: maxHr } : null,
    resultsByWeekday: byWd,
    participation,
    mostPlayed,
    qualificationRate: gameDays ? qualified / gameDays : null,
    leadChangesPerWeek: weeks.map((w) => ({ label: w.label, value: w.leadChanges })),
    records: {
      closestFinish: top(closest, "won"),
      biggestBlowout: top(blowout, "won"),
      hardestDay: hardest ? { label: `${hardest.n} results`, detail: fmtDate(hardest.d) } : null,
      longestRun: best ? { label: `${best} day${best === 1 ? "" : "s"}`, detail: `ending ${fmtDate(bestEnd)}` } : null,
    },
  };
}
