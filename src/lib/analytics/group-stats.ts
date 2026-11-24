import type { Player, Submission } from "../types";
import { ACTIVE_GAME_SLUGS, GAMES } from "../constants";
import { calculateAllDailyStandings } from "./engine";
import type { LeaguesPayload } from "./feed";

export interface GroupRecord {
  label: string; // the big value, e.g. "3 pts"
  detail: string; // the small line under it
}

export interface GroupStats {
  periodLabel: string;
  totalResults: number;
  activeDays: number;
  weeksLed: Array<{ playerId: string; name: string; color: string; weeks: number }>;
  weeksTotal: number;
  busiestWeekday: { label: string; count: number } | null;
  peakHour: { label: string; count: number } | null;
  resultsByWeekday: number[]; // Mon..Sun
  participation: Array<{ playerId: string; name: string; color: string; initials: string; days: number; rate: number }>;
  participationOverall: number | null; // 0..1, player-days played over possible player-days
  mostPlayed: Array<{ slug: string; name: string; count: number }>;
  qualificationRate: number | null; // 0..1
  qualifiedGameDays: number;
  gameDays: number;
  leadChangesPerWeek: Array<{ label: string; value: number }>;
  records: {
    closestFinish: GroupRecord | null;
    biggestBlowout: GroupRecord | null;
    hardestDay: GroupRecord | null;
    longestRun: GroupRecord | null;
  };
  groupRecords: Array<{ label: string; who: string; value: string }>;
}

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekdayIdx(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function londonHour(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }).format(d)) % 24
  );
}

function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function fmtDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function buildGroupStats(
  startDate: string,
  endDate: string,
  submissions: Submission[],
  players: Player[],
  leagues: LeaguesPayload,
  periodLabel = "",
  todayDate = endDate
): GroupStats {
  const known = new Set(players.map((p) => p.id));
  const subs = submissions.filter(
    (s) => s.leagueDate >= startDate && s.leagueDate <= endDate && known.has(s.playerId)
  );
  const days = Array.from(new Set(subs.map((s) => s.leagueDate))).sort();
  const nameOf = new Map(players.map((p) => [p.id, p.name]));

  // Weeks led: winner of each league week overlapping the period
  const weeks = [...leagues.previous].reverse().concat(leagues.current).filter(
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
      return {
        playerId: p.id,
        name: p.name,
        color: p.color,
        initials: p.avatarInitials,
        days: mine.size,
        rate: days.length ? mine.size / days.length : 0,
      };
    })
    .sort((a, b) => b.rate - a.rate);
  const possible = players.length * days.length;
  const participationOverall = possible ? participation.reduce((a, p) => a + p.days, 0) / possible : null;

  const gameCount = new Map<string, number>();
  for (const s of subs) gameCount.set(s.gameSlug, (gameCount.get(s.gameSlug) || 0) + 1);
  const mostPlayed = Array.from(gameCount.entries())
    .map(([slug, count]) => ({ slug, name: GAMES[slug as keyof typeof GAMES]?.name ?? slug, count }))
    .sort((a, b) => b.count - a.count);

  // Qualification and daily points, from the same engine that scores the league
  const daily = days.length
    ? calculateAllDailyStandings(days[0], days[days.length - 1], submissions, players, todayDate, ACTIVE_GAME_SLUGS).filter(
        (g) => g.submissionCount > 0 && g.leagueDate >= startDate && g.leagueDate <= endDate
      )
    : [];
  const gameDays = daily.length;
  const qualifiedGameDays = daily.filter((g) => g.status === "Qualified").length;
  const dayPoints = new Map<string, Map<string, number>>();
  for (const g of daily) {
    const m = dayPoints.get(g.leagueDate) ?? new Map<string, number>();
    for (const r of g.rankings) m.set(r.playerId, (m.get(r.playerId) || 0) + r.leaguePoints);
    dayPoints.set(g.leagueDate, m);
  }
  let bestDay: { who: string; pts: number; date: string } | null = null;
  let hardest: { date: string; top: number } | null = null;
  for (const [date, m] of dayPoints.entries()) {
    let top = 0;
    let who = "";
    for (const [pid, pts] of m.entries()) {
      if (pts > top) {
        top = pts;
        who = nameOf.get(pid) ?? "";
      }
    }
    if (top > 0 && (!bestDay || top > bestDay.pts)) bestDay = { who, pts: top, date };
    if (top > 0 && (!hardest || top < hardest.top)) hardest = { date, top };
  }
  const dayCounts = days.map((d) => ({ d, n: subs.filter((s) => s.leagueDate === d).length }));
  const busiestDay = dayCounts.length ? dayCounts.reduce((a, b) => (b.n > a.n ? b : a)) : null;

  // Weekly league records
  const finished = weeks.filter((w) => w.final && w.standings.length > 1 && w.standings[0].played);
  const margins = finished.map((w) => ({ w, margin: w.standings[0].points - w.standings[1].points }));
  const closest = margins.length ? margins.reduce((a, b) => (b.margin < a.margin ? b : a)) : null;
  const blowout = margins.length ? margins.reduce((a, b) => (b.margin > a.margin ? b : a)) : null;

  // Longest run of consecutive days where every player posted something
  let best = 0;
  let bestEnd = "";
  let run = 0;
  let prev = "";
  for (const d of days) {
    const everyone = players.every((p) => subs.some((s) => s.leagueDate === d && s.playerId === p.id));
    const consecutive =
      prev && new Date(`${d}T12:00:00Z`).getTime() - new Date(`${prev}T12:00:00Z`).getTime() === 86400000;
    run = everyone ? (consecutive ? run + 1 : 1) : 0;
    if (run > best) {
      best = run;
      bestEnd = d;
    }
    prev = d;
  }

  const groupRecords: GroupStats["groupRecords"] = [];
  if (bestDay) groupRecords.push({ label: "Most points in a day", who: `${bestDay.who} · ${fmtDate(bestDay.date)}`, value: String(bestDay.pts) });
  if (busiestDay) groupRecords.push({ label: "Results in one day", who: fmtDate(busiestDay.d), value: String(busiestDay.n) });
  const topWeek = weeks
    .flatMap((w) => w.standings.filter((r) => r.played).map((r) => ({ w, r })))
    .reduce<{ w: (typeof weeks)[number]; r: (typeof weeks)[number]["standings"][number] } | null>(
      (a, b) => (!a || b.r.points > a.r.points ? b : a),
      null
    );
  if (topWeek) groupRecords.push({ label: "Best league week", who: `${topWeek.r.name} · ${topWeek.w.label}`, value: String(topWeek.r.points) });

  return {
    periodLabel,
    totalResults: subs.length,
    activeDays: days.length,
    weeksLed,
    weeksTotal: weeks.length,
    busiestWeekday: subs.length ? { label: WD[byWd.indexOf(maxWd)], count: maxWd } : null,
    peakHour: maxHr > 0 ? { label: hourLabel(byHour.indexOf(maxHr)), count: maxHr } : null,
    resultsByWeekday: byWd,
    participation,
    participationOverall,
    mostPlayed,
    qualificationRate: gameDays ? qualifiedGameDays / gameDays : null,
    qualifiedGameDays,
    gameDays,
    leadChangesPerWeek: weeks.map((w) => ({ label: w.label, value: w.leadChanges })),
    records: {
      closestFinish: closest
        ? { label: `${closest.margin} pts`, detail: `${closest.w.label} · ${closest.w.standings[0].name} over ${closest.w.standings[1].name}` }
        : null,
      biggestBlowout: blowout ? { label: `${blowout.margin} pts`, detail: `${blowout.w.label} · ${blowout.w.standings[0].name}` } : null,
      hardestDay: hardest ? { label: fmtDate(hardest.date), detail: `Nobody scored above ${hardest.top}` } : null,
      longestRun: best ? { label: `${best} ${best === 1 ? "day" : "days"}`, detail: `Longest full-house run · to ${fmtDate(bestEnd)}` } : null,
    },
    groupRecords,
  };
}
