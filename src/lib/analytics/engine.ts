import {
  DailyGameStanding,
  DatePeriod,
  GameQualificationStatus,
  GameSlug,
  Player,
  PlayerStandingRow,
  RankedSubmission,
  Submission,
} from "../types";
import { ACTIVE_GAME_SLUGS, DEFAULT_MIN_SUBMISSIONS, GAMES } from "../constants";
import { formatSingleDateShort, getWeekdayInitial, listDatesInRange } from "./dates";

/**
 * Compares two submissions within the same game to determine rank order.
 * Returns < 0 if `a` is better than `b`, > 0 if `b` is better than `a`, and 0 if tied.
 * Note: For League Competition Ranking, two submissions with the exact same `primaryValue`
 * and `failed` status share the same placement & league points!
 */
export function compareGameSubmissions(a: Submission, b: Submission): number {
  const game = GAMES[a.gameSlug] || GAMES.custom;

  // Failed results (e.g. X/6) always rank below completed results
  if (a.failed !== b.failed) {
    return a.failed ? 1 : -1;
  }

  if (a.primaryValue !== b.primaryValue) {
    if (game.rankingDirection === "lower") {
      return a.primaryValue - b.primaryValue;
    }
    return b.primaryValue - a.primaryValue;
  }

  return 0;
}

/**
 * Calculates the daily game standing for a single (gameSlug, leagueDate).
 *
 * Rules:
 * - A game qualifies once at least half of that day's active players have submitted it.
 *   Active players are those with at least one result of any game on that date; players who
 *   played nothing that day don't count towards the half.
 * - If `submissionCount >= requiredCount`: status = "Qualified".
 * - If `submissionCount < requiredCount`:
 *   - If `leagueDate === currentTodayDate`: status = "Pending" (provisional).
 *   - Otherwise (`leagueDate < currentTodayDate`): status = "Excluded".
 * - Standard competition ranking ("1, 2, 2, 4"):
 *   - Players with identical primaryValue share the exact same placement.
 *   - In a Qualified game with N submissions, 1st place earns N points, 2nd place earns N-1,
 *     ..., placement P earns (N - P + 1) points.
 *   - Failed submissions (e.g. X/6) still count towards the N submission threshold for qualification,
 *     and receive placement rank, or 0 points if failed? Standard rank points: placement P gets N - P + 1.
 *   - In Pending or Excluded games, individual placements (1st, 2nd, ...) are still calculated
 *     for the game leaderboard, but `leaguePoints` is strictly 0.
 */
export function calculateDailyGameStanding(
  gameSlug: GameSlug,
  leagueDate: string,
  submissions: Submission[],
  players: Player[],
  currentTodayDate: string = "2026-11-14",
  // Everything submitted that day (any game); defaults to `submissions`, which may be every game's results
  daySubmissions?: Submission[]
): DailyGameStanding {
  const game = GAMES[gameSlug] || GAMES.custom;
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const activePlayers = new Set(
    (daySubmissions ?? submissions)
      .filter((s) => s.leagueDate === leagueDate && playerMap.has(s.playerId))
      .map((s) => s.playerId)
  ).size;
  const requiredCount = Math.max(1, Math.ceil(activePlayers / 2));

  // Filter to active players who existed on or before leagueDate
  const eligiblePlayers = players.filter((p) => p.joinedAt <= leagueDate);
  const gameSubs = submissions.filter(
    (s) => s.gameSlug === gameSlug && s.leagueDate === leagueDate && playerMap.has(s.playerId)
  );

  const submissionCount = gameSubs.length;
  let status: GameQualificationStatus;
  if (submissionCount >= requiredCount) {
    status = "Qualified";
  } else if (leagueDate >= currentTodayDate) {
    status = "Pending";
  } else {
    status = "Excluded";
  }

  const isFinalised = leagueDate < currentTodayDate;

  // Sort submissions by game ranking rule, then player name for deterministic ordering
  const sorted = [...gameSubs].sort((a, b) => {
    const cmp = compareGameSubmissions(a, b);
    if (cmp !== 0) return cmp;
    const pA = playerMap.get(a.playerId)?.name || "";
    const pB = playerMap.get(b.playerId)?.name || "";
    return pA.localeCompare(pB);
  });

  const N = sorted.length;
  const rankings: RankedSubmission[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const sub = sorted[i];
    const player = playerMap.get(sub.playerId)!;

    let placement = i + 1;
    if (i > 0 && compareGameSubmissions(sorted[i - 1], sub) === 0) {
      placement = rankings[i - 1].placement;
    }

    // Standard inverse rank points: 1st = N, 2nd = N-1, ...
    // Awarded ONLY when status === "Qualified"
    const leaguePoints = status === "Qualified" ? Math.max(1, N - placement + 1) : 0;

    rankings.push({
      ...sub,
      playerName: player.name,
      playerSlug: player.slug,
      playerColor: player.color,
      placement,
      leaguePoints,
    });
  }

  const submittedIds = new Set(gameSubs.map((s) => s.playerId));
  const missingPlayers = eligiblePlayers.filter((p) => !submittedIds.has(p.id));

  return {
    gameSlug,
    leagueDate,
    status,
    isFinalised,
    submissionCount,
    requiredCount,
    activePlayers,
    totalPlayers: eligiblePlayers.length,
    rankings,
    missingPlayers,
  };
}

/**
 * Computes all DailyGameStandings across a date range and set of games.
 */
export function calculateAllDailyStandings(
  startDate: string,
  endDate: string,
  submissions: Submission[],
  players: Player[],
  currentTodayDate: string = "2026-11-14",
  gameSlugs: GameSlug[] = ACTIVE_GAME_SLUGS
): DailyGameStanding[] {
  const dates = listDatesInRange(startDate, endDate);
  const results: DailyGameStanding[] = [];

  // Index submissions by `${leagueDate}_${gameSlug}` for O(1) lookup
  const byDateGame = new Map<string, Submission[]>();
  const byDate = new Map<string, Submission[]>();
  for (const s of submissions) {
    if (s.leagueDate < startDate || s.leagueDate > endDate) continue;
    const dayList = byDate.get(s.leagueDate);
    if (dayList) dayList.push(s);
    else byDate.set(s.leagueDate, [s]);
    const key = `${s.leagueDate}_${s.gameSlug}`;
    const list = byDateGame.get(key);
    if (list) list.push(s);
    else byDateGame.set(key, [s]);
  }

  for (const date of dates) {
    for (const slug of gameSlugs) {
      const key = `${date}_${slug}`;
      const subs = byDateGame.get(key) || [];
      // Include if there are submissions OR if it's today's active games
      if (subs.length > 0 || date === currentTodayDate) {
        results.push(
          calculateDailyGameStanding(slug, date, subs, players, currentTodayDate, byDate.get(date) ?? [])
        );
      }
    }
  }

  return results;
}

/**
 * Computes the League Standings table for a selected period, and calculates
 * `positionChange` against the equivalent previous period if provided.
 */
export function calculateLeagueStandings(
  period: DatePeriod,
  submissions: Submission[],
  players: Player[],
  currentTodayDate: string = "2026-11-14"
): PlayerStandingRow[] {
  const currentRows = computeRawStandingsForWindow(
    period.startDate,
    period.endDate,
    submissions,
    players,
    currentTodayDate
  );

  if (period.prevStartDate && period.prevEndDate) {
    const prevRows = computeRawStandingsForWindow(
      period.prevStartDate,
      period.prevEndDate,
      submissions,
      players,
      currentTodayDate
    );
    const prevRankMap = new Map<string, number>();
    for (const r of prevRows) {
      if (r.gamesPlayed > 0) {
        prevRankMap.set(r.player.id, r.rank);
      }
    }

    for (const row of currentRows) {
      const prevRank = prevRankMap.get(row.player.id) ?? null;
      row.previousRank = prevRank;
      if (prevRank !== null && row.gamesPlayed > 0) {
        // Positive positionChange means climbing up the table (e.g. 5th -> 2nd = +3)
        row.positionChange = prevRank - row.rank;
      } else {
        row.positionChange = null;
      }
    }
  }

  return currentRows;
}

function computeRawStandingsForWindow(
  startDate: string,
  endDate: string,
  submissions: Submission[],
  players: Player[],
  currentTodayDate: string
): PlayerStandingRow[] {
  const dailyGames = calculateAllDailyStandings(
    startDate,
    endDate,
    submissions,
    players,
    currentTodayDate
  );

  const totalQualifiedOpportunities = dailyGames.filter((g) => g.status === "Qualified").length;
  const totalAvailableOpportunities = Math.max(
    1,
    listDatesInRange(startDate, endDate).length * ACTIVE_GAME_SLUGS.length
  );

  const statsMap = new Map<
    string,
    {
      player: Player;
      totalPoints: number;
      firstPlaces: number;
      gamesPlayed: number;
      qualifiedGamesPlayed: number;
      placementSum: number;
      placementCounts: { first: number; second: number; third: number; fourthPlus: number };
      pointsByGame: Record<GameSlug, number>;
    }
  >();

  for (const p of players) {
    statsMap.set(p.id, {
      player: p,
      totalPoints: 0,
      firstPlaces: 0,
      gamesPlayed: 0,
      qualifiedGamesPlayed: 0,
      placementSum: 0,
      placementCounts: { first: 0, second: 0, third: 0, fourthPlus: 0 },
      pointsByGame: {
        wordle: 0,
        maptap: 0,
        krillion: 0,
        noillirk: 0,
        huedle: 0,
        flagle: 0,
        catfishing: 0,
        poople: 0,
        wordishingrilliontapdle: 0,
        custom: 0,
      },
    });
  }

  for (const dg of dailyGames) {
    const isQualified = dg.status === "Qualified";
    for (const r of dg.rankings) {
      const entry = statsMap.get(r.playerId);
      if (!entry) continue;

      entry.gamesPlayed += 1;

      if (isQualified) {
        entry.qualifiedGamesPlayed += 1;
        entry.totalPoints += r.leaguePoints;
        entry.pointsByGame[dg.gameSlug] =
          (entry.pointsByGame[dg.gameSlug] || 0) + r.leaguePoints;
        entry.placementSum += r.placement;

        if (r.placement === 1) {
          entry.firstPlaces += 1;
          entry.placementCounts.first += 1;
        } else if (r.placement === 2) {
          entry.placementCounts.second += 1;
        } else if (r.placement === 3) {
          entry.placementCounts.third += 1;
        } else {
          entry.placementCounts.fourthPlus += 1;
        }
      }
    }
  }

  const rows: PlayerStandingRow[] = Array.from(statsMap.values()).map((st) => {
    const q = st.qualifiedGamesPlayed;
    const averagePlacement = q > 0 ? Math.round((st.placementSum / q) * 100) / 100 : null;
    const winRate = q > 0 ? st.firstPlaces / q : null;
    const pointsPerQualifiedGame = q > 0 ? Math.round((st.totalPoints / q) * 100) / 100 : null;
    const participationRate =
      totalQualifiedOpportunities > 0
        ? q / totalQualifiedOpportunities
        : st.gamesPlayed / totalAvailableOpportunities;

    return {
      player: st.player,
      rank: 0,
      previousRank: null,
      positionChange: null,
      totalPoints: st.totalPoints,
      firstPlaces: st.firstPlaces,
      gamesPlayed: st.gamesPlayed,
      qualifiedGamesPlayed: st.qualifiedGamesPlayed,
      averagePlacement,
      winRate,
      pointsPerQualifiedGame,
      participationRate,
      placementCounts: st.placementCounts,
      pointsByGame: st.pointsByGame,
    };
  });

  // Sort by: 1) Total points DESC, 2) First places DESC, 3) Average placement ASC, 4) Name ASC
  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
    if (a.averagePlacement !== null && b.averagePlacement !== null) {
      if (a.averagePlacement !== b.averagePlacement) {
        return a.averagePlacement - b.averagePlacement;
      }
    }
    return a.player.name.localeCompare(b.player.name);
  });

  // Assign competition ranks (ties on points + firstPlaces share the same rank)
  for (let i = 0; i < rows.length; i++) {
    if (
      i > 0 &&
      rows[i].totalPoints === rows[i - 1].totalPoints &&
      rows[i].firstPlaces === rows[i - 1].firstPlaces &&
      rows[i].qualifiedGamesPlayed > 0
    ) {
      rows[i].rank = rows[i - 1].rank;
    } else {
      rows[i].rank = i + 1;
    }
  }

  return rows;
}

export interface DailyPointsSeriesPoint {
  date: string;
  label: string;
  shortLabel: string;
  dailyByPlayer: Record<string, number>;
  cumulativeByPlayer: Record<string, number>;
  /**
   * League rank as of the end of `date` (from period start up to `date`).
   * Null if the player had 0 qualified games up to `date` (never interpolates fake ranks).
   */
  rankByPlayer: Record<string, number | null>;
}

/**
 * Computes the day-by-day time series for:
 * - 2.4 Points over time (Daily points & Cumulative points modes)
 * - 2.5 Position history (Bump chart with non-interpolated valid ranks)
 */
export function calculateTimeSeries(
  period: DatePeriod,
  submissions: Submission[],
  players: Player[],
  currentTodayDate: string = "2026-11-14"
): {
  series: DailyPointsSeriesPoint[];
  leadChangesCount: number;
  lastLeadChange: { date: string; newLeaderName: string; prevLeaderName: string } | null;
} {
  const dates = listDatesInRange(period.startDate, period.endDate);
  const dailyStandings = calculateAllDailyStandings(
    period.startDate,
    period.endDate,
    submissions,
    players,
    currentTodayDate
  );

  const runningTotals = new Map<string, number>();
  const runningFirsts = new Map<string, number>();
  const runningQualified = new Map<string, number>();

  for (const p of players) {
    runningTotals.set(p.id, 0);
    runningFirsts.set(p.id, 0);
    runningQualified.set(p.id, 0);
  }

  const series: DailyPointsSeriesPoint[] = [];
  let previousLeaderId: string | null = null;
  let leadChangesCount = 0;
  let lastLeadChange: { date: string; newLeaderName: string; prevLeaderName: string } | null = null;

  for (const date of dates) {
    const dayGames = dailyStandings.filter(
      (dg) => dg.leagueDate === date && dg.status === "Qualified"
    );

    const dailyByPlayer: Record<string, number> = {};
    const cumulativeByPlayer: Record<string, number> = {};
    const rankByPlayer: Record<string, number | null> = {};

    for (const p of players) {
      dailyByPlayer[p.id] = 0;
    }

    for (const dg of dayGames) {
      for (const r of dg.rankings) {
        dailyByPlayer[r.playerId] = (dailyByPlayer[r.playerId] || 0) + r.leaguePoints;
        runningTotals.set(r.playerId, (runningTotals.get(r.playerId) || 0) + r.leaguePoints);
        runningQualified.set(r.playerId, (runningQualified.get(r.playerId) || 0) + 1);
        if (r.placement === 1) {
          runningFirsts.set(r.playerId, (runningFirsts.get(r.playerId) || 0) + 1);
        }
      }
    }

    for (const p of players) {
      cumulativeByPlayer[p.id] = runningTotals.get(p.id) || 0;
    }

    // Rank only players who have participated in at least 1 qualified game up to this date
    const rankedCandidates = players
      .filter((p) => (runningQualified.get(p.id) || 0) > 0 && p.joinedAt <= date)
      .sort((a, b) => {
        const ptsDiff = (runningTotals.get(b.id) || 0) - (runningTotals.get(a.id) || 0);
        if (ptsDiff !== 0) return ptsDiff;
        const firstDiff = (runningFirsts.get(b.id) || 0) - (runningFirsts.get(a.id) || 0);
        if (firstDiff !== 0) return firstDiff;
        return a.name.localeCompare(b.name);
      });

    for (const p of players) {
      rankByPlayer[p.id] = null;
    }

    for (let i = 0; i < rankedCandidates.length; i++) {
      const p = rankedCandidates[i];
      if (
        i > 0 &&
        runningTotals.get(p.id) === runningTotals.get(rankedCandidates[i - 1].id) &&
        runningFirsts.get(p.id) === runningFirsts.get(rankedCandidates[i - 1].id)
      ) {
        rankByPlayer[p.id] = rankByPlayer[rankedCandidates[i - 1].id];
      } else {
        rankByPlayer[p.id] = i + 1;
      }
    }

    if (rankedCandidates.length > 0) {
      const currentLeader = rankedCandidates[0];
      if (previousLeaderId && previousLeaderId !== currentLeader.id) {
        leadChangesCount += 1;
        const prevPlayer = players.find((x) => x.id === previousLeaderId);
        lastLeadChange = {
          date,
          newLeaderName: currentLeader.name,
          prevLeaderName: prevPlayer?.name || "",
        };
      }
      previousLeaderId = currentLeader.id;
    }

    series.push({
      date,
      label: formatSingleDateShort(date),
      shortLabel: getWeekdayInitial(date),
      dailyByPlayer,
      cumulativeByPlayer,
      rankByPlayer,
    });
  }

  return { series, leadChangesCount, lastLeadChange };
}

export interface ActivityCalendarDay {
  date: string;
  label: string;
  totalSubmissions: number;
  activePlayers: number;
  qualifiedGames: number;
  excludedGames: number;
  totalLeaguePoints: number;
  dailyWinnerName: string | null;
  dailyWinnerPoints: number;
}

/**
 * Computes the Activity Calendar dataset (Section 2.8) for all dates in a window.
 */
export function calculateActivityCalendar(
  startDate: string,
  endDate: string,
  submissions: Submission[],
  players: Player[],
  currentTodayDate: string = "2026-11-14"
): ActivityCalendarDay[] {
  const dates = listDatesInRange(startDate, endDate);
  const dailyStandings = calculateAllDailyStandings(
    startDate,
    endDate,
    submissions,
    players,
    currentTodayDate
  );

  const playerMap = new Map(players.map((p) => [p.id, p]));

  return dates.map((date) => {
    const gamesForDay = dailyStandings.filter((dg) => dg.leagueDate === date);
    let totalSubmissions = 0;
    const activePlayerIds = new Set<string>();
    let qualifiedGames = 0;
    let excludedGames = 0;
    let totalLeaguePoints = 0;
    const pointsByPlayer = new Map<string, number>();

    for (const g of gamesForDay) {
      totalSubmissions += g.submissionCount;
      if (g.status === "Qualified") qualifiedGames += 1;
      if (g.status === "Excluded") excludedGames += 1;

      for (const r of g.rankings) {
        activePlayerIds.add(r.playerId);
        if (g.status === "Qualified") {
          totalLeaguePoints += r.leaguePoints;
          pointsByPlayer.set(
            r.playerId,
            (pointsByPlayer.get(r.playerId) || 0) + r.leaguePoints
          );
        }
      }
    }

    let dailyWinnerName: string | null = null;
    let dailyWinnerPoints = 0;

    for (const [pid, pts] of pointsByPlayer.entries()) {
      if (pts > dailyWinnerPoints) {
        dailyWinnerPoints = pts;
        dailyWinnerName = playerMap.get(pid)?.name || null;
      }
    }

    return {
      date,
      label: formatSingleDateShort(date),
      totalSubmissions,
      activePlayers: activePlayerIds.size,
      qualifiedGames,
      excludedGames,
      totalLeaguePoints,
      dailyWinnerName,
      dailyWinnerPoints,
    };
  });
}

export interface PlayerRecordItem {
  label: string;
  sublabel: string;
  value: string;
}

export interface PlayerGameStrengthRow {
  gameSlug: GameSlug;
  gameName: string;
  gameColor: string;
  played: number;
  qualifiedPlayed: number;
  firstPlaces: number;
  averagePlacement: number | null;
  bestResult: string;
  totalPoints: number;
}

/**
 * Calculates personal records (Section 4.3) and Game Strengths (Section 4.4)
 * for an individual player from actual database records.
 */
export function calculatePlayerProfileAnalytics(
  playerId: string,
  period: DatePeriod,
  allSubmissions: Submission[],
  players: Player[],
  currentTodayDate: string = "2026-11-14"
): {
  strengths: PlayerGameStrengthRow[];
  records: PlayerRecordItem[];
} {
  // 1. Game Strengths within selected period
  const periodStandings = calculateAllDailyStandings(
    period.startDate,
    period.endDate,
    allSubmissions,
    players,
    currentTodayDate
  );

  const strengths: PlayerGameStrengthRow[] = [];

  for (const slug of ACTIVE_GAME_SLUGS) {
    const game = GAMES[slug];
    const gameDays = periodStandings.filter((d) => d.gameSlug === slug);

    let played = 0;
    let qualifiedPlayed = 0;
    let firstPlaces = 0;
    let placementSum = 0;
    let totalPoints = 0;
    let bestSub: Submission | null = null;

    for (const gd of gameDays) {
      const entry = gd.rankings.find((r) => r.playerId === playerId);
      if (!entry) continue;

      played += 1;
      if (!bestSub || compareGameSubmissions(entry, bestSub) < 0) {
        bestSub = entry;
      }

      if (gd.status === "Qualified") {
        qualifiedPlayed += 1;
        placementSum += entry.placement;
        totalPoints += entry.leaguePoints;
        if (entry.placement === 1) firstPlaces += 1;
      }
    }

    if (played > 0) {
      strengths.push({
        gameSlug: slug,
        gameName: game.name,
        gameColor: game.color,
        played,
        qualifiedPlayed,
        firstPlaces,
        averagePlacement:
          qualifiedPlayed > 0 ? Math.round((placementSum / qualifiedPlayed) * 10) / 10 : null,
        bestResult: bestSub ? bestSub.displayResult : "–",
        totalPoints,
      });
    }
  }

  // Sort strengths by averagePlacement ASC (lower is better), then firstPlaces DESC
  strengths.sort((a, b) => {
    if (a.averagePlacement !== null && b.averagePlacement !== null) {
      if (a.averagePlacement !== b.averagePlacement) {
        return a.averagePlacement - b.averagePlacement;
      }
    } else if (a.averagePlacement !== null) {
      return -1;
    } else if (b.averagePlacement !== null) {
      return 1;
    }
    return b.firstPlaces - a.firstPlaces;
  });

  // 2. Personal Records across all available history
  const dates = allSubmissions.map((s) => s.leagueDate).sort();
  const minDate = dates[0] || period.startDate;
  const maxDate = dates[dates.length - 1] || period.endDate;

  const allDailyStandings = calculateAllDailyStandings(
    minDate,
    maxDate,
    allSubmissions,
    players,
    currentTodayDate
  );

  const dayPoints = new Map<string, number>();
  const dayWins = new Map<string, number>();

  let currentStreak = 0;
  let bestStreak = 0;
  let bestStreakStart = "";
  let bestStreakEnd = "";
  let tempStreakStart = "";

  // Sort qualified games chronologically for streak calculation
  const qualifiedChrono = allDailyStandings
    .filter((d) => d.status === "Qualified")
    .sort((a, b) => a.leagueDate.localeCompare(b.leagueDate));

  for (const qg of qualifiedChrono) {
    const r = qg.rankings.find((x) => x.playerId === playerId);
    if (!r) continue;

    dayPoints.set(qg.leagueDate, (dayPoints.get(qg.leagueDate) || 0) + r.leaguePoints);
    if (r.placement === 1) {
      dayWins.set(qg.leagueDate, (dayWins.get(qg.leagueDate) || 0) + 1);
      if (currentStreak === 0) tempStreakStart = qg.leagueDate;
      currentStreak += 1;
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
        bestStreakStart = tempStreakStart;
        bestStreakEnd = qg.leagueDate;
      }
    } else {
      currentStreak = 0;
    }
  }

  let bestDayDate = "";
  let bestDayPts = 0;
  for (const [dt, pts] of dayPoints.entries()) {
    if (pts > bestDayPts) {
      bestDayPts = pts;
      bestDayDate = dt;
    }
  }

  let bestWinsDate = "";
  let bestWinsCount = 0;
  for (const [dt, w] of dayWins.entries()) {
    if (w > bestWinsCount) {
      bestWinsCount = w;
      bestWinsDate = dt;
    }
  }

  // Rolling 7-day best week
  const allDatesList = listDatesInRange(minDate, maxDate);
  let bestWeekPts = 0;
  let bestWeekRange = "";
  for (let i = 0; i < allDatesList.length; i++) {
    const slice = allDatesList.slice(i, i + 7);
    const sum = slice.reduce((acc, d) => acc + (dayPoints.get(d) || 0), 0);
    if (sum > bestWeekPts) {
      bestWeekPts = sum;
      bestWeekRange = `${slice[0].slice(8, 10)}–${slice[slice.length - 1].slice(8, 10)} Nov`;
    }
  }

  // Best calendar month
  const monthPoints = new Map<string, number>();
  for (const [dt, pts] of dayPoints.entries()) {
    const ym = dt.slice(0, 7);
    monthPoints.set(ym, (monthPoints.get(ym) || 0) + pts);
  }
  let bestMonthYm = "";
  let bestMonthPts = 0;
  for (const [ym, pts] of monthPoints.entries()) {
    if (pts > bestMonthPts) {
      bestMonthPts = pts;
      bestMonthYm = ym;
    }
  }

  const records: PlayerRecordItem[] = [];
  if (bestDayPts > 0) {
    records.push({
      label: "Most points in one day",
      sublabel: formatSingleDateShort(bestDayDate),
      value: `${bestDayPts}`,
    });
  }
  if (bestWinsCount > 0) {
    records.push({
      label: "Most first places in one day",
      sublabel: formatSingleDateShort(bestWinsDate),
      value: `${bestWinsCount}`,
    });
  }
  if (bestWeekPts > 0) {
    records.push({
      label: "Best week",
      sublabel: bestWeekRange,
      value: `${bestWeekPts}`,
    });
  }
  if (bestMonthPts > 0) {
    const [y, m] = bestMonthYm.split("-").map(Number);
    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
      month: "long",
      timeZone: "UTC",
    });
    records.push({
      label: "Best month",
      sublabel: monthName,
      value: `${bestMonthPts}`,
    });
  }
  if (bestStreak >= 2) {
    records.push({
      label: "Longest winning streak",
      sublabel: `${formatSingleDateShort(bestStreakStart)} – ${formatSingleDateShort(
        bestStreakEnd
      )} (qualified games)`,
      value: `${bestStreak} games`,
    });
  }

  return { strengths, records };
}
