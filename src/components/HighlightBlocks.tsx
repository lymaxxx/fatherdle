"use client";

import React from "react";
import { Share2 } from "lucide-react";
import { DatePeriod, GameSlug, PlayerStandingRow } from "@/lib/types";
import { DailyPointsSeriesPoint } from "@/lib/analytics/engine";
import { GAMES, gameOf } from "@/lib/constants";

function formatOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function HighlightBlocks({
  playerRow,
  allStandings,
  period,
  series,
  onShare,
  isPlayerPage = false,
}: {
  playerRow: PlayerStandingRow;
  allStandings: PlayerStandingRow[];
  period: DatePeriod;
  series: DailyPointsSeriesPoint[];
  onShare: () => void;
  isPlayerPage?: boolean;
}) {
  const leader = allStandings[0];
  const pointsBehind =
    leader && leader.player.id !== playerRow.player.id
      ? `${leader.totalPoints - playerRow.totalPoints} behind ${leader.player.name}`
      : allStandings.length > 1
      ? `${playerRow.totalPoints - allStandings[1].totalPoints} ahead of ${allStandings[1].player.name}`
      : "League leader";

  const posChangeText =
    playerRow.positionChange !== null
      ? playerRow.positionChange > 0
        ? `up ${playerRow.positionChange} on last ${period.preset === "today" ? "day" : "period"}`
        : playerRow.positionChange < 0
        ? `down ${Math.abs(playerRow.positionChange)} on last ${
            period.preset === "today" ? "day" : "period"
          }`
        : "same position as last period"
      : "current standing";

  // Placement counts
  const { first, second, third, fourthPlus } = playerRow.placementCounts;
  const maxPlaceCount = Math.max(1, first, second, third, fourthPlus);

  // Best game and points per game for this player
  const gamePointsEntries = (Object.entries(playerRow.pointsByGame) as Array<[GameSlug, number]>)
    .filter(([slug, pts]) => slug !== "custom" && pts > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const bestGameSlug = gamePointsEntries[0]?.[0] || "maptap";
  const bestGame = gameOf(bestGameSlug);
  const maxGamePts = Math.max(1, ...(gamePointsEntries.map((e) => e[1]) || [1]));

  // Points per day (last 7 days of the selected series)
  const recentDays = series.slice(-7);
  const dailyVals = recentDays.map((d) => ({
    date: d.date,
    initial: d.shortLabel,
    pts: d.dailyByPlayer[playerRow.player.id] || 0,
  }));
  const maxDailyPts = Math.max(1, ...dailyVals.map((d) => d.pts));

  const periodHeader = isPlayerPage
    ? `THIS ${period.preset.toUpperCase()} · ${period.label.toUpperCase()}`
    : `YOUR ${period.preset.toUpperCase()} · ${period.label.toUpperCase()}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. LIME HERO BLOCK */}
      <div className="bg-lime text-[#121212] rounded-[22px] p-5 flex flex-col justify-between min-h-[290px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold tracking-[0.1em] uppercase">
            {periodHeader}
          </span>
          <button
            type="button"
            onClick={onShare}
            className="bg-[#121212] text-text text-[12px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>

        <div className="my-2">
          <div className="font-serif text-[76px] leading-[0.9] tracking-tight">
            {formatOrdinal(playerRow.rank)}
          </div>
          <div className="text-[13px] font-bold mt-1">
            League position · {posChangeText}
          </div>

          <div className="font-serif text-[72px] leading-[0.95] tracking-tight mt-3">
            {playerRow.totalPoints}
          </div>
          <div className="text-[13px] font-bold mt-0.5">
            Points · {pointsBehind}
          </div>
        </div>

        <div className="text-[12px] font-semibold opacity-90 pt-2 border-t border-black/10">
          {playerRow.firstPlaces} first {playerRow.firstPlaces === 1 ? "place" : "places"} ·{" "}
          {playerRow.qualifiedGamesPlayed} qualified games played
        </div>
      </div>

      {/* 2. PINK PLACEMENT BLOCK */}
      <div className="bg-pink text-[#121212] rounded-[22px] p-5 flex flex-col justify-between min-h-[290px]">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.1em] uppercase">
            PLACEMENT
          </div>
          <div className="font-serif text-[64px] leading-[0.95] mt-2">
            {playerRow.averagePlacement !== null
              ? playerRow.averagePlacement.toFixed(1)
              : "–"}
          </div>
          <div className="text-[12px] font-semibold mt-1">
            average place, lower is better
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-bold mb-2">
            Games finished in each place
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { label: "1st", val: first, bg: "#FF8A3D", text: "#121212" },
              { label: "2nd", val: second, bg: "#121212", text: "#F4F1EA" },
              { label: "3rd", val: third, bg: "#121212", text: "#F4F1EA" },
              { label: "4th+", val: fourthPlus, bg: "#121212", text: "#F4F1EA" },
            ].map((row) => {
              const wPct = Math.max(22, (row.val / maxPlaceCount) * 100);
              return (
                <div
                  key={row.label}
                  style={{ width: `${wPct}%`, backgroundColor: row.bg, color: row.text }}
                  className="h-[28px] px-2.5 rounded-[4px] flex items-center justify-between text-[12px] font-bold tabular-nums"
                >
                  <span>{row.label}</span>
                  <span className="font-serif text-[16px]">{row.val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. BEST GAME BLOCK */}
      <div className="bg-surface text-text rounded-[22px] p-5 flex flex-col justify-between min-h-[290px] border border-line/40">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-muted">
            BEST GAME
          </div>
          <div className="font-serif text-[58px] leading-[0.98] mt-2 truncate">
            {bestGame.name}
          </div>
          <div className="text-[12px] text-muted mt-1">
            Points earned by game in {period.label}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-4">
          {gamePointsEntries.map(([slug, pts]) => {
            const g = gameOf(slug);
            const wPct = Math.max(28, (pts / maxGamePts) * 100);
            return (
              <div
                key={slug}
                style={{ width: `${wPct}%`, backgroundColor: g.color, color: "#121212" }}
                className="h-[28px] px-2.5 rounded-[4px] flex items-center justify-between text-[12px] font-bold tabular-nums"
              >
                <span className="truncate pr-2">{g.shortName}</span>
                <span className="font-serif text-[16px]">{pts}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. CREAM POINTS PER DAY BLOCK */}
      <div className="bg-cream text-[#121212] rounded-[22px] p-5 flex flex-col justify-between min-h-[290px]">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.1em] uppercase">
            POINTS PER DAY
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-serif text-[64px] leading-[0.95]">
              {playerRow.totalPoints}
            </span>
            <span className="text-[13px] font-bold">
              points in {period.label}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-[120px] flex items-end justify-between gap-2 pt-5">
            {dailyVals.map((d) => {
              const isPeak = d.pts > 0 && d.pts === maxDailyPts;
              const hPct = Math.max(12, (d.pts / maxDailyPts) * 100);
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center h-full justify-end"
                >
                  <span className="text-[12px] font-bold mb-1 tabular-nums">
                    {d.pts}
                  </span>
                  <div
                    style={{
                      height: `${hPct}%`,
                      backgroundColor: isPeak ? "#FF8A3D" : "#121212",
                    }}
                    className="w-full rounded-t-[6px] rounded-b-[4px] transition-all"
                  />
                  <span className="text-[10px] font-bold text-[#66635B] mt-1.5">
                    {d.initial}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] font-semibold text-[#66635B] mt-1">
            {period.label}
          </div>
        </div>
      </div>
    </div>
  );
}
