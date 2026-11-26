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
  highlights: { longestRun: GroupRecord | null; leadChanges: GroupRecord | null; avgMargin: GroupRecord | null };
  tightestWin: { value: string; caption: string } | null;
  upsetShare: { pct: number; caption: string } | null;
  cleanSolves: { pct: number; total: number; flawless: number } | null;
  sweeps: { lines: Array<{ label: string; who: string; pct: number }>; flawless: number };
  whenPlays: Array<{ name: string; color: string; median: number; lo: number; hi: number; tag: string }>; // hours 0..24
  consistent: Array<{ name: string; color: string; spread: number; lo: number; hi: number }>;
  consistentNote: string;
  moreRecords: { mostTied: GroupRecord | null; biggestUpset: GroupRecord | null };
  rivalries: Array<{ aName: string; aColor: string; a: number; bName: string; bColor: string; b: number; label: string }>;
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

  // ---- Extra group facts from the daily game standings in this period ----
  const nameColor = new Map(players.map((p) => [p.id, p.color]));
  const decided = daily.filter((g) => g.rankings.length > 1);

  // Overall leader across the period (by points)
  const totalPts = new Map<string, number>();
  for (const m of dayPoints.values()) for (const [pid, v] of m.entries()) totalPts.set(pid, (totalPts.get(pid) || 0) + v);
  const overall = [...totalPts.entries()].sort((a, b) => b[1] - a[1]);
  const leaderId = overall[0]?.[0];
  const rankOf = new Map(overall.map(([pid], i) => [pid, i + 1]));

  // Upset share: game winners who were not the overall leader
  const winners = decided.filter((g) => g.status === "Qualified" && g.rankings[0].placement === 1 && g.rankings.filter((r) => r.placement === 1).length === 1);
  const upsets = winners.filter((g) => g.rankings[0].playerId !== leaderId);
  const upsetShare = winners.length && leaderId ? { pct: Math.round((upsets.length / winners.length) * 100), caption: "won by non-leader" } : null;

  // Tightest win: smallest non-zero gap between 1st and 2nd in a game-day
  let tight: { gap: number; name: string; unit: string } | null = null;
  for (const g of decided) {
    const a = g.rankings[0];
    const b = g.rankings.find((r) => r.placement > 1);
    if (!a || !b) continue;
    const gap = Math.abs(a.primaryValue - b.primaryValue);
    if (gap <= 0) continue;
    if (!tight || gap < tight.gap) tight = { gap, name: GAMES[g.gameSlug].name, unit: GAMES[g.gameSlug].unit };
  }
  const tightestWin = tight ? { value: `${Number.isInteger(tight.gap) ? tight.gap : tight.gap.toFixed(1)}${tight.unit === "attempts" ? "" : " " + tight.unit}`.trim(), caption: `${tight.name} · closest win` } : null;

  // Clean solves
  const cleanTest = (s2: Submission): boolean | null => {
    switch (s2.gameSlug) {
      case "connections": return !s2.failed && s2.primaryValue === 0;
      case "wordle": case "flagle": case "metrodle": return !s2.failed && s2.primaryValue <= 2;
      case "strands": return s2.primaryValue === 0;
      case "catfishing": return s2.primaryValue >= 10;
      default: return null;
    }
  };
  let cleanN = 0, cleanTotal = 0;
  const perGameClean = new Map<string, Map<string, { c: number; n: number }>>();
  for (const x of subs) {
    const t = cleanTest(x);
    if (t === null) continue;
    cleanTotal++;
    if (t) cleanN++;
    const m = perGameClean.get(x.gameSlug) ?? new Map();
    const e = m.get(x.playerId) ?? { c: 0, n: 0 };
    e.n++;
    if (t) e.c++;
    m.set(x.playerId, e);
    perGameClean.set(x.gameSlug, m);
  }
  const labelFor: Record<string, string> = {
    connections: "Connections · 0 mistakes",
    wordle: "Wordle · 2 guesses or fewer",
    strands: "Strands · 0 hints",
    flagle: "Flagle · 2 guesses or fewer",
    metrodle: "Metrodle · 2 guesses or fewer",
    catfishing: "Catfishing · perfect 10",
  };
  const sweepLines = Object.keys(labelFor)
    .map((slug) => {
      const m = perGameClean.get(slug);
      if (!m) return null;
      const best = [...m.entries()].filter(([, e]) => e.n >= 1).sort((a, b) => b[1].c / b[1].n - a[1].c / a[1].n)[0];
      return best ? { slug, label: labelFor[slug], who: nameOf.get(best[0]) ?? "", pct: Math.round((best[1].c / best[1].n) * 100) } : null;
    })
    .filter((x): x is { slug: string; label: string; who: string; pct: number } => !!x)
    .slice(0, 5);

  // Who plays when: median submission time and the middle half
  const whenPlays = players
    .map((p) => {
      const hrs = subs
        .filter((x) => x.playerId === p.id)
        .map((x) => {
          const d = new Date(x.submittedAt);
          if (Number.isNaN(d.getTime())) return null;
          const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(d).split(":");
          return (Number(parts[0]) % 24) + Number(parts[1]) / 60;
        })
        .filter((h): h is number => h !== null)
        .sort((a, b) => a - b);
      if (!hrs.length) return null;
      const q = (f: number) => hrs[Math.min(hrs.length - 1, Math.floor(f * (hrs.length - 1)))];
      const med = q(0.5);
      const tag = med < 9 ? "early coffee" : med < 12 ? "mid-morning" : med < 14 ? "lunchtime" : med < 17 ? "afternoon" : med < 20 ? "after work" : med < 23 ? "evening" : "before midnight";
      return { name: p.name, color: p.color, median: med, lo: q(0.25), hi: q(0.75), tag };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.median - b.median);

  // Most consistent: narrowest spread of daily league points (relative to the player's median)
  const consistentAll = players
    .map((p) => {
      const vals = days.map((d) => dayPoints.get(d)?.get(p.id) ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
      if (vals.length < 3) return null;
      const med = vals[Math.floor(vals.length / 2)];
      const lo = vals[Math.floor(vals.length * 0.15)];
      const hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.85))];
      return { name: p.name, color: p.color, spread: Math.round(((hi - lo) / Math.max(1, med)) * 50), lo, hi };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.spread - b.spread);
  const consistent = consistentAll.slice(0, 5);
  const consistentNote = consistent[0] ? `${consistent[0].name} rarely strays from their usual score` : "Needs a few more days of play";

  // Records
  let mostTied: GroupRecord | null = null;
  for (const g of decided) {
    const tied = g.rankings.filter((r) => r.placement === 1).length;
    if (tied > 1 && (!mostTied || tied > Number(mostTied.label.split(" ")[0]))) {
      mostTied = { label: `${tied} players`, detail: `${fmtDate(g.leagueDate)} · ${GAMES[g.gameSlug].name} ${g.rankings[0].displayResult}` };
    }
  }
  let biggestUpset: GroupRecord | null = null;
  let upsetBy = 0;
  for (const g of winners) {
    const w = g.rankings[0];
    const wr = rankOf.get(w.playerId) ?? 0;
    const victim = g.rankings.slice(1).map((r) => ({ r, rk: rankOf.get(r.playerId) ?? 99 })).sort((a, b) => a.rk - b.rk)[0];
    if (!victim || !wr) continue;
    const jump = wr - victim.rk;
    if (jump > upsetBy) {
      upsetBy = jump;
      biggestUpset = { label: `${w.playerName} +${jump}`, detail: `Beat ${victim.r.playerName} on ${GAMES[g.gameSlug].name}` };
    }
  }

  // Head-to-head: who beat whom on shared game-days
  const h2h = new Map<string, { a: string; b: string; aw: number; bw: number }>();
  const h2hGame = new Map<string, Map<string, { a: string; b: string; aw: number; bw: number }>>();
  const bump = (m: Map<string, { a: string; b: string; aw: number; bw: number }>, x: string, y: string, xWon: boolean) => {
    const [a, b] = x < y ? [x, y] : [y, x];
    const e = m.get(`${a}|${b}`) ?? { a, b, aw: 0, bw: 0 };
    if ((a === x) === xWon) e.aw++;
    else e.bw++;
    m.set(`${a}|${b}`, e);
  };
  for (const g of decided) {
    for (let i = 0; i < g.rankings.length; i++) {
      for (let j = i + 1; j < g.rankings.length; j++) {
        const A = g.rankings[i];
        const B = g.rankings[j];
        if (A.placement === B.placement) continue;
        bump(h2h, A.playerId, B.playerId, true);
        const gm = h2hGame.get(g.gameSlug) ?? new Map();
        bump(gm, A.playerId, B.playerId, true);
        h2hGame.set(g.gameSlug, gm);
      }
    }
  }
  const closeness = (e: { aw: number; bw: number }) => Math.abs(e.aw - e.bw) / Math.max(1, e.aw + e.bw);
  const rivalries: GroupStats["rivalries"] = [];
  const used = new Set<string>();
  const overallClose = [...h2h.values()].filter((e) => e.aw + e.bw >= 5).sort((x, y) => closeness(x) - closeness(y) || y.aw + y.bw - (x.aw + x.bw))[0];
  const pushR = (e: { a: string; b: string; aw: number; bw: number }, lab: string) => {
    used.add(`${e.a}|${e.b}`);
    rivalries.push({ aName: nameOf.get(e.a) ?? "", aColor: nameColor.get(e.a) ?? "#888", a: e.aw, bName: nameOf.get(e.b) ?? "", bColor: nameColor.get(e.b) ?? "#888", b: e.bw, label: lab });
  };
  if (overallClose) pushR(overallClose, "Overall");
  const perGameClose: Array<{ e: { a: string; b: string; aw: number; bw: number }; slug: string }> = [];
  for (const [slug, m] of h2hGame.entries()) {
    for (const e of m.values()) if (e.aw + e.bw >= 4 && !used.has(`${e.a}|${e.b}`)) perGameClose.push({ e, slug });
  }
  perGameClose.sort((x, y) => closeness(x.e) - closeness(y.e) || y.e.aw + y.e.bw - (x.e.aw + x.e.bw));
  for (const c of perGameClose) {
    if (rivalries.length >= 3) break;
    if (used.has(`${c.e.a}|${c.e.b}`)) continue;
    pushR(c.e, GAMES[c.slug as keyof typeof GAMES]?.name ?? c.slug);
  }

  // Highlights for the deck: longest winning run, lead changes, average margin
  let runBest = 0, runBestWho = "", runBestSpan = "", cur = 0, curWho = "", curStart = "";
  for (const w of weeks.filter((w2) => w2.standings[0]?.played)) {
    const top2 = w.standings[0];
    if (top2.playerId === curWho) cur++;
    else { cur = 1; curWho = top2.playerId; curStart = w.label.split("–")[0]; }
    if (cur > runBest) { runBest = cur; runBestWho = top2.name; runBestSpan = `${curStart}–${w.label.split("–")[1] ?? w.label}`; }
  }
  const totalLeadChanges = weeks.reduce((a, w) => a + w.leadChanges, 0);
  const avgMargin = margins.length ? margins.reduce((a, m) => a + m.margin, 0) / margins.length : null;
  const highlights = {
    longestRun: runBest ? { label: `${runBest} ${runBest === 1 ? "wk" : "wks"}`, detail: `${runBestWho} · ${runBestSpan}` } : null,
    leadChanges: weeks.length ? { label: String(totalLeadChanges), detail: `across ${weeks.length} ${weeks.length === 1 ? "week" : "weeks"}` } : null,
    avgMargin: avgMargin !== null ? { label: `${avgMargin.toFixed(1)} pts`, detail: "between 1st & 2nd" } : null,
  };

  return {
    highlights,
    tightestWin,
    upsetShare,
    cleanSolves: cleanTotal ? { pct: Math.round((cleanN / cleanTotal) * 100), total: cleanTotal, flawless: cleanN } : null,
    sweeps: { lines: sweepLines.map(({ label, who, pct }) => ({ label, who, pct })), flawless: cleanN },
    whenPlays,
    consistent,
    consistentNote,
    moreRecords: { mostTied, biggestUpset },
    rivalries,
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
