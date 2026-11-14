import { NextRequest, NextResponse } from "next/server";
import {
  createPlayer,
  getAllPlayers,
  getDb,
  getSubmissionsInRange,
  upsertSubmission,
} from "@/lib/db";
import { resolveDatePeriod } from "@/lib/analytics/dates";
import {
  calculateActivityCalendar,
  calculateAllDailyStandings,
  calculateLeagueStandings,
  calculatePlayerProfileAnalytics,
  calculateTimeSeries,
} from "@/lib/analytics/engine";
import { generateAutomaticInsights } from "@/lib/analytics/insights";
import { createGameAnalyticsModule } from "@/lib/analytics/game-modules";
import { parseMultiGamePaste } from "@/lib/parsers";
import { ACTIVE_GAME_SLUGS, GAMES } from "@/lib/constants";
import { GameSlug, PeriodPreset } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_TODAY = "2026-11-14";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);

    const preset = (searchParams.get("preset") as PeriodPreset) || "week";
    const customStart = searchParams.get("start") || undefined;
    const customEnd = searchParams.get("end") || undefined;
    const activePlayerId = searchParams.get("playerId") || "p_alex";
    const selectedGameSlug = (searchParams.get("gameSlug") as GameSlug) || "maptap";
    const todayDate = searchParams.get("today") || DEFAULT_TODAY;

    const players = getAllPlayers(db);
    // Load all submissions from earliest date to todayDate for complete calculations
    const allSubmissions = getSubmissionsInRange("2026-01-01", todayDate, db);

    const earliestDate =
      allSubmissions.length > 0 ? allSubmissions[0].leagueDate : "2026-10-12";

    const period = resolveDatePeriod(
      preset,
      todayDate,
      customStart,
      customEnd,
      earliestDate
    );

    // 1. Today's games & standings
    const todayPeriod = resolveDatePeriod("today", todayDate);
    const todayStandings = calculateLeagueStandings(
      todayPeriod,
      allSubmissions,
      players,
      todayDate
    );
    const todayGames = calculateAllDailyStandings(
      todayDate,
      todayDate,
      allSubmissions,
      players,
      todayDate,
      ACTIVE_GAME_SLUGS
    );

    // 2. Period standings & time series
    const standings = calculateLeagueStandings(
      period,
      allSubmissions,
      players,
      todayDate
    );
    const timeSeries = calculateTimeSeries(
      period,
      allSubmissions,
      players,
      todayDate
    );
    const insights = generateAutomaticInsights(
      period,
      allSubmissions,
      players,
      todayDate,
      5
    );

    // 3. Activity calendar (always show 35 days ending on todayDate so the 7x5 / 12-col grid is rich)
    const calendarStart = "2026-10-11";
    const activityCalendar = calculateActivityCalendar(
      calendarStart,
      todayDate,
      allSubmissions,
      players,
      todayDate
    );

    // 4. Active player profile analytics
    const targetPlayer =
      players.find((p) => p.id === activePlayerId || p.slug === activePlayerId) ||
      players[1] ||
      players[0];

    const playerProfile = calculatePlayerProfileAnalytics(
      targetPlayer.id,
      period,
      allSubmissions,
      players,
      todayDate
    );

    // Player's own daily activity for the 35-day calendar
    const playerDailySubCounts: Record<string, number> = {};
    for (const s of allSubmissions) {
      if (s.playerId === targetPlayer.id) {
        playerDailySubCounts[s.leagueDate] =
          (playerDailySubCounts[s.leagueDate] || 0) + 1;
      }
    }

    // 5. Game analytics for selected game
    const validGameSlug = GAMES[selectedGameSlug] ? selectedGameSlug : "maptap";
    const gameModule = createGameAnalyticsModule(validGameSlug);
    const gameVisualisation = gameModule.buildVisualisationData(
      period.startDate,
      period.endDate,
      allSubmissions,
      players
    );
    const selectedGameToday =
      todayGames.find((g) => g.gameSlug === validGameSlug) ||
      calculateAllDailyStandings(
        todayDate,
        todayDate,
        allSubmissions,
        players,
        todayDate,
        [validGameSlug]
      )[0];

    return NextResponse.json({
      todayDate,
      period,
      players,
      games: Object.values(GAMES).filter((g) => g.slug !== "custom"),
      today: {
        standings: todayStandings,
        games: todayGames,
      },
      stats: {
        standings,
        timeSeries,
        insights,
        activityCalendar,
      },
      playerPage: {
        player: targetPlayer,
        standingRow: standings.find((r) => r.player.id === targetPlayer.id) || null,
        strengths: playerProfile.strengths,
        records: playerProfile.records,
        dailySubCounts: playerDailySubCounts,
      },
      gamePage: {
        game: GAMES[validGameSlug],
        todayStanding: selectedGameToday,
        visualisation: gameVisualisation,
        columns: gameModule.getLeaderboardColumns(),
      },
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/league:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (body.action === "join") {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required." }, { status: 400 });
      }
      const player = createPlayer(name, body.color, body.joinedAt || DEFAULT_TODAY, db);
      return NextResponse.json({ player });
    }

    if (body.action === "paste") {
      const playerId = String(body.playerId || "p_alex");
      const rawPaste = String(body.rawPaste || "");
      const targetDate = String(body.leagueDate || DEFAULT_TODAY);
      const isLate = Boolean(body.isLate);

      const { parsed, unrecognisedBlocks } = parseMultiGamePaste(rawPaste);
      if (parsed.length === 0) {
        return NextResponse.json(
          {
            error:
              "Could not recognise any supported game results. Paste share text from Wordle, MapTap, Krillion, Noillirk, Huedle, Flagdle, Catfishing, Poople, or Wordishingrilliontapdle.",
            unrecognisedBlocks,
          },
          { status: 400 }
        );
      }

      const saved = [];
      for (const item of parsed) {
        const leagueDate = targetDate || item.extractedDate || DEFAULT_TODAY;
        const sub = upsertSubmission(
          {
            playerId,
            gameSlug: item.gameSlug,
            leagueDate,
            puzzleId: item.puzzleId,
            rawText: item.rawText,
            primaryValue: item.primaryValue,
            secondaryValue: item.secondaryValue,
            tertiaryValue: item.tertiaryValue,
            displayResult: item.displayResult,
            failed: item.failed,
            metadataJson: JSON.stringify(item.metadata),
            isLate,
            isCorrected: false,
          },
          db
        );
        saved.push(sub);
      }

      return NextResponse.json({
        savedCount: saved.length,
        saved,
        unrecognisedBlocks,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Error in POST /api/league:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
