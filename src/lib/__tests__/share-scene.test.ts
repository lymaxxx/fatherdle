import { describe, it, expect } from "vitest";
import { leagueCurrentOps, leagueFinalOps } from "../share-scene";
import type { LeagueWeek } from "../analytics/feed";

const row = (name: string, points: number, rank: number) => ({
  playerId: name,
  name,
  color: "#E6EB5E",
  points,
  rank,
  played: true,
  gamesPlayed: 5,
  qualifiedGames: 5,
  firstPlaces: 1,
});

const week = (standings: LeagueWeek["standings"]): LeagueWeek => ({
  startDate: "2026-11-16",
  endDate: "2026-11-22",
  label: "16–22 Nov",
  final: false,
  daysPlayed: 7,
  daysElapsed: 7,
  gamesCounted: 30,
  leadChanges: 1,
  standings,
});

/** Widths of the player bars (full-height 10px-radius rectangles at x=56), in order. */
const barWidths = (ops: ReturnType<typeof leagueCurrentOps>) =>
  ops.filter((o) => o.t === "rect" && o.x === 56 && o.r === 10).map((o) => (o as { w: number }).w);

describe("league share card bars", () => {
  it("never gives a lower score a longer bar, even when the name is longer", () => {
    const ops = leagueCurrentOps(
      week([row("Lochy", 68, 1), row("Duncan", 66, 2), row("Max", 53, 3), row("Peter", 43, 4), row("Adam", 10, 5), row("Ahmed", 5, 6)])
    );
    const w = barWidths(ops);
    expect(w).toHaveLength(6);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThanOrEqual(w[i - 1]);
  });

  it("gives tied scores the same width", () => {
    const w = barWidths(leagueCurrentOps(week([row("Lochy", 40, 1), row("Alexander", 6, 2), row("Al", 6, 2)])));
    expect(w[1]).toBe(w[2]);
  });

  it("applies the same rule to the remaining players on the final card", () => {
    const ops = leagueFinalOps(
      week([row("A", 50, 1), row("B", 40, 2), row("C", 30, 3), row("Sam", 10, 4), row("Ahmed", 5, 5), row("Jo", 4, 6)])
    );
    const w = barWidths(ops);
    expect(w).toHaveLength(3);
    expect(w[0]).toBeGreaterThanOrEqual(w[1]);
    expect(w[1]).toBeGreaterThanOrEqual(w[2]);
  });
});
