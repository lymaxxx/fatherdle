"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { DailyGameStanding, DatePeriod, GameSlug, PlayerStandingRow } from "@/lib/types";
import { APP_WORDMARK, GAMES, gameOf } from "@/lib/constants";
import { GAME_ICON } from "@/lib/game-icons";

import {
  CARD_H,
  CARD_W,
  DM,
  Op,
  SERIF,
  drawOps,
  leagueCurrentOps,
  leagueFinalOps,
  playerStatsOps,
  playerDayOps,
  groupDayOps,
  gameCardOps,
} from "@/lib/share-scene";
import type { GameStatsPanel } from "@/lib/analytics/game-stats";
import type { DailyPointsSeriesPoint, PlayerGameStrengthRow } from "@/lib/analytics/engine";
import type { LeagueWeek } from "@/lib/analytics/feed";

function playerNameSize(name: string): number {
  return Math.min(176, Math.floor(880 / Math.max(1, name.length * 0.6)));
}

/** Row layout for the player's day card: up to nine roomy rows, tighter single-line rows beyond that. */
function dayRowLayout(count: number) {
  const pitch = count <= 9 ? 76 : Math.floor(690 / count);
  const h = pitch - 8;
  const compact = h < 62;
  return {
    pitch,
    h,
    compact,
    nameFont: compact ? Math.min(24, Math.floor(h * 0.58)) : 26,
    resultFont: compact ? Math.min(40, Math.floor(h * 0.92)) : 50,
  };
}

function ordinalOf(n: number): string {
  return formatOrdinal(n);
}

function formatOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const plural = (n: number, w: string) => (n === 1 ? w : `${w}s`);

export function ShareCardModal({
  isOpen,
  onClose,
  mode,
  playerRow,
  allStandings,
  period,
  dayGames,
  week,
  dayStandings,
  gameStanding,
  gameStats,
  dailySeries,
  strengths,
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: "league" | "final" | "day" | "player" | "game";
  playerRow: PlayerStandingRow;
  allStandings: PlayerStandingRow[];
  period: DatePeriod;
  dayGames?: DailyGameStanding[];
  week?: LeagueWeek;
  dayStandings?: PlayerStandingRow[];
  gameStanding?: DailyGameStanding;
  gameStats?: GameStatsPanel;
  dailySeries?: DailyPointsSeriesPoint[];
  strengths?: PlayerGameStrengthRow[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [wholeDay, setWholeDay] = useState(false);

  if (!isOpen) return null;

  const leader = allStandings[0];
  const pointsBehind =
    leader && leader.player.id !== playerRow.player.id
      ? `${leader.totalPoints - playerRow.totalPoints} behind ${leader.player.name}`
      : "League leader";

  const posChangeText =
    playerRow.positionChange !== null && playerRow.positionChange !== 0
      ? playerRow.positionChange > 0
        ? `Up ${playerRow.positionChange} on last period`
        : `Down ${Math.abs(playerRow.positionChange)} on last period`
      : "No change on last period";

  const gamePointsEntries = (Object.entries(playerRow.pointsByGame) as Array<[GameSlug, number]>)
    .filter(([slug, pts]) => slug !== "custom" && pts > 0)
    .sort((a, b) => b[1] - a[1]);
  const bestGameName = gamePointsEntries[0]
    ? gameOf(gamePointsEntries[0][0]).name
    : "MapTap";

  const maxPts = Math.max(1, ...allStandings.map((r) => r.totalPoints));

  // One row per game this player submitted, with their place against the others.
  const dayRows = (dayGames ?? [])
    .map((g) => {
      const mine = g.rankings.find((r) => r.playerId === playerRow.player.id);
      if (!mine) return null;
      const top = g.rankings[0];
      return {
        key: g.gameSlug,
        game: gameOf(g.gameSlug),
        placement: mine.placement,
        outOf: g.submissionCount,
        result: mine.displayResult,
        points: mine.leaguePoints,
        counts: g.status === "Qualified",
        vs:
          mine.placement === 1
            ? "Best result today"
            : `${top.playerName} led · ${top.displayResult}`,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const dayLabel = new Date(`${period.endDate}T12:00:00Z`)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .toUpperCase();

  const gamesTotal = (dayGames ?? []).length;
  const longDate = new Date(`${period.endDate}T12:00:00Z`)
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(",", "")
    .toUpperCase();
  const rangeLabel = (period.preset === "all" ? "All time" : period.label).toUpperCase();
  const mineStrengths = strengths && strengths.length ? strengths : undefined;

  let sceneOps: Op[];
  if (mode === "game" && gameStanding) {
    const slug = gameStanding.gameSlug;
    const board = allStandings
      .map((r) => ({ name: r.player.name, color: r.player.color, pts: r.pointsByGame[slug] ?? 0 }))
      .filter((r) => r.pts > 0)
      .sort((x, y) => y.pts - x.pts);
    const topPts = Math.max(1, ...board.map((b) => b.pts));
    const k = gameStats?.kpis ?? [];
    const dist = gameStats?.distributions[0];
    const accent = GAME_ICON[slug]?.from ?? "#FFD93D";
    sceneOps = gameCardOps({
      name: gameOf(slug).name,
      slug,
      rangeLabel,
      kpis: [
        [String(gameStats?.results ?? 0), "results"],
        ...k.slice(0, 3).map((x) => [x.value, x.label] as [string, string]),
      ].slice(0, 4) as Array<[string, string]>,
      boardLabel: "League points in this game",
      leaderboard: board.map((r) => ({ name: r.name, color: r.color, value: String(r.pts), ratio: r.pts / topPts })),
      distributionLabel: dist?.title ?? "Spread",
      distribution: dist ? dist.bars.map((b) => ({ ...b, color: b.color ?? (/^(fail|x)$/i.test(b.label) ? "#FF5A1F" : accent) })) : null,
      footer: [
        ["Players", String(board.length)],
        ["Results", String(gameStats?.results ?? 0)],
        ["Range", rangeLabel.length > 14 ? rangeLabel.slice(0, 13) + "…" : rangeLabel],
      ],
    });
  } else if (mode === "day" && wholeDay) {
    const counted = (dayGames ?? []).filter((g) => g.status === "Qualified").length;
    const standings = dayStandings ?? [];
    sceneOps = groupDayOps({
      dateText: longDate,
      counted,
      pending: (dayGames ?? []).filter((g) => g.submissionCount > 0 && g.status !== "Qualified").length,
      pointsShared: standings.reduce((a, r) => a + r.totalPoints, 0),
      players: standings.map((r) => ({
        name: r.player.name,
        color: r.player.color,
        points: r.totalPoints,
        firstPlaces: r.firstPlaces,
        gamesPlayed: r.gamesPlayed,
        played: r.gamesPlayed > 0,
      })),
      games: (dayGames ?? []).map((g) => ({
        name: gameOf(g.gameSlug).name,
        slug: g.gameSlug,
        submitted: g.submissionCount,
        of: g.totalPlayers,
        counted: g.status === "Qualified",
        leader: g.rankings[0]?.playerName ?? "",
        result: g.rankings[0]?.displayResult ?? "",
      })),
    });
  } else if (mode === "day") {
    sceneOps = playerDayOps({
      name: playerRow.player.name,
      dateText: longDate,
      rank: playerRow.rank,
      points: playerRow.totalPoints,
      gamesTotal,
      rows: dayRows.map((r) => ({
        name: r.game.name,
        slug: r.key,
        placement: r.placement,
        outOf: r.outOf,
        points: r.points,
        counts: r.counts,
        result: r.result,
      })),
    });
  } else if (week && mode === "final") {
    sceneOps = leagueFinalOps(week);
  } else if (week && mode === "league") {
    sceneOps = leagueCurrentOps(week);
  } else {
    const byGame = new Map((mineStrengths ?? []).filter((x) => x.gameSlug).map((x) => [x.gameSlug as string, x]));
    const strengthsOk = !!mineStrengths && mineStrengths.some((x) => x.played > 0);
    sceneOps = playerStatsOps({
      name: playerRow.player.name,
      color: playerRow.player.color,
      rank: playerRow.rank,
      points: playerRow.totalPoints,
      qualifiedGames: playerRow.qualifiedGamesPlayed,
      firstPlaces: playerRow.firstPlaces,
      averagePlacement: playerRow.averagePlacement,
      positionChange: playerRow.positionChange,
      periodLabel: period.label,
      daily: (dailySeries ?? []).slice(-10).map((p) => ({
        label: new Date(`${p.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
        value: p.dailyByPlayer[playerRow.player.id] ?? 0,
      })),
      games: gamePointsEntries.map(([slug, pts]) => {
        const st = strengthsOk ? byGame.get(slug) : undefined;
        return {
          name: gameOf(slug).name,
          color: gameOf(slug).color,
          slug,
          points: pts,
          best: st?.bestResult || undefined,
          place: st?.averagePlacement ? ordinalOf(Math.round(st.averagePlacement)) : undefined,
        };
      }),
    });
  }

  const handleDownloadSvgCard = async (useWebShare = false) => {
    // Make sure the brand fonts are ready before painting to canvas.
    try {
      await Promise.all([
        document.fonts.load(`800 40px ${DM}`),
        document.fonts.load(`500 20px ${DM}`),
        document.fonts.load(`40px ${SERIF}`),
      ]);
    } catch {
      // fall back to system fonts
    }
    // Generate a 1080x1350 PNG using Canvas so the user gets a real 4:5 share image
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (sceneOps.length > 0) {
      drawOps(ctx, sceneOps);
    } else {
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // Header
      ctx.fillStyle = "#E6EB5E";
      ctx.beginPath();
      ctx.arc(67, 73, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#F4F1EA";
      ctx.letterSpacing = "3px";
      ctx.font = `800 22px ${DM}`;
      ctx.fillText(APP_WORDMARK, 92, 77);
      ctx.font = `700 22px ${DM}`;
      ctx.textAlign = "right";
      ctx.fillText(dayLabel, 1024, 77);
      ctx.textAlign = "left";

      // Lime hero
      ctx.fillStyle = "#E6EB5E";
      ctx.beginPath();
      ctx.roundRect(56, 110, 968, 420, 48);
      ctx.fill();

      ctx.fillStyle = "#121212";
      const nameSize = playerNameSize(playerRow.player.name);
      ctx.letterSpacing = `${Math.round((-7 * nameSize) / 176)}px`;
      ctx.font = `800 ${nameSize}px ${DM}`;
      ctx.fillText(playerRow.player.name, 96, 110 + 52 + 88);

      ctx.letterSpacing = "-3px";
      ctx.font = `96px ${SERIF}`;
      ctx.fillText(formatOrdinal(playerRow.rank), 100, 426);
      ctx.fillText(`${playerRow.totalPoints}`, 386, 426);
      ctx.fillText(`${dayRows.length}`, 676, 426);

      ctx.letterSpacing = "0px";
      ctx.font = `600 20px ${DM}`;
      ctx.fillText("League position", 104, 489);
      ctx.fillText("Points", 390, 489);
      ctx.fillText("Games played", 680, 489);

      // Game rows
      const layout = dayRowLayout(dayRows.length);
      dayRows.forEach((r, i) => {
        const y = 556 + i * layout.pitch;
        const { h, compact } = layout;
        const top = compact ? y + h / 2 : y + h * 0.32;
        const sub = y + h * 0.76;
        ctx.fillStyle = r.game.color;
        ctx.beginPath();
        ctx.roundRect(56, y, 968, h, 16);
        ctx.fill();

        ctx.fillStyle = "#121212";
        ctx.font = `800 ${layout.nameFont}px ${DM}`;
        ctx.fillText(r.game.name, 80, top);
        if (!compact) {
          ctx.font = `500 18px ${DM}`;
          ctx.fillStyle = "rgba(18,18,18,0.7)";
          ctx.fillText(r.vs, 80, sub);
        }

        ctx.textAlign = "right";
        ctx.fillStyle = "#121212";
        ctx.font = `${layout.resultFont}px ${SERIF}`;
        ctx.fillText(r.result, 813, y + h / 2);
        ctx.font = `800 ${layout.nameFont}px ${DM}`;
        ctx.fillText(
          compact
            ? `${formatOrdinal(r.placement)} of ${r.outOf} · ${r.counts ? `+${r.points}` : "–"}`
            : `${formatOrdinal(r.placement)} of ${r.outOf}`,
          1000,
          top
        );
        if (!compact) {
          ctx.font = `500 18px ${DM}`;
          ctx.fillStyle = "rgba(18,18,18,0.7)";
          ctx.fillText(r.counts ? `+${r.points} pts` : "Pending", 1000, sub);
        }
        ctx.textAlign = "left";
      });

      ctx.fillStyle = "#948F84";
      ctx.font = `500 22px ${DM}`;
      ctx.fillText("Pending games count once enough players have submitted.", 56, 1266);
    }

    const fileName = `fatherdle-${mode}-${week && (mode === "league" || mode === "final") ? week.startDate : period.endDate}.png`;
    const download = () => {
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    if (!useWebShare) {
      download();
      return;
    }
    canvas.toBlob(async (blob) => {
      const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Fatherdle" });
        } catch {
          // User cancelled the share sheet.
        }
      } else {
        download();
      }
    }, "image/png");
  };

  // Visual preview matching 9-share-card-league-1080x1350.png and 10-share-card-game-1080x1350.png
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-md flex flex-col gap-3">
        <div className="flex items-center justify-between text-text px-1">
          <span className="text-sm font-bold whitespace-nowrap">Share card · 4:5</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadSvgCard(true)}
              className="px-3.5 py-1.5 rounded-full border border-line text-text text-xs font-bold flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadSvgCard(false)}
              className="px-3.5 py-1.5 rounded-full bg-lime text-[#121212] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-surface text-muted hover:text-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {mode === "day" && (
          <div className="flex gap-2 justify-center">
            {[
              [false, "My day"],
              [true, "Whole day"],
            ].map(([v, l]) => (
              <button
                key={String(l)}
                type="button"
                onClick={() => setWholeDay(v as boolean)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                  wholeDay === v ? "bg-text text-[#121212]" : "border border-line text-muted"
                }`}
              >
                {l as string}
              </button>
            ))}
          </div>
        )}
        <ScaledCard>
          <SceneView ops={sceneOps} />
        </ScaledCard>
      </div>
    </div>
  );
}

type DayRow = {
  key: string;
  game: { name: string; color: string };
  placement: number;
  outOf: number;
  result: string;
  points: number;
  counts: boolean;
  vs: string;
};

/** Fits a fixed 1080x1350 card into whatever width the modal has. */
function ScaledCard({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CARD_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={wrapRef}
      style={{ height: CARD_H * scale }}
      className="w-full relative overflow-hidden rounded-[24px] shadow-2xl border border-line"
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Per-player daily card, laid out as in the design reference (1080x1350). */
/** Draws a list of share-card shapes and text as absolutely positioned elements. */
function SceneView({ ops }: { ops: Op[] }) {
  return (
    <div style={{ width: CARD_W, height: CARD_H, position: "relative", background: "#121212" }}>
      {ops.map((op, i) => {
        if (op.t === "rect") {
          const r = Array.isArray(op.r) ? op.r.map((n) => `${n}px`).join(" ") : op.r ? `${op.r}px` : 0;
          const meshBg = op.mesh
            ? [...op.mesh.map((c, i) => `radial-gradient(circle at ${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%, ${c} 0%, ${c}00 62%)`), op.fill].join(", ")
            : null;
          const background = meshBg ?? (op.halo
            ? `radial-gradient(ellipse at 50% 50%, ${op.halo[0]} 0%, ${op.halo[0]} 42%, ${op.halo[1]} 100%)`
            : op.grad
            ? `linear-gradient(90deg, ${op.grad[0]}, ${op.grad[1]})`
            : op.fill);
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: op.x, top: op.y, width: op.w, height: op.h, background, borderRadius: r,
                ...(op.stroke ? { boxShadow: `inset 0 0 0 1px ${op.stroke}` } : {}),
                ...(op.rot ? { transform: `rotate(${op.rot}deg)`, transformOrigin: `${op.pivot![0] - op.x}px ${op.pivot![1] - op.y}px` } : {}),
              }}
            />
          );
        }
        if (op.t === "circle") {
          return (
            <div
              key={i}
              style={{ position: "absolute", left: op.x, top: op.y, width: op.d, height: op.d, borderRadius: "50%", background: op.fill }}
            />
          );
        }
        if (op.t === "icon") {
          return (
            <svg
              key={i}
              viewBox="0 0 24 24"
              width={op.size}
              height={op.size}
              fill="none"
              stroke={op.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: op.x, top: op.y }}
            >
              {op.paths.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
          );
        }
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: op.x,
              top: op.top,
              width: op.align === "right" || op.align === "center" ? op.w : undefined,
              textAlign: op.align === "right" ? "right" : op.align === "center" ? "center" : "left",
              fontFamily: op.serif ? SERIF : DM,
              fontSize: op.size,
              lineHeight: `${op.lh}px`,
              fontWeight: op.weight,
              letterSpacing: op.ls ?? 0,
              color: op.color,
              whiteSpace: "nowrap",
              ...(op.rot ? { transform: `rotate(${op.rot}deg)`, transformOrigin: `${op.pivot![0] - op.x}px ${op.pivot![1] - op.top}px` } : {}),
            }}
          >
            {op.text}
          </div>
        );
      })}
    </div>
  );
}
