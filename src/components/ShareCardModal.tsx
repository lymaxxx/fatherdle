"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { DailyGameStanding, DatePeriod, GameSlug, PlayerStandingRow } from "@/lib/types";
import { APP_WORDMARK, GAMES } from "@/lib/constants";

const DM = '"DM Sans", system-ui, sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';
const CARD_W = 1080;
const CARD_H = 1350;

function playerNameSize(name: string): number {
  return Math.min(176, Math.floor(880 / Math.max(1, name.length * 0.6)));
}

function formatOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ShareCardModal({
  isOpen,
  onClose,
  mode,
  playerRow,
  allStandings,
  period,
  dayGames,
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: "league" | "day";
  playerRow: PlayerStandingRow;
  allStandings: PlayerStandingRow[];
  period: DatePeriod;
  dayGames?: DailyGameStanding[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);

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
    ? GAMES[gamePointsEntries[0][0]].name
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
        game: GAMES[g.gameSlug],
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

    if (mode === "league") {
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, 1080, 1350);

      // Header
      ctx.fillStyle = "#E6EB5E";
      ctx.beginPath();
      ctx.arc(68, 72, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#F4F1EA";
      ctx.font = `bold 22px ${DM}`;
      ctx.fillText(APP_WORDMARK, 94, 80);
      ctx.textAlign = "right";
      ctx.fillText(period.label.toUpperCase(), 1020, 80);
      ctx.textAlign = "left";

      // Lime Hero Card
      ctx.fillStyle = "#E6EB5E";
      ctx.beginPath();
      ctx.roundRect(54, 120, 972, 480, 42);
      ctx.fill();

      ctx.fillStyle = "#121212";
      ctx.font = `bold 22px ${DM}`;
      ctx.fillText(
        `${playerRow.player.name.toUpperCase()} · THIS ${period.preset.toUpperCase()}`,
        104,
        185
      );

      ctx.font = `190px ${SERIF}`;
      ctx.fillText(formatOrdinal(playerRow.rank), 100, 390);
      ctx.fillText(`${playerRow.totalPoints}`, 620, 390);

      ctx.font = `bold 26px ${DM}`;
      ctx.fillText("League position", 104, 480);
      ctx.fillText(posChangeText, 104, 516);
      ctx.fillText("Points", 620, 480);
      ctx.fillText(pointsBehind, 620, 516);

      // Standings bars
      let y = 650;
      allStandings.slice(0, 6).forEach((row) => {
        const barW = Math.max(260, (row.totalPoints / maxPts) * 972);
        ctx.fillStyle = row.player.color;
        ctx.beginPath();
        ctx.roundRect(54, y, barW, 56, 12);
        ctx.fill();

        ctx.fillStyle = "#121212";
        ctx.font = `bold 24px ${DM}`;
        const label =
          row.player.id === playerRow.player.id
            ? `${row.player.name} (you)`
            : row.player.name;
        ctx.fillText(label, 78, y + 36);

        ctx.textAlign = "right";
        ctx.font = `42px ${SERIF}`;
        ctx.fillText(`${row.totalPoints}`, 54 + barW - 22, y + 42);
        ctx.textAlign = "left";
        y += 70;
      });

      // Footer stats
      ctx.strokeStyle = "#3A3935";
      ctx.beginPath();
      ctx.moveTo(54, 1110);
      ctx.lineTo(1026, 1110);
      ctx.stroke();

      ctx.fillStyle = "#F4F1EA";
      ctx.font = `96px ${SERIF}`;
      ctx.fillText(`${playerRow.firstPlaces}`, 54, 1225);
      ctx.fillText(`${playerRow.qualifiedGamesPlayed}`, 340, 1225);
      ctx.fillText(bestGameName, 620, 1225);

      ctx.fillStyle = "#948F84";
      ctx.font = `24px ${DM}`;
      ctx.fillText("first places", 54, 1270);
      ctx.fillText("games played", 340, 1270);
      ctx.fillText("best game", 620, 1270);
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
      dayRows.forEach((r, i) => {
        const y = 556 + i * 76;
        ctx.fillStyle = r.game.color;
        ctx.beginPath();
        ctx.roundRect(56, y, 968, 68, 16);
        ctx.fill();

        ctx.fillStyle = "#121212";
        ctx.font = `800 26px ${DM}`;
        ctx.fillText(r.game.name, 80, y + 22);
        ctx.font = `500 18px ${DM}`;
        ctx.fillStyle = "rgba(18,18,18,0.7)";
        ctx.fillText(r.vs, 80, y + 52);

        ctx.textAlign = "right";
        ctx.fillStyle = "#121212";
        ctx.font = `50px ${SERIF}`;
        ctx.fillText(r.result, 813, y + 34);
        ctx.font = `800 26px ${DM}`;
        ctx.fillText(`${formatOrdinal(r.placement)} of ${r.outOf}`, 1000, y + 22);
        ctx.font = `500 18px ${DM}`;
        ctx.fillStyle = "rgba(18,18,18,0.7)";
        ctx.fillText(r.counts ? `+${r.points} pts` : "Pending", 1000, y + 52);
        ctx.textAlign = "left";
      });

      ctx.fillStyle = "#948F84";
      ctx.font = `500 22px ${DM}`;
      ctx.fillText("Pending games count once enough players have submitted.", 56, 1266);
    }

    const fileName = `fatherdle-${mode}-${period.endDate}.png`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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

        {mode === "league" ? (
          <div
            ref={cardRef}
            className="bg-bg border border-line rounded-[28px] p-6 flex flex-col justify-between aspect-[4/5] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.14em] text-text">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-lime" />
                <span>{APP_WORDMARK}</span>
              </div>
              <span>{period.label.toUpperCase()}</span>
            </div>

            {/* Lime hero */}
            <div className="bg-lime text-[#121212] rounded-[22px] p-5 my-3">
              <div className="text-[10px] font-extrabold tracking-[0.12em] uppercase">
                {playerRow.player.name.toUpperCase()} · THIS {period.preset.toUpperCase()}
              </div>
              <div className="grid grid-cols-2 gap-3 my-2">
                <div>
                  <div className="font-serif text-[68px] leading-[0.9]">
                    {formatOrdinal(playerRow.rank)}
                  </div>
                  <div className="text-[11px] font-bold mt-1">
                    League position
                    <br />
                    {posChangeText}
                  </div>
                </div>
                <div>
                  <div className="font-serif text-[68px] leading-[0.9]">
                    {playerRow.totalPoints}
                  </div>
                  <div className="text-[11px] font-bold mt-1">
                    Points
                    <br />
                    {pointsBehind}
                  </div>
                </div>
              </div>
            </div>

            {/* Standings bars */}
            <div className="space-y-1.5 my-1">
              {allStandings.slice(0, 6).map((r) => {
                const wPct = Math.max(28, (r.totalPoints / maxPts) * 100);
                const isMe = r.player.id === playerRow.player.id;
                return (
                  <div
                    key={r.player.id}
                    style={{ width: `${wPct}%`, backgroundColor: r.player.color }}
                    className="h-[30px] rounded-[6px] px-3 flex items-center justify-between text-[#121212]"
                  >
                    <span className="text-[12px] font-extrabold truncate">
                      {r.player.name}
                      {isMe ? " (you)" : ""}
                    </span>
                    <span className="font-serif text-[20px] leading-none">
                      {r.totalPoints}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line/60">
              <div>
                <div className="font-serif text-[36px] leading-none text-text">
                  {playerRow.firstPlaces}
                </div>
                <div className="text-[11px] text-muted mt-1">first places</div>
              </div>
              <div>
                <div className="font-serif text-[36px] leading-none text-text">
                  {playerRow.qualifiedGamesPlayed}
                </div>
                <div className="text-[11px] text-muted mt-1">games played</div>
              </div>
              <div>
                <div className="font-serif text-[32px] leading-none text-sand truncate">
                  {bestGameName}
                </div>
                <div className="text-[11px] text-muted mt-1">best game</div>
              </div>
            </div>
          </div>
        ) : (
          <ScaledCard>
            <DayCard
              playerName={playerRow.player.name}
              rank={playerRow.rank}
              points={playerRow.totalPoints}
              dayLabel={dayLabel}
              rows={dayRows}
            />
          </ScaledCard>
        )}
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

      {rows.map((r, i) => (
        <div
          key={r.key}
          style={{
            position: "absolute",
            left: 56,
            top: 556 + i * 76,
            width: 968,
            height: 68,
            borderRadius: 16,
            background: r.game.color,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 24px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, whiteSpace: "nowrap" }}>{r.game.name}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#121212B3", marginTop: 2, whiteSpace: "nowrap" }}>
              {r.vs}
            </div>
          </div>
          <div style={{ width: 213, textAlign: "right", fontFamily: SERIF, fontSize: 50, lineHeight: "50px", whiteSpace: "nowrap" }}>
            {r.result}
          </div>
          <div style={{ width: 187, textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, whiteSpace: "nowrap" }}>
              {formatOrdinal(r.placement)} of {r.outOf}
            </div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#121212B3", marginTop: 2 }}>
              {r.counts ? `+${r.points} pts` : "Pending"}
            </div>
          </div>
        </div>
      ))}

      <div style={abs({ left: 56, top: 1252, fontSize: 22, fontWeight: 500, color: "#948F84" })}>
        Pending games count once enough players have submitted.
      </div>
    </div>
  );
}
