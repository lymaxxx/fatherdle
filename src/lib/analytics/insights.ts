import {
  DatePeriod,
  LeagueInsight,
  Player,
  PlayerStandingRow,
  Submission,
} from "../types";
import { ACTIVE_GAME_SLUGS, GAMES, TOKENS } from "../constants";
import {
  calculateAllDailyStandings,
  calculateLeagueStandings,
  calculateTimeSeries,
} from "./engine";
import { formatSingleDateShort } from "./dates";

/**
 * Generates deterministic, factual insights for the selected period (Section 3).
 *
 * Rules:
 * - No generic filler or dramatic commentary.
 * - Every insight has a concrete number (`leadValue`), direct factual copy (`text`),
 *   and respects minimum sample sizes.
 * - Prioritises variety across players so the same player is not repeated in every insight
 *   when other meaningful findings exist.
 */
export function generateAutomaticInsights(
  period: DatePeriod,
  submissions: Submission[],
  players: Player[],
  currentTodayDate: string = "2026-11-14",
  maxInsights: number = 5
): LeagueInsight[] {
  const standings = calculateLeagueStandings(period, submissions, players, currentTodayDate);
  const { series, leadChangesCount, lastLeadChange } = calculateTimeSeries(
    period,
    submissions,
    players,
    currentTodayDate
  );
  const dailyStandings = calculateAllDailyStandings(
    period.startDate,
    period.endDate,
    submissions,
    players,
    currentTodayDate
  );

  const candidates: LeagueInsight[] = [];

  // 1. Biggest climb (requires positionChange > 0)
  const climbers = standings
    .filter((r) => r.positionChange !== null && r.positionChange > 0)
    .sort((a, b) => (b.positionChange || 0) - (a.positionChange || 0));

  if (climbers.length > 0) {
    const top = climbers[0];
    const gain = top.positionChange!;
    const cmpText = period.prevLabel ? ` compared with ${period.prevLabel}` : "";
    candidates.push({
      id: "biggest_climb",
      type: "biggest_climb",
      leadValue: `+${gain}`,
      leadColor: TOKENS.lime,
      text: `${top.player.name} gained ${gain} ${gain === 1 ? "place" : "places"}${cmpText}.`,
      detail:
        top.previousRank !== null
          ? `Moved from #${top.previousRank} to #${top.rank}.`
          : undefined,
      involvedPlayerIds: [top.player.id],
    });
  }

  // 2. Lead changes
  if (leadChangesCount > 0 && lastLeadChange) {
    const dateFmt = formatSingleDateShort(lastLeadChange.date).replace(/^[A-Za-z]+\s+/, "");
    const freqText =
      leadChangesCount === 1
        ? "It is the only lead change in this period."
        : `The lead has changed ${leadChangesCount} times in this period.`;
    candidates.push({
      id: "lead_change",
      type: "lead_change",
      leadValue: `${leadChangesCount}`,
      leadColor: TOKENS.orange,
      text: `${lastLeadChange.newLeaderName} took the lead on ${dateFmt}. ${freqText}`,
      involvedPlayerIds: [],
    });
  }

  // 3. Closest race (smallest non-negative points difference between adjacent active players)
  const activeStandings = standings.filter((r) => r.qualifiedGamesPlayed >= 2);
  let closestPair: { a: PlayerStandingRow; b: PlayerStandingRow; diff: number } | null = null;
  for (let i = 0; i < activeStandings.length - 1; i++) {
    const a = activeStandings[i];
    const b = activeStandings[i + 1];
    const diff = a.totalPoints - b.totalPoints;
    if (!closestPair || diff < closestPair.diff) {
      closestPair = { a, b, diff };
    }
  }

  if (closestPair && closestPair.diff <= 15) {
    const { a, b, diff } = closestPair;
    candidates.push({
      id: "closest_race",
      type: "closest_race",
      leadValue: `${diff}`,
      leadColor: TOKENS.sand,
      text:
        diff === 0
          ? `${a.player.name} and ${b.player.name} are tied on ${a.totalPoints} points.`
          : `${a.player.name} and ${b.player.name} are ${diff} ${
              diff === 1 ? "point" : "points"
            } apart, the closest gap in the table.`,
      involvedPlayerIds: [a.player.id, b.player.id],
    });
  }

  // 4. Most first places
  const topWinners = [...standings]
    .filter((r) => r.firstPlaces > 0)
    .sort((a, b) => b.firstPlaces - a.firstPlaces);

  if (topWinners.length > 0) {
    const top = topWinners[0];
    candidates.push({
      id: "most_first_places",
      type: "most_first_places",
      leadValue: `${top.firstPlaces}`,
      leadColor: TOKENS.sky,
      text: `${top.player.name} has ${top.firstPlaces} first-place ${
        top.firstPlaces === 1 ? "finish" : "finishes"
      } from ${top.qualifiedGamesPlayed} qualified games.`,
      involvedPlayerIds: [top.player.id],
    });
  }

  // 5. Most competitive game (smallest mean gap between 1st and 3rd placements / normalized score spread)
  // Requires at least 2 qualified instances in the period
  const gameCompetitiveness: Array<{
    gameName: string;
    avgPointSpread: number;
    tieRate: number;
    instances: number;
  }> = [];

  for (const slug of ACTIVE_GAME_SLUGS) {
    const qInstances = dailyStandings.filter(
      (d) => d.gameSlug === slug && d.status === "Qualified" && d.rankings.length >= 4
    );
    if (qInstances.length < 2) continue;

    let tieCount = 0;
    let normSpreadSum = 0;

    for (const inst of qInstances) {
      const vals = inst.rankings.map((r) => r.primaryValue);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const meanV = vals.reduce((a, b) => a + b, 0) / vals.length;
      const cv = meanV > 0 ? (maxV - minV) / meanV : 0;
      normSpreadSum += cv;

      const uniqueRanks = new Set(inst.rankings.map((r) => r.placement)).size;
      if (uniqueRanks < inst.rankings.length) tieCount += 1;
    }

    gameCompetitiveness.push({
      gameName: GAMES[slug].name,
      avgPointSpread: normSpreadSum / qInstances.length,
      tieRate: tieCount / qInstances.length,
      instances: qInstances.length,
    });
  }

  gameCompetitiveness.sort((a, b) => a.avgPointSpread - b.avgPointSpread);
  if (gameCompetitiveness.length > 0) {
    const comp = gameCompetitiveness[0];
    const pctSpread = Math.max(1, Math.round(comp.avgPointSpread * 100));
    candidates.push({
      id: "most_competitive_game",
      type: "most_competitive_game",
      leadValue: `${pctSpread}%`,
      leadColor: TOKENS.pink,
      text: `${comp.gameName} has the closest results across ${comp.instances} qualified rounds (${pctSpread}% average spread).`,
      involvedPlayerIds: [],
    });
  }

  // 6. Best single-day score
  let bestDayPlayerId = "";
  let bestDayDate = "";
  let bestDayScore = 0;

  for (const pt of series) {
    for (const [pid, score] of Object.entries(pt.dailyByPlayer)) {
      if (score > bestDayScore) {
        bestDayScore = score;
        bestDayPlayerId = pid;
        bestDayDate = pt.date;
      }
    }
  }

  if (bestDayScore > 0) {
    const p = players.find((x) => x.id === bestDayPlayerId);
    if (p) {
      candidates.push({
        id: "best_day",
        type: "best_day",
        leadValue: `${bestDayScore}`,
        leadColor: TOKENS.lime,
        text: `${p.name} scored ${bestDayScore} points on ${formatSingleDateShort(
          bestDayDate
        )}, the highest single-day total.`,
        involvedPlayerIds: [p.id],
      });
    }
  }

  // 7. Most consistent player (lowest standard deviation of placements across >= 5 qualified games)
  const consistencyList: Array<{ player: Player; stdDev: number; count: number }> = [];
  for (const p of players) {
    const placements: number[] = [];
    for (const dg of dailyStandings) {
      if (dg.status !== "Qualified") continue;
      const r = dg.rankings.find((x) => x.playerId === p.id);
      if (r) placements.push(r.placement);
    }
    if (placements.length >= 5) {
      const mean = placements.reduce((a, b) => a + b, 0) / placements.length;
      const variance =
        placements.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / placements.length;
      const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;
      consistencyList.push({ player: p, stdDev, count: placements.length });
    }
  }

  consistencyList.sort((a, b) => a.stdDev - b.stdDev);
  if (consistencyList.length > 0) {
    const topC = consistencyList[0];
    candidates.push({
      id: "most_consistent",
      type: "most_consistent",
      leadValue: `±${topC.stdDev.toFixed(1)}`,
      leadColor: TOKENS.teal,
      text: `${topC.player.name} is the most consistent player (±${topC.stdDev.toFixed(
        1
      )} place variation across ${topC.count} games).`,
      involvedPlayerIds: [topC.player.id],
    });
  }

  // 8. Longest winning streak (defined as consecutive qualified game appearances with a 1st-place finish)
  let topStreakPlayer: Player | null = null;
  let topStreakLen = 0;

  const qualifiedChrono = dailyStandings
    .filter((d) => d.status === "Qualified")
    .sort((a, b) => a.leagueDate.localeCompare(b.leagueDate));

  for (const p of players) {
    let cur = 0;
    let maxS = 0;
    for (const qg of qualifiedChrono) {
      const r = qg.rankings.find((x) => x.playerId === p.id);
      if (!r) continue;
      if (r.placement === 1) {
        cur += 1;
        if (cur > maxS) maxS = cur;
      } else {
        cur = 0;
      }
    }
    if (maxS > topStreakLen) {
      topStreakLen = maxS;
      topStreakPlayer = p;
    }
  }

  if (topStreakPlayer && topStreakLen >= 2) {
    candidates.push({
      id: "longest_streak",
      type: "longest_streak",
      leadValue: `${topStreakLen}`,
      leadColor: TOKENS.olive,
      text: `${topStreakPlayer.name} won ${topStreakLen} consecutive qualified game appearances.`,
      detail: "Streak counts consecutive qualified games entered by the player.",
      involvedPlayerIds: [topStreakPlayer.id],
    });
  }

  // Select up to `maxInsights` while avoiding repeating the same player more than twice
  const selected: LeagueInsight[] = [];
  const playerMentionCount = new Map<string, number>();

  for (const c of candidates) {
    if (selected.length >= maxInsights) break;
    const overRepresented = c.involvedPlayerIds.some(
      (pid) => (playerMentionCount.get(pid) || 0) >= 2
    );
    if (overRepresented && candidates.length > maxInsights) continue;

    selected.push(c);
    for (const pid of c.involvedPlayerIds) {
      playerMentionCount.set(pid, (playerMentionCount.get(pid) || 0) + 1);
    }
  }

  return selected;
}
