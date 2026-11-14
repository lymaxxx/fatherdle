"use client";

import React, { useMemo } from "react";
import { GameSlug, Player, PlayerStandingRow } from "@/lib/types";
import { DailyPointsSeriesPoint, ActivityCalendarDay } from "@/lib/analytics/engine";
import { GAMES, TOKENS } from "@/lib/constants";

/**
 * 2.4 Points Over Time (Multi-series SVG Line Chart)
 * Strictly separates Cumulative vs Daily points modes (never combined).
 */
export function PointsOverTimeChart({
  series,
  players,
  visiblePlayerIds,
  mode,
  highlightPlayerId,
  compareLeaderOnly = false,
}: {
  series: DailyPointsSeriesPoint[];
  players: Player[];
  visiblePlayerIds: string[];
  mode: "cumulative" | "daily";
  highlightPlayerId?: string;
  compareLeaderOnly?: boolean;
}) {
  const width = 620;
  const height = 225;
  const padLeft = 34;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const activePlayers = useMemo(() => {
    if (compareLeaderOnly && highlightPlayerId && series.length > 0) {
      const lastPt = series[series.length - 1];
      let leaderId = players[0]?.id;
      let maxPts = -1;
      for (const p of players) {
        const val = lastPt.cumulativeByPlayer[p.id] || 0;
        if (val > maxPts) {
          maxPts = val;
          leaderId = p.id;
        }
      }
      return players.filter((p) => p.id === highlightPlayerId || p.id === leaderId);
    }
    return players.filter((p) => visiblePlayerIds.includes(p.id));
  }, [players, visiblePlayerIds, compareLeaderOnly, highlightPlayerId, series]);

  const maxY = useMemo(() => {
    let m = 10;
    for (const pt of series) {
      for (const p of activePlayers) {
        const val =
          mode === "cumulative" ? pt.cumulativeByPlayer[p.id] || 0 : pt.dailyByPlayer[p.id] || 0;
        if (val > m) m = val;
      }
    }
    return Math.ceil(m / 10) * 10;
  }, [series, activePlayers, mode]);

  const yTicks = useMemo(() => {
    const step = Math.max(2, Math.round(maxY / 5));
    return [0, step, step * 2, step * 3, step * 4, maxY];
  }, [maxY]);

  if (series.length === 0) {
    return (
      <div className="h-[225px] flex items-center justify-center text-sm text-muted">
        No results in this period.
      </div>
    );
  }

  const getX = (idx: number) =>
    series.length === 1 ? padLeft + plotW / 2 : padLeft + (idx / (series.length - 1)) * plotW;

  const getY = (val: number) => padTop + plotH - (val / Math.max(1, maxY)) * plotH;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label={`Points over time (${mode})`}
      >
        {/* Gridlines & Y labels */}
        {yTicks.map((tick, idx) => {
          const y = getY(tick);
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke={TOKENS.line}
                strokeOpacity={0.55}
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill={TOKENS.muted}
                fontSize={11}
                fontFamily="DM Sans, sans-serif"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X Axis Date Labels */}
        {series.map((pt, idx) => {
          const showLabel =
            series.length <= 10 ||
            idx === 0 ||
            idx === series.length - 1 ||
            idx % Math.ceil(series.length / 6) === 0;
          if (!showLabel) return null;
          return (
            <text
              key={pt.date}
              x={getX(idx)}
              y={height - 6}
              textAnchor="middle"
              fill={TOKENS.muted}
              fontSize={11}
              fontFamily="DM Sans, sans-serif"
            >
              {pt.label}
            </text>
          );
        })}

        {/* Player Series Lines */}
        {activePlayers.map((player) => {
          const isGreyComparison =
            compareLeaderOnly && highlightPlayerId && player.id !== highlightPlayerId;
          const strokeColor = isGreyComparison ? "#6B6860" : player.color;
          const strokeWidth =
            highlightPlayerId && player.id === highlightPlayerId ? 3 : 2.25;

          const points = series.map((pt, idx) => {
            const val =
              mode === "cumulative"
                ? pt.cumulativeByPlayer[player.id] || 0
                : pt.dailyByPlayer[player.id] || 0;
            return { x: getX(idx), y: getY(val), val, label: pt.label };
          });

          const pathD = points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(" ");

          const lastPoint = points[points.length - 1];

          return (
            <g key={player.id}>
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {mode === "daily" ? (
                points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    fill={strokeColor}
                  >
                    <title>{`${player.name} (${p.label}): ${p.val} pts`}</title>
                  </circle>
                ))
              ) : (
                lastPoint && (
                  <circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r={4.5}
                    fill={strokeColor}
                  >
                    <title>{`${player.name}: ${lastPoint.val} pts`}</title>
                  </circle>
                )
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * 2.5 Position History Bump Chart
 * Rank 1 is at the top. Does not interpolate across null (unranked) dates.
 * Displays player names at the right end of each line matching `4-statistics-desktop.png`.
 */
export function PositionBumpChart({
  series,
  players,
  visiblePlayerIds,
  singlePlayerId,
}: {
  series: DailyPointsSeriesPoint[];
  players: Player[];
  visiblePlayerIds?: string[];
  singlePlayerId?: string;
}) {
  const width = 540;
  const height = 230;
  const padLeft = 28;
  const padRight = singlePlayerId ? 20 : 62;
  const padTop = 18;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxRank = Math.max(4, players.length);
  const rankTicks = Array.from({ length: maxRank }, (_, i) => i + 1);

  const displayPlayers = singlePlayerId
    ? players.filter((p) => p.id === singlePlayerId)
    : visiblePlayerIds
    ? players.filter((p) => visiblePlayerIds.includes(p.id))
    : players;

  const getX = (idx: number) =>
    series.length <= 1 ? padLeft + plotW / 2 : padLeft + (idx / (series.length - 1)) * plotW;

  const getY = (rank: number) =>
    padTop + ((rank - 1) / Math.max(1, maxRank - 1)) * plotH;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label="League position history bump chart"
      >
        {/* Horizontal rank lines */}
        {rankTicks.map((r) => {
          const y = getY(r);
          return (
            <g key={r}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke={TOKENS.line}
                strokeOpacity={0.5}
                strokeWidth={1}
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                fill={TOKENS.muted}
                fontSize={11}
                fontFamily="DM Sans, sans-serif"
              >
                {r}
              </text>
            </g>
          );
        })}

        {/* X Axis Date Labels */}
        {series.map((pt, idx) => {
          const showLabel =
            series.length <= 8 ||
            idx === 0 ||
            idx === series.length - 1 ||
            idx % Math.ceil(series.length / 6) === 0;
          if (!showLabel) return null;
          const dayNum = Number(pt.date.slice(8, 10));
          const labelText =
            idx === 0 || idx === series.length - 1
              ? `${dayNum} Nov`
              : `${dayNum}`;
          return (
            <text
              key={pt.date}
              x={getX(idx)}
              y={height - 6}
              textAnchor="middle"
              fill={TOKENS.muted}
              fontSize={11}
              fontFamily="DM Sans, sans-serif"
            >
              {labelText}
            </text>
          );
        })}

        {/* Bump lines and dots (breaking path when rank is null) */}
        {displayPlayers.map((player) => {
          const segments: Array<Array<{ x: number; y: number; rank: number; date: string }>> = [];
          let currentSeg: Array<{ x: number; y: number; rank: number; date: string }> = [];

          series.forEach((pt, idx) => {
            const r = pt.rankByPlayer[player.id];
            if (r === null || r === undefined) {
              if (currentSeg.length > 0) {
                segments.push(currentSeg);
                currentSeg = [];
              }
            } else {
              currentSeg.push({
                x: getX(idx),
                y: getY(r),
                rank: r,
                date: pt.label,
              });
            }
          });
          if (currentSeg.length > 0) segments.push(currentSeg);

          const lastSeg = segments[segments.length - 1];
          const lastPt = lastSeg ? lastSeg[lastSeg.length - 1] : null;

          return (
            <g key={player.id}>
              {segments.map((seg, sIdx) => {
                const d = seg
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                  .join(" ");
                return (
                  <path
                    key={sIdx}
                    d={d}
                    fill="none"
                    stroke={player.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}

              {segments.flat().map((p, pIdx) => (
                <circle
                  key={pIdx}
                  cx={p.x}
                  cy={p.y}
                  r={3.5}
                  fill={player.color}
                >
                  <title>{`${player.name} (${p.date}): #${p.rank}`}</title>
                </circle>
              ))}

              {!singlePlayerId && lastPt && (
                <text
                  x={width - padRight + 12}
                  y={lastPt.y + 4}
                  fill={player.color}
                  fontSize={12}
                  fontWeight={700}
                  fontFamily="DM Sans, sans-serif"
                >
                  {player.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * 2.6 Points Breakdown Stacked Horizontal Bars
 * Supports both "By player" (bars = players, segments = games) and "By game" (bars = games, segments = players).
 */
export function PointsBreakdownChart({
  standings,
  mode,
}: {
  standings: PlayerStandingRow[];
  mode: "by_player" | "by_game";
}) {
  const gameSlugs: GameSlug[] = [
    "wordle",
    "maptap",
    "krillion",
    "noillirk",
    "huedle",
    "flagle",
    "catfishing",
    "poople",
    "wordishingrilliontapdle",
  ];

  if (mode === "by_player") {
    const maxTotal = Math.max(1, ...standings.map((r) => r.totalPoints));

    return (
      <div className="flex flex-col gap-3.5">
        {standings.map((row) => {
          return (
            <div key={row.player.id} className="flex items-center gap-3">
              <div className="w-16 text-[13px] font-bold text-text truncate">
                {row.player.name}
              </div>
              <div className="flex-1 flex items-center gap-[2px] h-[22px]">
                {gameSlugs.map((slug) => {
                  const pts = row.pointsByGame[slug] || 0;
                  if (pts <= 0) return null;
                  const widthPct = (pts / maxTotal) * 100;
                  const game = GAMES[slug];
                  return (
                    <div
                      key={slug}
                      style={{
                        width: `${Math.max(2.5, widthPct)}%`,
                        backgroundColor: game.color,
                      }}
                      className="h-full first:rounded-l-[4px] last:rounded-r-[4px] transition-all"
                      title={`${row.player.name} · ${game.name}: ${pts} pts`}
                    />
                  );
                })}
              </div>
              <div className="w-9 text-right text-[13px] font-bold text-text tabular-nums">
                {row.totalPoints}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 pt-2">
          {gameSlugs.map((slug) => {
            const totalForGame = standings.reduce(
              (acc, r) => acc + (r.pointsByGame[slug] || 0),
              0
            );
            if (totalForGame <= 0) return null;
            const g = GAMES[slug];
            return (
              <div key={slug} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span
                  className="w-2 h-2 rounded-[2px] inline-block"
                  style={{ backgroundColor: g.color }}
                />
                <span>{g.shortName}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mode: "by_game"
  const gameTotals = gameSlugs
    .map((slug) => {
      const segments = standings.map((r) => ({
        player: r.player,
        points: r.pointsByGame[slug] || 0,
      }));
      const total = segments.reduce((acc, s) => acc + s.points, 0);
      return {
        game: GAMES[slug],
        total,
        segments,
      };
    })
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);

  const maxGameTotal = Math.max(1, ...gameTotals.map((g) => g.total));

  return (
    <div className="flex flex-col gap-3">
      {gameTotals.map((item) => (
        <div key={item.game.slug} className="flex items-center gap-3">
          <div className="w-20 text-[13px] font-bold text-text truncate">
            {item.game.shortName}
          </div>
          <div className="flex-1 flex items-center gap-[2px] h-[22px]">
            {item.segments.map((seg) => {
              if (seg.points <= 0) return null;
              const widthPct = (seg.points / maxGameTotal) * 100;
              return (
                <div
                  key={seg.player.id}
                  style={{
                    width: `${Math.max(2.5, widthPct)}%`,
                    backgroundColor: seg.player.color,
                  }}
                  className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
                  title={`${item.game.name} · ${seg.player.name}: ${seg.points} pts`}
                />
              );
            })}
          </div>
          <div className="w-9 text-right text-[13px] font-bold text-text tabular-nums">
            {item.total}
          </div>
        </div>
      ))}

      {/* Player Legend */}
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 pt-2">
        {standings.map((r) => (
          <div key={r.player.id} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span
              className="w-2 h-2 rounded-[2px] inline-block"
              style={{ backgroundColor: r.player.color }}
            />
            <span>{r.player.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 2.8 Activity Calendar Heatmap
 * Uses the exact lime alpha levels specified in DESIGN_HANDOFF.md:
 * `#2A2A27`, then `#E6EB5E` at 20%, 40%, 60%, 80%, 100% alpha.
 */
export function ActivityCalendarHeatmap({
  days,
  metric,
  selectedDate,
  onSelectDate,
}: {
  days: ActivityCalendarDay[];
  metric: "submissions" | "players" | "points";
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const values = days.map((d) =>
    metric === "submissions"
      ? d.totalSubmissions
      : metric === "players"
      ? d.activePlayers
      : d.totalLeaguePoints
  );
  const positive = values.filter((v) => v > 0);
  const maxVal = Math.max(1, ...positive);
  const minVal = positive.length ? Math.min(...positive) : 0;

  // 0 stays the empty surface colour; the rest spreads across min..max in five lime steps
  // so a busy-but-even group still shows a visible gradient.
  const ALPHAS = [0.2, 0.4, 0.6, 0.8, 1];
  const getCellBg = (val: number) => {
    if (val <= 0) return "#2A2A27";
    const span = maxVal - minVal;
    const step = span === 0 ? 4 : Math.min(4, Math.floor(((val - minVal) / span) * 5));
    return `rgba(230, 235, 94, ${ALPHAS[step]})`;
  };

  // Align to Monday-first weekday columns.
  const firstDow = days.length ? (new Date(`${days[0].date}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;

  return (
    <div className="w-fit">
      <div className="grid grid-cols-7 gap-[6px] mb-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="w-[30px] text-center text-[10px] font-semibold text-muted">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[6px]">
        {Array.from({ length: firstDow }).map((_, i) => (
          <span key={`pad-${i}`} className="w-[30px] h-[30px]" />
        ))}
        {days.map((day, idx) => {
          const val = values[idx];
          const isSelected = day.date === selectedDate;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              style={{ backgroundColor: getCellBg(val) }}
              className={`w-[30px] h-[30px] rounded-[7px] transition-transform hover:scale-110 ${
                isSelected ? "ring-2 ring-text ring-offset-2 ring-offset-surface" : ""
              }`}
              title={`${day.label}: ${val} ${metric}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted font-semibold">
        <span>Less</span>
        {ALPHAS.map((a) => (
          <span
            key={a}
            style={{ backgroundColor: `rgba(230, 235, 94, ${a})` }}
            className="w-3 h-3 rounded-[3px]"
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/**
 * 5.4 Individual Game Historical Performance Line Chart
 * Respects `invertYAxis` so lower-is-better games (Wordle, Flagdle, Huedle, Poople)
 * plot better results higher up on the chart.
 */
export function GameHistoryChart({
  historyPoints,
  players,
  visiblePlayerIds,
  axisStart,
  axisEnd,
  invertYAxis,
  unit,
}: {
  historyPoints: Array<{
    date: string;
    label: string;
    valuesByPlayer: Record<string, number | null>;
  }>;
  players: Player[];
  visiblePlayerIds: string[];
  axisStart: number;
  axisEnd: number;
  invertYAxis: boolean;
  unit: string;
}) {
  const width = 560;
  const height = 210;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const span = Math.max(1, axisEnd - axisStart);
  const ticks = [
    axisStart,
    Math.round(axisStart + span * 0.33),
    Math.round(axisStart + span * 0.66),
    axisEnd,
  ];

  const getX = (idx: number) =>
    historyPoints.length <= 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (historyPoints.length - 1)) * plotW;

  const getY = (val: number) => {
    const clamped = Math.max(axisStart, Math.min(axisEnd, val));
    const norm = (clamped - axisStart) / span;
    return invertYAxis ? padTop + norm * plotH : padTop + plotH - norm * plotH;
  };

  const activePlayers = players.filter((p) => visiblePlayerIds.includes(p.id));

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label="Game historical performance"
      >
        {ticks.map((t, idx) => {
          const y = getY(t);
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke={TOKENS.line}
                strokeOpacity={0.5}
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill={TOKENS.muted}
                fontSize={11}
                fontFamily="DM Sans, sans-serif"
              >
                {t.toLocaleString("en-GB")}
              </text>
            </g>
          );
        })}

        {historyPoints.map((pt, idx) => {
          const show =
            historyPoints.length <= 8 ||
            idx === 0 ||
            idx === historyPoints.length - 1 ||
            idx % Math.ceil(historyPoints.length / 6) === 0;
          if (!show) return null;
          return (
            <text
              key={pt.date}
              x={getX(idx)}
              y={height - 6}
              textAnchor="middle"
              fill={TOKENS.muted}
              fontSize={11}
              fontFamily="DM Sans, sans-serif"
            >
              {pt.label}
            </text>
          );
        })}

        {activePlayers.map((player) => {
          const pts: Array<{ x: number; y: number; val: number; label: string }> = [];
          historyPoints.forEach((hp, idx) => {
            const v = hp.valuesByPlayer[player.id];
            if (v !== null && v !== undefined) {
              pts.push({ x: getX(idx), y: getY(v), val: v, label: hp.label });
            }
          });
          if (pts.length === 0) return null;

          const pathD = pts
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(" ");
          const last = pts[pts.length - 1];

          return (
            <g key={player.id}>
              <path
                d={pathD}
                fill="none"
                stroke={player.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={last.x} cy={last.y} r={4.5} fill={player.color}>
                <title>{`${player.name} (${last.label}): ${last.val} ${unit}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
