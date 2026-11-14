"use client";

import React, { useRef } from "react";
import { Download, Share2, X } from "lucide-react";
import { DailyGameStanding, DatePeriod, GameSlug, PlayerStandingRow } from "@/lib/types";
import { APP_WORDMARK, GAMES } from "@/lib/constants";

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

  const handleDownloadSvgCard = (useWebShare = false) => {
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
      ctx.font = "bold 22px sans-serif";
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
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(
        `${playerRow.player.name.toUpperCase()} · THIS ${period.preset.toUpperCase()}`,
        104,
        185
      );

      ctx.font = "190px Georgia, serif";
      ctx.fillText(formatOrdinal(playerRow.rank), 100, 390);
      ctx.fillText(`${playerRow.totalPoints}`, 620, 390);

      ctx.font = "bold 26px sans-serif";
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
        ctx.font = "bold 24px sans-serif";
        const label =
          row.player.id === playerRow.player.id
            ? `${row.player.name} (you)`
            : row.player.name;
        ctx.fillText(label, 78, y + 36);

        ctx.textAlign = "right";
        ctx.font = "42px Georgia, serif";
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
      ctx.font = "96px Georgia, serif";
      ctx.fillText(`${playerRow.firstPlaces}`, 54, 1225);
      ctx.fillText(`${playerRow.qualifiedGamesPlayed}`, 340, 1225);
      ctx.fillText(bestGameName, 620, 1225);

      ctx.fillStyle = "#948F84";
      ctx.font = "24px sans-serif";
      ctx.fillText("first places", 54, 1270);
      ctx.fillText("games played", 340, 1270);
      ctx.fillText("best game", 620, 1270);
    } else {
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, 1080, 1350);

      ctx.fillStyle = "#E6EB5E";
      ctx.beginPath();
      ctx.arc(68, 72, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#F4F1EA";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(APP_WORDMARK, 94, 80);
      ctx.textAlign = "right";
      ctx.fillText(dayLabel, 1020, 80);
      ctx.textAlign = "left";

      // Player summary
      ctx.fillStyle = playerRow.player.color;
      ctx.beginPath();
      ctx.arc(68, 150, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#F4F1EA";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(`${playerRow.player.name.toUpperCase()} · TODAY`, 90, 160);

      ctx.font = "150px Georgia, serif";
      ctx.fillText(formatOrdinal(playerRow.rank), 54, 300);
      ctx.fillText(`${playerRow.totalPoints}`, 420, 300);
      ctx.fillStyle = "#948F84";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("League position today", 58, 340);
      ctx.fillText("Points today", 424, 340);
      ctx.textAlign = "right";
      ctx.fillText(`${dayRows.length} game${dayRows.length === 1 ? "" : "s"} played`, 1026, 340);
      ctx.textAlign = "left";

      const rowH = Math.min(100, Math.floor(920 / Math.max(1, dayRows.length)) - 6);
      let y = 380;
      dayRows.forEach((r) => {
        ctx.fillStyle = r.game.color;
        ctx.beginPath();
        ctx.roundRect(54, y, 972, rowH, 16);
        ctx.fill();

        ctx.fillStyle = "#121212";
        ctx.font = "bold 30px sans-serif";
        ctx.fillText(r.game.name, 80, y + rowH / 2 - 4);
        ctx.font = "22px sans-serif";
        ctx.globalAlpha = 0.7;
        ctx.fillText(r.vs, 80, y + rowH / 2 + 26);
        ctx.globalAlpha = 1;

        ctx.textAlign = "right";
        ctx.font = "50px Georgia, serif";
        ctx.fillText(r.result, 760, y + rowH / 2 + 16);
        ctx.font = "bold 30px sans-serif";
        ctx.fillText(`${formatOrdinal(r.placement)} of ${r.outOf}`, 1000, y + rowH / 2 - 4);
        ctx.font = "22px sans-serif";
        ctx.globalAlpha = 0.7;
        ctx.fillText(r.counts ? `+${r.points} pts` : "Pending", 1000, y + rowH / 2 + 26);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
        y += rowH + 8;
      });
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
          <div
            ref={cardRef}
            className="bg-bg border border-line rounded-[28px] p-6 flex flex-col aspect-[4/5] shadow-2xl"
          >
            <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.14em] text-text">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-lime" />
                <span>{APP_WORDMARK}</span>
              </div>
              <span>{dayLabel}</span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] font-extrabold tracking-[0.1em] text-text">
              <span
                style={{ backgroundColor: playerRow.player.color }}
                className="w-2 h-2 rounded-full"
              />
              {playerRow.player.name.toUpperCase()} · TODAY
            </div>
            <div className="flex items-end gap-6 mt-1">
              <div>
                <div className="font-serif text-[56px] leading-[0.9] text-text">
                  {formatOrdinal(playerRow.rank)}
                </div>
                <div className="text-[10px] font-bold text-muted mt-1">League position</div>
              </div>
              <div>
                <div className="font-serif text-[56px] leading-[0.9] text-text">
                  {playerRow.totalPoints}
                </div>
                <div className="text-[10px] font-bold text-muted mt-1">Points today</div>
              </div>
              <div className="ml-auto text-[10px] font-bold text-muted pb-0.5">
                {dayRows.length} game{dayRows.length === 1 ? "" : "s"} played
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-1 mt-3 min-h-0">
              {dayRows.map((r) => (
                <div
                  key={r.key}
                  style={{ backgroundColor: r.game.color }}
                  className="flex-1 min-h-0 rounded-[8px] px-3 flex items-center justify-between text-[#121212]"
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-extrabold truncate">{r.game.name}</div>
                    <div className="text-[9px] font-semibold opacity-70 truncate">{r.vs}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-serif text-[20px] leading-none">{r.result}</span>
                    <div className="text-right w-[58px]">
                      <div className="text-[11px] font-extrabold">
                        {formatOrdinal(r.placement)} of {r.outOf}
                      </div>
                      <div className="text-[9px] font-semibold opacity-70">
                        {r.counts ? `+${r.points} pts` : "Pending"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {dayRows.length === 0 && (
                <div className="text-muted text-sm mt-6">No results submitted today yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
