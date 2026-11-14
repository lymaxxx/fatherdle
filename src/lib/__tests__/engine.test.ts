import { describe, it, expect } from "vitest";
import { Player, Submission } from "../types";
import {
  calculateDailyGameStanding,
  calculateLeagueStandings,
  calculateTimeSeries,
} from "../analytics/engine";
import { resolveDatePeriod, getLondonDateString } from "../analytics/dates";
import { generateAutomaticInsights } from "../analytics/insights";
import { createGameAnalyticsModule } from "../analytics/game-modules";

const TEST_PLAYERS: Player[] = [
  { id: "p1", slug: "chris", name: "Chris", color: "#E6EB5E", avatarInitials: "C", joinedAt: "2026-10-01" },
  { id: "p2", slug: "alex", name: "Alex", color: "#FF8A3D", avatarInitials: "A", joinedAt: "2026-10-01" },
  { id: "p3", slug: "maya", name: "Maya", color: "#E3CDBE", avatarInitials: "M", joinedAt: "2026-10-01" },
  { id: "p4", slug: "sam", name: "Sam", color: "#6FA8DC", avatarInitials: "S", joinedAt: "2026-10-01" },
  { id: "p5", slug: "jo", name: "Jo", color: "#8A8C45", avatarInitials: "J", joinedAt: "2026-10-01" },
  { id: "p6", slug: "dan", name: "Dan", color: "#F2A7C3", avatarInitials: "D", joinedAt: "2026-11-12" }, // Joined mid-week
];

function makeSub(
  overrides: Partial<Submission> & {
    playerId: string;
    gameSlug: Submission["gameSlug"];
    leagueDate: string;
    primaryValue: number;
  }
): Submission {
  return {
    id: `sub_${overrides.leagueDate}_${overrides.gameSlug}_${overrides.playerId}`,
    puzzleId: "#1",
    rawText: "test",
    secondaryValue: null,
    tertiaryValue: null,
    displayResult: String(overrides.primaryValue),
    failed: false,
    metadataJson: "{}",
    submittedAt: `${overrides.leagueDate}T12:00:00Z`,
    isLate: false,
    isCorrected: false,
    ...overrides,
  };
}

describe("League Scoring, Qualification & Metric Calculations (Section 11)", () => {
  it("handles shared first places and multiple identical results using standard competition ranking", () => {
    const subs: Submission[] = [
      makeSub({ playerId: "p1", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 3 }),
      makeSub({ playerId: "p2", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 3 }), // Tied 1st
      makeSub({ playerId: "p3", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 4 }), // 3rd place
      makeSub({ playerId: "p4", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 4 }), // Tied 3rd place
      makeSub({ playerId: "p5", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 6 }), // 5th place
    ];

    const standing = calculateDailyGameStanding(
      "wordle",
      "2026-11-10",
      subs,
      TEST_PLAYERS,
      "2026-11-14"
    );

    expect(standing.status).toBe("Qualified");
    expect(standing.rankings.map((r) => ({ id: r.playerId, place: r.placement, pts: r.leaguePoints }))).toEqual([
      { id: "p2", place: 1, pts: 5 }, // Alex (alphabetical tie order, shared 1st = 5 pts)
      { id: "p1", place: 1, pts: 5 }, // Chris (shared 1st = 5 pts)
      { id: "p3", place: 3, pts: 3 }, // Maya (3rd = 3 pts)
      { id: "p4", place: 3, pts: 3 }, // Sam (3rd = 3 pts)
      { id: "p5", place: 5, pts: 1 }, // Jo (5th = 1 pt)
    ]);
  });

  it("distinguishes Pending (today < 4) vs Excluded (past < 4) and awards 0 league points while keeping game leaderboard", () => {
    const twoSubsPast: Submission[] = [
      makeSub({ playerId: "p1", gameSlug: "maptap", leagueDate: "2026-11-10", primaryValue: 960 }),
      makeSub({ playerId: "p2", gameSlug: "maptap", leagueDate: "2026-11-10", primaryValue: 910 }),
    ];

    const pastStanding = calculateDailyGameStanding(
      "maptap",
      "2026-11-10",
      twoSubsPast,
      TEST_PLAYERS,
      "2026-11-14"
    );
    expect(pastStanding.status).toBe("Excluded");
    expect(pastStanding.isFinalised).toBe(true);
    expect(pastStanding.rankings[0].placement).toBe(1);
    expect(pastStanding.rankings[0].leaguePoints).toBe(0);

    const twoSubsToday: Submission[] = [
      makeSub({ playerId: "p1", gameSlug: "maptap", leagueDate: "2026-11-14", primaryValue: 960 }),
      makeSub({ playerId: "p2", gameSlug: "maptap", leagueDate: "2026-11-14", primaryValue: 910 }),
    ];
    const todayStanding = calculateDailyGameStanding(
      "maptap",
      "2026-11-14",
      twoSubsToday,
      TEST_PLAYERS,
      "2026-11-14"
    );
    expect(todayStanding.status).toBe("Pending");
    expect(todayStanding.isFinalised).toBe(false);
    expect(todayStanding.rankings[0].leaguePoints).toBe(0);
  });

  it("does not penalise points-per-qualified-game or win rate when a player participates in an Excluded game", () => {
    const subs: Submission[] = [
      // Qualified game (4 players): p1 wins (4 pts)
      makeSub({ playerId: "p1", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 2 }),
      makeSub({ playerId: "p2", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 3 }),
      makeSub({ playerId: "p3", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 4 }),
      makeSub({ playerId: "p4", gameSlug: "wordle", leagueDate: "2026-11-10", primaryValue: 5 }),
      // Excluded game (2 players): p1 comes 2nd
      makeSub({ playerId: "p1", gameSlug: "krillion", leagueDate: "2026-11-10", primaryValue: 250 }),
      makeSub({ playerId: "p2", gameSlug: "krillion", leagueDate: "2026-11-10", primaryValue: 340 }),
    ];

    const period = resolveDatePeriod("week", "2026-11-14");
    const rows = calculateLeagueStandings(period, subs, TEST_PLAYERS, "2026-11-14");
    const p1Row = rows.find((r) => r.player.id === "p1")!;

    expect(p1Row.gamesPlayed).toBe(2); // 2 total submitted
    expect(p1Row.qualifiedGamesPlayed).toBe(1); // Only 1 qualified
    expect(p1Row.totalPoints).toBe(4);
    expect(p1Row.pointsPerQualifiedGame).toBe(4); // Not diluted by the excluded game
    expect(p1Row.winRate).toBe(1); // 1 win in 1 qualified game
  });

  it("does not interpolate bump chart ranks before a player has joined or played a qualified game", () => {
    const subs: Submission[] = [
      // On 2026-11-08: p1, p2, p3, p4 play
      makeSub({ playerId: "p1", gameSlug: "wordle", leagueDate: "2026-11-08", primaryValue: 2 }),
      makeSub({ playerId: "p2", gameSlug: "wordle", leagueDate: "2026-11-08", primaryValue: 3 }),
      makeSub({ playerId: "p3", gameSlug: "wordle", leagueDate: "2026-11-08", primaryValue: 4 }),
      makeSub({ playerId: "p4", gameSlug: "wordle", leagueDate: "2026-11-08", primaryValue: 5 }),
      // On 2026-11-12: p6 (Dan) joins and plays
      makeSub({ playerId: "p1", gameSlug: "wordle", leagueDate: "2026-11-12", primaryValue: 3 }),
      makeSub({ playerId: "p2", gameSlug: "wordle", leagueDate: "2026-11-12", primaryValue: 4 }),
      makeSub({ playerId: "p3", gameSlug: "wordle", leagueDate: "2026-11-12", primaryValue: 5 }),
      makeSub({ playerId: "p6", gameSlug: "wordle", leagueDate: "2026-11-12", primaryValue: 2 }),
    ];

    const period = resolveDatePeriod("week", "2026-11-14");
    const { series } = calculateTimeSeries(period, subs, TEST_PLAYERS, "2026-11-14");

    const nov8 = series.find((d) => d.date === "2026-11-08")!;
    const nov12 = series.find((d) => d.date === "2026-11-12")!;

    expect(nov8.rankByPlayer["p6"]).toBeNull(); // Dan had not joined/played on Nov 8
    expect(nov12.rankByPlayer["p6"]).not.toBeNull(); // Ranked once he played on Nov 12
  });

  it("calculates position changes between equivalent periods and handles empty periods cleanly", () => {
    const emptyPeriod = resolveDatePeriod("today", "2026-11-14");
    const emptyRows = calculateLeagueStandings(emptyPeriod, [], TEST_PLAYERS, "2026-11-14");
    expect(emptyRows).toHaveLength(6);
    expect(emptyRows.every((r) => r.totalPoints === 0 && r.positionChange === null)).toBe(true);

    // Previous week (1-7 Nov): p2 is 1st, p1 is 2nd
    // Current week (8-14 Nov): p1 is 1st, p2 is 2nd
    const subs: Submission[] = [
      makeSub({ playerId: "p2", gameSlug: "maptap", leagueDate: "2026-11-05", primaryValue: 980 }),
      makeSub({ playerId: "p1", gameSlug: "maptap", leagueDate: "2026-11-05", primaryValue: 940 }),
      makeSub({ playerId: "p3", gameSlug: "maptap", leagueDate: "2026-11-05", primaryValue: 900 }),
      makeSub({ playerId: "p4", gameSlug: "maptap", leagueDate: "2026-11-05", primaryValue: 860 }),

      makeSub({ playerId: "p1", gameSlug: "maptap", leagueDate: "2026-11-12", primaryValue: 990 }),
      makeSub({ playerId: "p2", gameSlug: "maptap", leagueDate: "2026-11-12", primaryValue: 950 }),
      makeSub({ playerId: "p3", gameSlug: "maptap", leagueDate: "2026-11-12", primaryValue: 910 }),
      makeSub({ playerId: "p4", gameSlug: "maptap", leagueDate: "2026-11-12", primaryValue: 870 }),
    ];

    const weekPeriod = resolveDatePeriod("week", "2026-11-14");
    const standings = calculateLeagueStandings(weekPeriod, subs, TEST_PLAYERS, "2026-11-14");

    const chris = standings.find((r) => r.player.id === "p1")!;
    const alex = standings.find((r) => r.player.id === "p2")!;

    expect(chris.rank).toBe(1);
    expect(chris.previousRank).toBe(2);
    expect(chris.positionChange).toBe(1); // +1 place gained

    expect(alex.rank).toBe(2);
    expect(alex.previousRank).toBe(1);
    expect(alex.positionChange).toBe(-1); // -1 place dropped
  });

  it("handles Europe/London BST/GMT daylight saving boundaries accurately", () => {
    // UK switches from BST (UTC+1) to GMT (UTC+0) on the last Sunday of October (25 Oct 2026)
    const bstLateNight = new Date("2026-10-24T23:30:00Z"); // 00:30 BST on 25 Oct in London!
    expect(getLondonDateString(bstLateNight)).toBe("2026-10-25");

    const gmtLateNight = new Date("2026-11-14T23:30:00Z"); // 23:30 GMT on 14 Nov in London
    expect(getLondonDateString(gmtLateNight)).toBe("2026-11-14");
  });

  it("respects ranking direction in GameAnalyticsModule (lower is better for Huedle/Wordle, higher is better for Wordishingrilliontapdle)", () => {
    const huedleMod = createGameAnalyticsModule("huedle");
    const huedleViz = huedleMod.buildVisualisationData(
      "2026-11-08",
      "2026-11-14",
      [
        makeSub({ playerId: "p1", gameSlug: "huedle", leagueDate: "2026-11-10", primaryValue: 32, displayResult: "32 moves" }),
        makeSub({ playerId: "p2", gameSlug: "huedle", leagueDate: "2026-11-10", primaryValue: 57, displayResult: "57 moves" }),
      ],
      TEST_PLAYERS
    );
    expect(huedleViz.invertYAxis).toBe(true);
    expect(huedleViz.playerStats[0].playerId).toBe("p1"); // 32 moves beats 57 moves

    const wordishMod = createGameAnalyticsModule("wordishingrilliontapdle");
    const wordishViz = wordishMod.buildVisualisationData(
      "2026-11-08",
      "2026-11-14",
      [
        makeSub({ playerId: "p1", gameSlug: "wordishingrilliontapdle", leagueDate: "2026-11-10", primaryValue: 9200, displayResult: "9,200 pts" }),
        makeSub({ playerId: "p2", gameSlug: "wordishingrilliontapdle", leagueDate: "2026-11-10", primaryValue: 10857, displayResult: "10,857 pts" }),
      ],
      TEST_PLAYERS
    );
    expect(wordishViz.invertYAxis).toBe(false);
    expect(wordishViz.playerStats[0].playerId).toBe("p2"); // 10,857 pts beats 9,200 pts
  });
});
