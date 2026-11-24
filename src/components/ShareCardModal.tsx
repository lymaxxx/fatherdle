"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { DailyGameStanding, DatePeriod, GameSlug, PlayerStandingRow } from "@/lib/types";
import { APP_WORDMARK, GAMES, gameOf } from "@/lib/constants";

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
  const sceneOps: Op[] =
    mode === "game" && gameStanding
      ? (() => {
          const slug = gameStanding.gameSlug;
          const rangeLabel = (period.preset === "all" ? "All time" : period.label).toUpperCase();
          const board = allStandings
            .map((r) => ({ name: r.player.name, color: r.player.color, pts: r.pointsByGame[slug] ?? 0 }))
            .filter((r) => r.pts > 0)
            .sort((x, y) => y.pts - x.pts);
          const k = gameStats?.kpis ?? [];
          const players = board.length;
          return gameCardOps({
            name: gameOf(slug).name,
            slug,
            rangeLabel,
            kpis: [
              [String(gameStats?.results ?? 0), "results"],
              [String(players), plural(players, "player")],
              ...k.slice(0, 2).map((x) => [x.value, x.label] as [string, string]),
            ].slice(0, 4) as Array<[string, string]>,
            leaderboard: board.map((r) => ({ name: r.name, color: r.color, result: `${r.pts} pts`, points: r.pts })),
            leaderboardLabel: "League points in this game",
            footer: [rangeLabel, `${gameStats?.results ?? 0} results`, "Fatherdle league"],
            distribution: gameStats?.distributions[0] ?? null,
          });
        })()
      : mode === "day" && wholeDay
      ? groupDayOps({
          dateLabel: dayLabel,
          counted: (dayGames ?? []).filter((g) => g.status === "Qualified").length,
          totalGames: gamesTotal,
          players: (dayStandings ?? []).map((r) => ({
            playerId: r.player.id,
            name: r.player.name,
            color: r.player.color,
            points: r.totalPoints,
            rank: r.rank,
            played: r.gamesPlayed > 0,
            gamesPlayed: r.gamesPlayed,
            qualifiedGames: r.qualifiedGamesPlayed,
            firstPlaces: r.firstPlaces,
          })),
          games: (dayGames ?? []).map((g) => ({
            name: gameOf(g.gameSlug).name,
            slug: g.gameSlug,
            submitted: g.submissionCount,
            of: g.totalPlayers,
            counted: g.status === "Qualified",
          })),
        })
      : mode === "day"
      ? playerDayOps({
          name: playerRow.player.name,
          dateLabel: dayLabel,
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
          })),
        })
      : week && mode === "final"
      ? leagueFinalOps(week)
      : week && mode === "league"
      ? leagueCurrentOps(week)
      : playerStatsOps({
          name: playerRow.player.name,
          color: playerRow.player.color,
          rank: playerRow.rank,
          points: playerRow.totalPoints,
          qualifiedGames: playerRow.qualifiedGamesPlayed,
          firstPlaces: playerRow.firstPlaces,
          averagePlacement: playerRow.averagePlacement,
          periodLabel: period.label,
          games: gamePointsEntries.map(([slug, pts]) => ({
            name: gameOf(slug).name,
            color: gameOf(slug).color,
            slug,
            points: pts,
          })),
        });

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
function DayCard({
  playerName,
  rank,
  points,
  dayLabel,
  rows,
}: {
  playerName: string;
  rank: number;
  points: number;
  dayLabel: string;
  rows: DayRow[];
}) {
  const abs = (style: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    whiteSpace: "nowrap",
    ...style,
  });
  const nameSize = playerNameSize(playerName);
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        background: "#121212",
        position: "relative",
        fontFamily: DM,
        color: "#121212",
      }}
    >
      <div style={abs({ left: 56, top: 62, width: 22, height: 22, borderRadius: "50%", background: "#E6EB5E" })} />
      <div style={abs({ left: 92, top: 62, fontSize: 22, fontWeight: 800, letterSpacing: 3, color: "#F4F1EA" })}>
        {APP_WORDMARK}
      </div>
      <div style={abs({ left: 624, top: 62, width: 400, textAlign: "right", fontSize: 22, fontWeight: 700, letterSpacing: 3, color: "#F4F1EA" })}>
        {dayLabel}
      </div>

      <div style={abs({ left: 56, top: 110, width: 968, height: 420, borderRadius: 48, background: "#E6EB5E", overflow: "hidden" })}>
        <div style={abs({ left: 40, top: 52, fontSize: nameSize, lineHeight: "176px", fontWeight: 800, letterSpacing: (-7 * nameSize) / 176 })}>
          {playerName}
        </div>
        {[
          { x: 44, v: formatOrdinal(rank), label: "League position" },
          { x: 330, v: `${points}`, label: "Points" },
          { x: 620, v: `${rows.length}`, label: "Games played" },
        ].map((m) => (
          <React.Fragment key={m.label}>
            <div style={abs({ left: m.x, top: 268, fontFamily: SERIF, fontSize: 96, lineHeight: "96px", letterSpacing: -3 })}>
              {m.v}
            </div>
            <div style={abs({ left: m.x + 4, top: 366, fontSize: 20, fontWeight: 600 })}>{m.label}</div>
          </React.Fragment>
        ))}
      </div>

      {rows.map((r, i) => {
        const layout = dayRowLayout(rows.length);
        const compact = layout.compact;
        return (
        <div
          key={r.key}
          style={{
            position: "absolute",
            left: 56,
            top: 556 + i * layout.pitch,
            width: 968,
            height: layout.h,
            borderRadius: 16,
            background: r.game.color,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 24px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: layout.nameFont, fontWeight: 800, whiteSpace: "nowrap" }}>{r.game.name}</div>
            {!compact && (
              <div style={{ fontSize: 18, fontWeight: 500, color: "#121212B3", marginTop: 2, whiteSpace: "nowrap" }}>
                {r.vs}
              </div>
            )}
          </div>
          <div style={{ width: 213, textAlign: "right", fontFamily: SERIF, fontSize: layout.resultFont, lineHeight: `${layout.resultFont}px`, whiteSpace: "nowrap" }}>
            {r.result}
          </div>
          <div style={{ width: 187, textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: layout.nameFont, fontWeight: 800, whiteSpace: "nowrap" }}>
              {formatOrdinal(r.placement)} of {r.outOf}
              {compact ? ` · ${r.counts ? `+${r.points}` : "–"}` : ""}
            </div>
            {!compact && (
              <div style={{ fontSize: 18, fontWeight: 500, color: "#121212B3", marginTop: 2 }}>
                {r.counts ? `+${r.points} pts` : "Pending"}
              </div>
            )}
          </div>
        </div>
        );
      })}

      <div style={abs({ left: 56, top: 1252, fontSize: 22, fontWeight: 500, color: "#948F84" })}>
        Pending games count once enough players have submitted.
      </div>
    </div>
  );
}

/** Draws a list of share-card shapes and text as absolutely positioned elements. */
function SceneView({ ops }: { ops: Op[] }) {
  return (
    <div style={{ width: CARD_W, height: CARD_H, position: "relative", background: "#121212" }}>
      {ops.map((op, i) => {
        if (op.t === "rect") {
          const r = Array.isArray(op.r) ? op.r.map((n) => `${n}px`).join(" ") : op.r ? `${op.r}px` : 0;
          const background = op.grad
            ? `linear-gradient(90deg, ${op.grad[0]}, ${op.grad[1]})`
            : op.fade
            ? `linear-gradient(180deg, ${op.fade} 0%, ${op.fill} 55%, ${op.fill} 100%)`
            : op.fill;
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: op.x, top: op.y, width: op.w, height: op.h, background, borderRadius: r,
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
              width: op.align === "right" ? op.w : undefined,
              textAlign: op.align === "right" ? "right" : "left",
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
