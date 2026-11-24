import { GameSlug, Player, Submission } from "../types";
import { GAMES } from "../constants";
import { compareGameSubmissions } from "./engine";
import { formatSingleDateShort, listDatesInRange } from "./dates";

export interface LeaderboardColumn {
  key: string;
  label: string;
  align: "left" | "right";
}

export interface DistributionBucket {
  label: string;
  count: number;
  isPeak: boolean;
}

export interface PlayerGameStats {
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerColor: string;
  played: number;
  wins: number;
  winRate: number;
  averageFormatted: string;
  averageNumeric: number;
  bestFormatted: string;
  extraMetricLabel?: string;
  extraMetricValue?: string;
}

export interface GameSpecificCallout {
  label: string;
  value: string;
  subtext: string;
}

export interface GameVisualisationData {
  gameSlug: GameSlug;
  distributionTitle: string;
  distributionSubtitle: string;
  distributionBuckets: DistributionBucket[];
  historySubtitle: string;
  axisStart: number;
  axisEnd: number;
  invertYAxis: boolean; // True when lower values are better so "up" = better
  historyPoints: Array<{
    date: string;
    label: string;
    valuesByPlayer: Record<string, number | null>;
  }>;
  playerStats: PlayerGameStats[];
  callouts: GameSpecificCallout[];
}

export interface GameAnalyticsModule {
  gameSlug: GameSlug;
  calculatePlayerStats(submissions: Submission[], players: Player[]): PlayerGameStats[];
  getLeaderboardColumns(): LeaderboardColumn[];
  getDistributionBuckets(submissions: Submission[]): {
    title: string;
    buckets: DistributionBucket[];
  };
  getCallouts(submissions: Submission[]): GameSpecificCallout[];
  buildVisualisationData(
    startDate: string,
    endDate: string,
    submissions: Submission[],
    players: Player[]
  ): GameVisualisationData;
}

function markPeakBuckets(
  raw: Array<{ label: string; count: number }>
): DistributionBucket[] {
  const max = Math.max(0, ...raw.map((b) => b.count));
  return raw.map((b) => ({
    ...b,
    isPeak: max > 0 && b.count === max,
  }));
}

export function createGameAnalyticsModule(gameSlug: GameSlug): GameAnalyticsModule {
  const game = GAMES[gameSlug] || GAMES.custom;

  const getLeaderboardColumns = (): LeaderboardColumn[] => {
    switch (gameSlug) {
      case "connections":
        return [
          { key: "player", label: "Player", align: "left" },
          { key: "result", label: "Mistakes", align: "right" },
          { key: "place", label: "Place", align: "right" },
          { key: "points", label: "Points", align: "right" },
        ];
      case "strands":
        return [
          { key: "player", label: "Player", align: "left" },
          { key: "result", label: "Hints", align: "right" },
          { key: "place", label: "Place", align: "right" },
          { key: "points", label: "Points", align: "right" },
        ];
      case "wordle":
      case "flagle":
      case "metrodle":
        return [
          { key: "player", label: "Player", align: "left" },
          { key: "result", label: "Attempts", align: "right" },
          { key: "place", label: "Place", align: "right" },
          { key: "points", label: "Points", align: "right" },
        ];
      case "huedle":
        return [
          { key: "player", label: "Player", align: "left" },
          { key: "result", label: "Moves", align: "right" },
          { key: "place", label: "Place", align: "right" },
          { key: "points", label: "Points", align: "right" },
        ];
      case "noillirk":
        return [
          { key: "player", label: "Player", align: "left" },
          { key: "result", label: "Altitude", align: "right" },
          { key: "place", label: "Place", align: "right" },
          { key: "points", label: "Points", align: "right" },
        ];
      case "poople":
        return [
          { key: "player", label: "Player", align: "left" },
          { key: "result", label: "Guesses", align: "right" },
          { key: "place", label: "Place", align: "right" },
          { key: "points", label: "Points", align: "right" },
        ];
      default:
        return [
          { key: "player", label: "Player", align: "left" },
          { key: "result", label: "Score", align: "right" },
          { key: "place", label: "Place", align: "right" },
          { key: "points", label: "Points", align: "right" },
        ];
    }
  };

  const getDistributionBuckets = (
    submissions: Submission[]
  ): { title: string; buckets: DistributionBucket[] } => {
    const gameSubs = submissions.filter((s) => s.gameSlug === gameSlug);

    switch (gameSlug) {
      case "connections": {
        const counts = [
          { label: "Perfect", count: gameSubs.filter((s) => !s.failed && s.primaryValue === 0).length },
          { label: "1 mistake", count: gameSubs.filter((s) => !s.failed && s.primaryValue === 1).length },
          { label: "2 mistakes", count: gameSubs.filter((s) => !s.failed && s.primaryValue === 2).length },
          { label: "3 mistakes", count: gameSubs.filter((s) => !s.failed && s.primaryValue >= 3).length },
          { label: "Failed", count: gameSubs.filter((s) => s.failed).length },
        ];
        return { title: "Mistakes distribution", buckets: markPeakBuckets(counts) };
      }

      case "geoguessr":
      case "flagcognito":
      case "flagments":
      case "whenography": {
        const ranges =
          gameSlug === "whenography"
            ? [
                { label: "<1,500", min: 0, max: 1499 },
                { label: "1,500–2,499", min: 1500, max: 2499 },
                { label: "2,500–3,499", min: 2500, max: 3499 },
                { label: "3,500+", min: 3500, max: 99999 },
              ]
            : gameSlug === "geoguessr"
            ? [
                { label: "<10,000", min: 0, max: 9999 },
                { label: "10,000–14,999", min: 10000, max: 14999 },
                { label: "15,000–19,999", min: 15000, max: 19999 },
                { label: "20,000+", min: 20000, max: 99999 },
              ]
            : gameSlug === "flagcognito"
            ? [
                { label: "<1,000", min: 0, max: 999 },
                { label: "1,000–1,999", min: 1000, max: 1999 },
                { label: "2,000–2,499", min: 2000, max: 2499 },
                { label: "2,500+", min: 2500, max: 99999 },
              ]
            : [
                { label: "<500", min: 0, max: 499 },
                { label: "500–699", min: 500, max: 699 },
                { label: "700–899", min: 700, max: 899 },
                { label: "900+", min: 900, max: 99999 },
              ];
        return {
          title: "Points distribution",
          buckets: markPeakBuckets(
            ranges.map((r) => ({
              label: r.label,
              count: gameSubs.filter((s) => s.primaryValue >= r.min && s.primaryValue <= r.max).length,
            }))
          ),
        };
      }

      case "strands": {
        const counts = [
          { label: "No hints", count: gameSubs.filter((s) => s.primaryValue === 0).length },
          { label: "1 hint", count: gameSubs.filter((s) => s.primaryValue === 1).length },
          { label: "2 hints", count: gameSubs.filter((s) => s.primaryValue === 2).length },
          { label: "3+ hints", count: gameSubs.filter((s) => s.primaryValue >= 3).length },
        ];
        return { title: "Hints distribution", buckets: markPeakBuckets(counts) };
      }

      case "wordle":
      case "flagle":
      case "metrodle": {
        const categories = ["1", "2", "3", "4", "5", "6", "X"];
        const counts = categories.map((cat) => {
          const c = gameSubs.filter((s) => {
            if (cat === "X") return s.failed;
            return !s.failed && Math.round(s.primaryValue) === Number(cat);
          }).length;
          return { label: cat === "X" ? "X/6" : `${cat}/6`, count: c };
        });
        return {
          title: "Attempts distribution",
          buckets: markPeakBuckets(counts),
        };
      }

      case "maptap": {
        const ranges = [
          { label: "800–849", min: 0, max: 849 },
          { label: "850–899", min: 850, max: 899 },
          { label: "900–949", min: 900, max: 949 },
          { label: "950–1000", min: 950, max: 1000 },
        ];
        return {
          title: "Score distribution",
          buckets: markPeakBuckets(
            ranges.map((r) => ({
              label: r.label,
              count: gameSubs.filter(
                (s) => s.primaryValue >= r.min && s.primaryValue <= r.max
              ).length,
            }))
          ),
        };
      }

      case "huedle": {
        const ranges = [
          { label: "20–34", min: 0, max: 34 },
          { label: "35–44", min: 35, max: 44 },
          { label: "45–54", min: 45, max: 54 },
          { label: "55+", min: 55, max: 999 },
        ];
        return {
          title: "Moves distribution",
          buckets: markPeakBuckets(
            ranges.map((r) => ({
              label: `${r.label} moves`,
              count: gameSubs.filter(
                (s) => s.primaryValue >= r.min && s.primaryValue <= r.max
              ).length,
            }))
          ),
        };
      }

      case "catfishing": {
        const ranges = [
          { label: "0–3/10", min: 0, max: 3.9 },
          { label: "4–5/10", min: 4, max: 5.9 },
          { label: "6–7/10", min: 6, max: 7.9 },
          { label: "8–10/10", min: 8, max: 10 },
        ];
        return {
          title: "Score distribution",
          buckets: markPeakBuckets(
            ranges.map((r) => ({
              label: r.label,
              count: gameSubs.filter(
                (s) => s.primaryValue >= r.min && s.primaryValue <= r.max
              ).length,
            }))
          ),
        };
      }

      case "krillion": {
        const ranges = [
          { label: "250–299", min: 0, max: 299 },
          { label: "300–329", min: 300, max: 329 },
          { label: "330–359", min: 330, max: 359 },
          { label: "360+", min: 360, max: 9999 },
        ];
        return {
          title: "Score distribution",
          buckets: markPeakBuckets(
            ranges.map((r) => ({
              label: r.label,
              count: gameSubs.filter(
                (s) => s.primaryValue >= r.min && s.primaryValue <= r.max
              ).length,
            }))
          ),
        };
      }

      case "noillirk": {
        const ranges = [
          { label: "<4,500m", min: 0, max: 4499 },
          { label: "4,500–5,249m", min: 4500, max: 5249 },
          { label: "5,250–5,999m", min: 5250, max: 5999 },
          { label: "6,000m+", min: 6000, max: 99999 },
        ];
        return {
          title: "Climb altitude distribution",
          buckets: markPeakBuckets(
            ranges.map((r) => ({
              label: r.label,
              count: gameSubs.filter(
                (s) => s.primaryValue >= r.min && s.primaryValue <= r.max
              ).length,
            }))
          ),
        };
      }

      case "poople": {
        const ranges = [
          { label: "≤5 (Par)", min: 1, max: 5 },
          { label: "6 (+1)", min: 6, max: 6 },
          { label: "7 (+2)", min: 7, max: 7 },
          { label: "8+ (+3+)", min: 8, max: 99 },
        ];
        return {
          title: "Guesses relative to par",
          buckets: markPeakBuckets(
            ranges.map((r) => ({
              label: r.label,
              count: gameSubs.filter(
                (s) => s.primaryValue >= r.min && s.primaryValue <= r.max
              ).length,
            }))
          ),
        };
      }

      case "wordishingrilliontapdle":
      default: {
        const ranges = [
          { label: "<8,500", min: 0, max: 8499 },
          { label: "8,500–9,499", min: 8500, max: 9499 },
          { label: "9,500–10,499", min: 9500, max: 10499 },
          { label: "10,500+", min: 10500, max: 999999 },
        ];
        return {
          title: "Points distribution",
          buckets: markPeakBuckets(
            ranges.map((r) => ({
              label: r.label,
              count: gameSubs.filter(
                (s) => s.primaryValue >= r.min && s.primaryValue <= r.max
              ).length,
            }))
          ),
        };
      }
    }
  };

  const calculatePlayerStats = (
    submissions: Submission[],
    players: Player[]
  ): PlayerGameStats[] => {
    const gameSubs = submissions.filter((s) => s.gameSlug === gameSlug);

    // Group by date to identify winners
    const byDate = new Map<string, Submission[]>();
    for (const s of gameSubs) {
      const list = byDate.get(s.leagueDate) || [];
      list.push(s);
      byDate.set(s.leagueDate, list);
    }

    const winCounts = new Map<string, number>();
    for (const dayList of byDate.values()) {
      const sorted = [...dayList].sort(compareGameSubmissions);
      if (sorted.length > 0) {
        const best = sorted[0];
        for (const s of sorted) {
          if (compareGameSubmissions(s, best) === 0) {
            winCounts.set(s.playerId, (winCounts.get(s.playerId) || 0) + 1);
          }
        }
      }
    }

    const stats: PlayerGameStats[] = [];

    for (const p of players) {
      const pSubs = gameSubs.filter((s) => s.playerId === p.id);
      if (pSubs.length === 0) continue;

      const validSubs = pSubs.filter((s) => !s.failed);
      const meanRaw =
        validSubs.length > 0
          ? validSubs.reduce((acc, s) => acc + s.primaryValue, 0) / validSubs.length
          : pSubs.reduce((acc, s) => acc + s.primaryValue, 0) / pSubs.length;

      const sortedBest = [...pSubs].sort(compareGameSubmissions);
      const bestSub = sortedBest[0];

      let averageFormatted = `${Math.round(meanRaw)}`;
      if (gameSlug === "wordle" || gameSlug === "flagle" || gameSlug === "metrodle") {
        averageFormatted = `${meanRaw.toFixed(1)}/6`;
      } else if (gameSlug === "connections") {
        averageFormatted = `${meanRaw.toFixed(1)} mistakes`;
      } else if (gameSlug === "strands") {
        averageFormatted = `${meanRaw.toFixed(1)} hints`;
      } else if (gameSlug === "huedle") {
        averageFormatted = `${Math.round(meanRaw)} moves`;
      } else if (gameSlug === "noillirk") {
        averageFormatted = `${Math.round(meanRaw).toLocaleString("en-GB")}m`;
      } else if (gameSlug === "catfishing") {
        averageFormatted = `${meanRaw.toFixed(1)}/10`;
      } else if (gameSlug === "poople") {
        averageFormatted = `${meanRaw.toFixed(1)}/5`;
      } else if (gameSlug === "wordishingrilliontapdle") {
        averageFormatted = `${Math.round(meanRaw).toLocaleString("en-GB")} pts`;
      }

      stats.push({
        playerId: p.id,
        playerName: p.name,
        playerSlug: p.slug,
        playerColor: p.color,
        played: pSubs.length,
        wins: winCounts.get(p.id) || 0,
        winRate: pSubs.length > 0 ? (winCounts.get(p.id) || 0) / pSubs.length : 0,
        averageFormatted,
        averageNumeric: meanRaw,
        bestFormatted: bestSub ? bestSub.displayResult : "–",
      });
    }

    stats.sort((a, b) => {
      if (game.rankingDirection === "lower") {
        return a.averageNumeric - b.averageNumeric;
      }
      return b.averageNumeric - a.averageNumeric;
    });

    return stats;
  };

  const getCallouts = (submissions: Submission[]): GameSpecificCallout[] => {
    const gameSubs = submissions.filter((s) => s.gameSlug === gameSlug);
    if (gameSubs.length === 0) return [];

    const validSubs = gameSubs.filter((s) => !s.failed);
    const mean =
      validSubs.length > 0
        ? validSubs.reduce((acc, s) => acc + s.primaryValue, 0) / validSubs.length
        : 0;
    const sorted = [...gameSubs].sort(compareGameSubmissions);
    const best = sorted[0];

    switch (gameSlug) {
      case "connections": {
        const solved = gameSubs.filter((s) => !s.failed).length;
        const perfect = gameSubs.filter((s) => !s.failed && s.primaryValue === 0).length;
        return [
          {
            label: "Perfect games",
            value: `${perfect}`,
            subtext: `${perfect} of ${gameSubs.length} with no mistakes`,
          },
          {
            label: "Group solve rate",
            value: `${Math.round((solved / gameSubs.length) * 100)}%`,
            subtext: `${solved} of ${gameSubs.length} solved`,
          },
          {
            label: "Best result",
            value: best ? best.displayResult : "–",
            subtext: "Fewest mistakes in period",
          },
        ];
      }

      case "strands": {
        const noHint = gameSubs.filter((s) => s.primaryValue === 0).length;
        const avgHints = gameSubs.reduce((acc, s) => acc + s.primaryValue, 0) / gameSubs.length;
        return [
          {
            label: "No-hint games",
            value: `${noHint}`,
            subtext: `${noHint} of ${gameSubs.length} solved without hints`,
          },
          {
            label: "Average hints",
            value: avgHints.toFixed(1),
            subtext: "Across all results in period",
          },
          {
            label: "Best result",
            value: best ? best.displayResult : "–",
            subtext: "Fewest hints in period",
          },
        ];
      }

      case "wordle":
      case "flagle":
      case "metrodle": {
        const solveCount = gameSubs.filter((s) => !s.failed).length;
        const solvePct = Math.round((solveCount / gameSubs.length) * 100);
        const threesOrBetter = gameSubs.filter((s) => !s.failed && s.primaryValue <= 3).length;
        return [
          {
            label: "Group solve rate",
            value: `${solvePct}%`,
            subtext: `${solveCount} of ${gameSubs.length} solved within 6 attempts`,
          },
          {
            label: "Average attempts",
            value: `${mean.toFixed(1)}/6`,
            subtext: `${threesOrBetter} solved in 3 or fewer attempts`,
          },
          {
            label: "Best result",
            value: best ? best.displayResult : "–",
            subtext: "Fastest solve in period",
          },
        ];
      }

      case "maptap": {
        let totalBullseyes = 0;
        for (const s of gameSubs) {
          try {
            const meta = JSON.parse(s.metadataJson);
            totalBullseyes += Number(meta.bullseyes || 0);
          } catch {
            // ignore
          }
        }
        return [
          {
            label: "Group average",
            value: `${Math.round(mean)}`,
            subtext: `Across ${gameSubs.length} submitted rounds`,
          },
          {
            label: "Best score",
            value: best ? best.displayResult : "–",
            subtext: "Out of 1,000 maximum points",
          },
          {
            label: "100🎯 bullseyes",
            value: `${totalBullseyes}`,
            subtext: "Perfect 100-point rounds hit by the group",
          },
        ];
      }

      case "huedle": {
        let starSum = 0;
        let starCount = 0;
        for (const s of gameSubs) {
          if (s.secondaryValue !== null) {
            starSum += s.secondaryValue;
            starCount += 1;
          }
        }
        return [
          {
            label: "Average moves",
            value: `${Math.round(mean)} moves`,
            subtext: "Lower move count ranks higher",
          },
          {
            label: "Best efficiency",
            value: best ? best.displayResult : "–",
            subtext: "Fewest moves in selected period",
          },
          {
            label: "Average ⭐ rating",
            value: starCount > 0 ? `${Math.round(starSum / starCount)} / 1000` : "–",
            subtext: "Huedle accuracy score",
          },
        ];
      }

      case "wordishingrilliontapdle": {
        let totalBullseyes = 0;
        let totalFish = 0;
        for (const s of gameSubs) {
          try {
            const meta = JSON.parse(s.metadataJson);
            totalBullseyes += Number(meta.bullseyes || 0);
            totalFish += Number(meta.fishTotal || 0);
          } catch {
            // ignore
          }
        }
        return [
          {
            label: "Average score",
            value: `${Math.round(mean).toLocaleString("en-GB")} pts`,
            subtext: "Combined word, fish & map points",
          },
          {
            label: "Highest score",
            value: best ? best.displayResult : "–",
            subtext: "Best single-game haul",
          },
          {
            label: "Bullseyes & fish",
            value: `${totalBullseyes}🎯 · ${totalFish}🐟`,
            subtext: "Bonus targets collected across rounds",
          },
        ];
      }

      default:
        return [
          {
            label: "Group average",
            value:
              gameSlug === "noillirk"
                ? `${Math.round(mean).toLocaleString("en-GB")}m`
                : gameSlug === "catfishing"
                ? `${mean.toFixed(1)}/10`
                : `${Math.round(mean)}`,
            subtext: `From ${gameSubs.length} submissions`,
          },
          {
            label: "Best result",
            value: best ? best.displayResult : "–",
            subtext:
              game.rankingDirection === "lower"
                ? "Lower result is better"
                : "Higher result is better",
          },
        ];
    }
  };

  const buildVisualisationData = (
    startDate: string,
    endDate: string,
    submissions: Submission[],
    players: Player[]
  ): GameVisualisationData => {
    const dates = listDatesInRange(startDate, endDate);
    const gameSubs = submissions.filter(
      (s) => s.gameSlug === gameSlug && s.leagueDate >= startDate && s.leagueDate <= endDate
    );

    const { title: distributionTitle, buckets: distributionBuckets } =
      getDistributionBuckets(gameSubs);
    const playerStats = calculatePlayerStats(gameSubs, players);
    const callouts = getCallouts(gameSubs);

    const allVals = gameSubs.map((s) => s.primaryValue);
    let axisStart = game.axisStart ?? 0;
    let axisEnd = 100;

    if (allVals.length > 0) {
      const minV = Math.min(...allVals);
      const maxV = Math.max(...allVals);
      if (gameSlug === "wordle" || gameSlug === "flagle" || gameSlug === "metrodle") {
        axisStart = 1;
        axisEnd = 6;
      } else if (gameSlug === "maptap") {
        axisStart = Math.min(820, Math.floor(minV / 50) * 50);
        axisEnd = 1000;
      } else {
        const pad = Math.max(1, Math.round((maxV - minV) * 0.15));
        axisStart = Math.max(0, minV - pad);
        axisEnd = maxV + pad;
      }
    }

    const historyPoints = dates.map((date) => {
      const valuesByPlayer: Record<string, number | null> = {};
      for (const p of players) {
        const sub = gameSubs.find((s) => s.leagueDate === date && s.playerId === p.id);
        valuesByPlayer[p.id] = sub ? sub.primaryValue : null;
      }
      return {
        date,
        label: formatSingleDateShort(date),
        valuesByPlayer,
      };
    });

    const directionText =
      game.rankingDirection === "lower" ? "lower is better" : "higher is better";

    return {
      gameSlug,
      distributionTitle,
      distributionSubtitle: `All results, ${startDate.slice(8, 10)}–${endDate.slice(8, 10)} Nov`,
      distributionBuckets,
      historySubtitle: `${game.unit} · ${directionText} · axis starts at ${axisStart.toLocaleString(
        "en-GB"
      )}`,
      axisStart,
      axisEnd,
      invertYAxis: game.rankingDirection === "lower",
      historyPoints,
      playerStats,
      callouts,
    };
  };

  return {
    gameSlug,
    calculatePlayerStats,
    getLeaderboardColumns,
    getDistributionBuckets,
    getCallouts,
    buildVisualisationData,
  };
}
