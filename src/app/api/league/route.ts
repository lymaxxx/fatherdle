import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/admin-auth";
import {
  createPlayer,
  deleteSubmission,
  findSubmission,
  getAllPlayers,
  getSubmissionsInRange,
  getTodayDate,
  importQuizboisSeed,
  reassignSubmission,
  upsertSubmissions,
} from "@/lib/db";
import { addDays, resolveDatePeriod } from "@/lib/analytics/dates";
import {
  calculateActivityCalendar,
  calculateAllDailyStandings,
  calculateDailyGameStanding,
  calculateLeagueStandings,
  calculatePlayerProfileAnalytics,
  calculateTimeSeries,
} from "@/lib/analytics/engine";
import { generateAutomaticInsights } from "@/lib/analytics/insights";
import { buildFeed, buildLeagues } from "@/lib/analytics/feed";
import { buildGameStats } from "@/lib/analytics/game-stats";
import { buildGroupStats } from "@/lib/analytics/group-stats";
import { createGameAnalyticsModule } from "@/lib/analytics/game-modules";
import { parseMultiGamePaste } from "@/lib/parsers";
import { ACTIVE_GAME_SLUGS, GAMES } from "@/lib/constants";
import { GameSlug, PeriodPreset } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const preset = (searchParams.get("preset") as PeriodPreset) || "week";
    const customStart = searchParams.get("start") || undefined;
    const customEnd = searchParams.get("end") || undefined;
    const activePlayerId = searchParams.get("playerId") || "";
    const selectedGameSlug = (searchParams.get("gameSlug") as GameSlug) || "maptap";
    const todayDate = getTodayDate();

    const players = await getAllPlayers();
    // Load all submissions from earliest date to todayDate for complete calculations
    const allSubmissions = await getSubmissionsInRange("2000-01-01", todayDate);

    const earliestDate =
      allSubmissions.length > 0 ? allSubmissions[0].leagueDate : todayDate;

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
    const calendarStart = addDays(todayDate, -34);
    const activityCalendar = calculateActivityCalendar(
      calendarStart,
      todayDate,
      allSubmissions,
      players,
      todayDate
    );

    // 4. Active player profile analytics
    const targetPlayer = players.find((p) => p.id === activePlayerId || p.slug === activePlayerId) ||
      players[0] || {
        id: "none",
        slug: "none",
        name: "Player",
        color: "#948F84",
        avatarInitials: "?",
        joinedAt: todayDate,
      };

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
    // The game page can show any past day's leaderboard (default: today).
    const requestedGameDate = searchParams.get("gameDate") || "";
    const gameDate =
      /^\d{4}-\d{2}-\d{2}$/.test(requestedGameDate) && requestedGameDate <= todayDate
        ? requestedGameDate
        : todayDate;
    // A day with no results still needs a (empty) standing, otherwise the page has nothing to show
    const selectedGameToday =
      (gameDate === todayDate
        ? todayGames.find((g) => g.gameSlug === validGameSlug)
        : undefined) ||
      calculateDailyGameStanding(
        validGameSlug,
        gameDate,
        allSubmissions.filter((s) => s.gameSlug === validGameSlug && s.leagueDate === gameDate),
        players,
        todayDate,
        allSubmissions.filter((s) => s.leagueDate === gameDate)
      );

    const feedLimit = Math.min(200, Math.max(10, Number(searchParams.get("feedLimit")) || 20));
    const feed = buildFeed(todayDate, allSubmissions, players, feedLimit);
    const leagues = buildLeagues(todayDate, allSubmissions, players);

    return NextResponse.json({
      todayDate,
      leagues,
      feed,
      groupStats: buildGroupStats(period.startDate, period.endDate, allSubmissions, players, leagues),
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
        gameStats: Object.fromEntries(
          ACTIVE_GAME_SLUGS.map((slug) => [
            slug,
            buildGameStats(
              slug,
              allSubmissions.filter(
                (s) =>
                  s.playerId === targetPlayer.id &&
                  s.gameSlug === slug &&
                  s.leagueDate >= period.startDate &&
                  s.leagueDate <= period.endDate
              )
            ),
          ])
        ),
        records: playerProfile.records,
        dailySubCounts: playerDailySubCounts,
      },
      gamePage: {
        game: GAMES[validGameSlug],
        todayStanding: selectedGameToday,
        visualisation: gameVisualisation,
        columns: gameModule.getLeaderboardColumns(),
        stats: buildGameStats(
          validGameSlug,
          allSubmissions.filter(
            (s) => s.gameSlug === validGameSlug && s.leagueDate >= period.startDate && s.leagueDate <= period.endDate
          )
        ),
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
    const body = await req.json();

    const isAdmin = isValidAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);

    if (body.action === "join") {
      // Only the admin can add players; the very first player can bootstrap an empty league.
      if (!isAdmin && (await getAllPlayers()).length > 0) {
        return NextResponse.json(
          { error: "Only the admin can add players. Choose your name from the list." },
          { status: 403 }
        );
      }
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required." }, { status: 400 });
      }
      const player = await createPlayer(name, body.color, body.joinedAt || getTodayDate());
      return NextResponse.json({ player });
    }

    if (body.action === "delete-result" || body.action === "reassign-result") {
      const sub = await findSubmission(String(body.submissionId || ""));
      if (!sub) return NextResponse.json({ error: "That result no longer exists." }, { status: 404 });
      // No logins here: the browser says who it is. Players can manage their own results, the admin anyone's.
      if (!isAdmin && String(body.actingPlayerId || "") !== sub.playerId) {
        return NextResponse.json(
          { error: "You can only change your own results." },
          { status: 403 }
        );
      }
      if (body.action === "delete-result") {
        await deleteSubmission(sub.id);
        return NextResponse.json({ ok: true });
      }
      const moved = await reassignSubmission(sub.id, String(body.toPlayerId || ""));
      return NextResponse.json({ ok: true, submission: moved });
    }

    if (body.action === "import-quizbois") {
      if (!isAdmin) return NextResponse.json({ error: "Admin login required." }, { status: 401 });
      return NextResponse.json(await importQuizboisSeed());
    }

    if (body.action === "paste") {
      const playerId = String(body.playerId || "");
      if (!playerId) {
        return NextResponse.json({ error: "Choose who is submitting." }, { status: 400 });
      }
      const rawPaste = String(body.rawPaste || "");
      const targetDate = String(body.leagueDate || getTodayDate());
      const isLate = Boolean(body.isLate);

      const { parsed, unrecognisedBlocks } = parseMultiGamePaste(rawPaste);
      if (parsed.length === 0) {
        return NextResponse.json(
          {
            error:
              "Could not recognise any supported game results. Paste share text from Wordle, MapTap, Krillion, Noillirk, Huedle, Flagle, Catfishing, Poople, Wordishingrilliontapdle, Metrodle, Connections, Strands, GeoGuessr, Flagcognito, or Flagments.",
            unrecognisedBlocks,
          },
          { status: 400 }
        );
      }

      const saved = await upsertSubmissions(
        parsed.map((item) => ({
          playerId,
          gameSlug: item.gameSlug,
          leagueDate: targetDate || item.extractedDate || getTodayDate(),
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
        }))
      );

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
