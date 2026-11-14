"use client";

import React, { useRef } from "react";
import { Download, Share2, X } from "lucide-react";
import { DailyGameStanding, DatePeriod, GameConfig, GameSlug, PlayerStandingRow } from "@/lib/types";
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
  game,
  gameStanding,
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: "league" | "game";
  playerRow: PlayerStandingRow;
  allStandings: PlayerStandingRow[];
  period: DatePeriod;
  game?: GameConfig;
  gameStanding?: DailyGameStanding;
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
    } else if (game && gameStanding) {
      const userSub =
        gameStanding.rankings.find((r) => r.playerId === playerRow.player.id) ||
        gameStanding.rankings[0];
      const topScore = gameStanding.rankings[0]?.primaryValue || 0;
      const diff = userSub ? Math.abs(topScore - userSub.primaryValue) : 0;

      ctx.fillStyle = game.color;
      ctx.fillRect(0, 0, 1080, 1350);

      ctx.fillStyle = "#121212";
      ctx.beginPath();
      ctx.arc(68, 72, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "bold 22px sans-serif";
      ctx.fillText(APP_WORDMARK, 94, 80);
      ctx.textAlign = "right";
      ctx.fillText(gameStanding.leagueDate, 1020, 80);
      ctx.textAlign = "left";

      ctx.font = "180px Georgia, serif";
      ctx.fillText(game.name, 54, 270);

      if (userSub) {
        ctx.font = "190px Georgia, serif";
        ctx.fillText(
          `${formatOrdinal(userSub.placement)}  ${userSub.displayResult}`,
          54,
          490
        );

        ctx.font = "bold 26px sans-serif";
        ctx.fillText(
          `${userSub.playerName} · place of ${gameStanding.submissionCount}`,
          54,
          570
        );
        ctx.fillText(`+${userSub.leaguePoints} league points`, 54, 608);

        ctx.fillText("Score", 480, 570);
        ctx.fillText(
          diff === 0 ? "Winning result" : `${diff} from the winner`,
          480,
          608
        );
      }

      let y = 670;
      gameStanding.rankings.slice(0, 6).forEach((r) => {
        const isMe = r.playerId === playerRow.player.id;
        ctx.fillStyle = isMe ? "#121212" : "rgba(18, 18, 18, 0.12)";
        ctx.beginPath();
        ctx.roundRect(54, y, 972, 76, 14);
        ctx.fill();

        ctx.fillStyle = isMe ? "#F4F1EA" : "#121212";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(
          `${r.placement}   ${r.playerName}${isMe ? " (you)" : ""}`,
          82,
          y + 48
        );

        ctx.textAlign = "right";
        ctx.fillStyle = isMe ? "#E6EB5E" : "#121212";
        ctx.font = "54px Georgia, serif";
        ctx.fillText(r.displayResult, 996, y + 54);
        ctx.textAlign = "left";
        y += 88;
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
          <span className="text-sm font-bold">Share card (1080×1350 · 4:5)</span>
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
              className="px-3.5 py-1.5 rounded-full bg-lime text-[#121212] text-xs font-bold flex items-center gap-1.5"
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
          game &&
          gameStanding && (
            <div
              ref={cardRef}
              style={{ backgroundColor: game.color }}
              className="text-[#121212] rounded-[28px] p-6 flex flex-col justify-between aspect-[4/5] shadow-2xl"
            >
              <div className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.14em]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#121212]" />
                  <span>{APP_WORDMARK}</span>
                </div>
                <span>{gameStanding.leagueDate}</span>
              </div>

              <div>
                <div className="font-serif text-[64px] leading-[0.92]">
                  {game.name}
                </div>
                {(() => {
                  const userSub =
                    gameStanding.rankings.find(
                      (r) => r.playerId === playerRow.player.id
                    ) || gameStanding.rankings[0];
                  if (!userSub) return null;
                  return (
                    <>
                      <div className="font-serif text-[68px] leading-[0.92] mt-1">
                        {formatOrdinal(userSub.placement)} {userSub.displayResult}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold mt-2">
                        <div>
                          {userSub.playerName} · place of {gameStanding.submissionCount}
                          <br />+{userSub.leaguePoints} league points
                        </div>
                        <div>
                          Result
                          <br />
                          {userSub.placement === 1
                            ? "First place finish"
                            : `Ranked #${userSub.placement} today`}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-1.5 my-2">
                {gameStanding.rankings.slice(0, 5).map((r) => {
                  const isMe = r.playerId === playerRow.player.id;
                  return (
                    <div
                      key={r.id}
                      className={`h-[36px] rounded-[8px] px-3 flex items-center justify-between ${
                        isMe
                          ? "bg-[#121212] text-text"
                          : "bg-black/10 text-[#121212]"
                      }`}
                    >
                      <span className="text-[12px] font-bold">
                        {r.placement} &nbsp;{r.playerName}
                        {isMe ? " (you)" : ""}
                      </span>
                      <span
                        className={`font-serif text-[22px] ${
                          isMe ? "text-lime" : "text-[#121212]"
                        }`}
                      >
                        {r.displayResult}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] font-bold">
                {gameStanding.status} · {gameStanding.submissionCount} of{" "}
                {gameStanding.totalPlayers} players submitted
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
