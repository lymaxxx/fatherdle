"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  ClipboardPaste,
  ExternalLink,
  Gamepad2,
  Info,
  Share2,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  DailyGameStanding,
  DatePeriod,
  GameConfig,
  GameSlug,
  LeagueInsight,
  PeriodPreset,
  Player,
  PlayerStandingRow,
} from "@/lib/types";
import {
  ActivityCalendarDay,
  DailyPointsSeriesPoint,
  PlayerGameStrengthRow,
  PlayerRecordItem,
} from "@/lib/analytics/engine";
import {
  GameVisualisationData,
  LeaderboardColumn,
} from "@/lib/analytics/game-modules";
import { APP_WORDMARK, GAMES } from "@/lib/constants";
import { AdminPanel } from "@/components/AdminPanel";
import { FeedView, MondayBanner, PreviousLeagues } from "@/components/LeaguesAndFeed";
import type { FeedItem, LeagueWeek, LeaguesPayload } from "@/lib/analytics/feed";
import {
  ActivityCalendarHeatmap,
  GameHistoryChart,
  PointsBreakdownChart,
  PointsOverTimeChart,
  PositionBumpChart,
} from "./Charts";
import { HighlightBlocks } from "./HighlightBlocks";
import { GameIcon, GAME_ICON, gameGradient, CountUp } from "./ui";
import { PasteResultModal } from "./PasteResultModal";
import { ShareCardModal } from "./ShareCardModal";

export type NavTab = "today" | "statistics" | "games" | "players" | "onboarding" | "admin" | "feed";

interface LeagueApiResponse {
  todayDate: string;
  leagues: LeaguesPayload;
  feed: { items: FeedItem[]; hasMore: boolean; geoguessrPlayed: Record<string, string[]> };
  period: DatePeriod;
  players: Player[];
  games: GameConfig[];
  today: {
    standings: PlayerStandingRow[];
    games: DailyGameStanding[];
  };
  stats: {
    standings: PlayerStandingRow[];
    timeSeries: {
      series: DailyPointsSeriesPoint[];
      leadChangesCount: number;
      lastLeadChange: {
        date: string;
        newLeaderName: string;
        prevLeaderName: string;
      } | null;
    };
    insights: LeagueInsight[];
    activityCalendar: ActivityCalendarDay[];
  };
  playerPage: {
    player: Player;
    standingRow: PlayerStandingRow | null;
    strengths: PlayerGameStrengthRow[];
    records: PlayerRecordItem[];
    dailySubCounts: Record<string, number>;
  };
  gamePage: {
    game: GameConfig;
    todayStanding: DailyGameStanding;
    visualisation: GameVisualisationData;
    columns: LeaderboardColumn[];
  };
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const IDENTITY_KEY = "fatherdle.playerId";

export function FatherdleApp({
  initialTab,
  initialGameSlug,
}: {
  initialTab?: NavTab;
  initialGameSlug?: GameSlug;
} = {}) {
  const [activeTab, setActiveTab] = useState<NavTab>(initialTab ?? "today");
  const [preset, setPreset] = useState<PeriodPreset>("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [currentUserId, setCurrentUserId] = useState("");
  const [viewedPlayerId, setViewedPlayerId] = useState("");
  const [gameDate, setGameDate] = useState(""); // "" = today
  const [selectedGameSlug, setSelectedGameSlug] = useState<GameSlug>(initialGameSlug ?? "maptap");
  const [hasJoined, setHasJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(false);

  const [data, setData] = useState<LeagueApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Chart interactive states
  const [pointsChartMode, setPointsChartMode] = useState<"cumulative" | "daily">("cumulative");
  const [breakdownMode, setBreakdownMode] = useState<"by_player" | "by_game">("by_player");
  const [calendarMetric, setCalendarMetric] = useState<"submissions" | "players" | "points">("submissions");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [visiblePlayerIds, setVisiblePlayerIds] = useState<string[]>([]);
  const [comparedPlayerIds, setComparedPlayerIds] = useState<string[]>([]);

  // Modals
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinMode, setJoinMode] = useState<"both" | "existing" | "new">("both");
  const openJoin = (mode: "both" | "existing" | "new") => {
    setJoinMode(mode);
    setIsJoinModalOpen(true);
  };
  const [newPlayerName, setNewPlayerName] = useState("");
  const [shareModalMode, setShareModalMode] = useState<"league" | "final" | "day" | "player" | null>(null);
  const [shareWeek, setShareWeek] = useState<LeagueWeek | null>(null);
  const [todayView, setTodayView] = useState<"today" | "week" | "leagues">("today");
  const [feedFilter, setFeedFilter] = useState<GameSlug | "all">("all");
  const [feedLimit, setFeedLimit] = useState(20);
  const [dismissedBanner, setDismissedBanner] = useState("");

  const customKey = preset === "custom" ? `${customStart}|${customEnd}` : "";

  const fetchLeagueData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        preset,
        playerId: viewedPlayerId,
        gameSlug: selectedGameSlug,
      });
      if (gameDate) params.set("gameDate", gameDate);
      if (feedLimit !== 20) params.set("feedLimit", String(feedLimit));
      if (preset === "custom" && customStart && customEnd) {
        params.set("start", customStart);
        params.set("end", customEnd);
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(`/api/league?${params.toString()}`, { signal: ctrl.signal }).finally(
        () => clearTimeout(timer)
      );
      const raw = await res.text();
      let json: LeagueApiResponse & { error?: string };
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Server replied ${res.status}: ${raw.replace(/\s+/g, " ").slice(0, 160)}`);
      }
      if (!res.ok || json.error || !json.players) {
        throw new Error(json.error || `Server returned ${res.status}`);
      }
      setLoadError(null);
      setData(json);
      if (json.players) {
        setVisiblePlayerIds((prev) => (prev.length ? prev : json.players.map((p) => p.id)));
      }
    } catch (e) {
      console.error("Failed to fetch league data:", e);
      setLoadError(
        e instanceof Error && e.name === "AbortError"
          ? "The server took too long to respond."
          : e instanceof Error
          ? e.message
          : "Could not load the league."
      );
    } finally {
      setLoading(false);
    }
    // customKey keeps custom dates out of the dependencies unless that range is actually selected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customKey, viewedPlayerId, selectedGameSlug, gameDate, feedLimit]);

  useEffect(() => {
    fetchLeagueData();
  }, [fetchLeagueData]);

  // Is this browser logged in as admin?
  useEffect(() => {
    fetch("/api/admin")
      .then((r) => r.json())
      .then((j) => setIsAdmin(Boolean(j.authed)))
      .catch(() => setIsAdmin(false));
  }, []);

  // iOS Safari ignores user-scalable=no, so also swallow its pinch gestures. (CSS touch-action covers the
  // rest; a touchmove listener that can cancel would make every scroll wait on JavaScript.)
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop);
    document.addEventListener("gesturechange", stop);
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
    };
  }, []);

  // Every page starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeTab]);

  // If the admin removed or merged the player this browser was using, ask them to pick again.
  useEffect(() => {
    if (!data || !identityChecked || !currentUserId) return;
    if (!data.players.some((p) => p.id === currentUserId)) {
      window.localStorage.removeItem(IDENTITY_KEY);
      setCurrentUserId("");
      setViewedPlayerId("");
      setHasJoined(false);
    }
  }, [data, identityChecked, currentUserId, activeTab]);

  // Fill date and comparison defaults from the server's idea of "today".
  useEffect(() => {
    if (!data) return;
    setCustomEnd((v) => v || data.todayDate);
    setCustomStart((v) => v || data.period.startDate);
    setSelectedCalendarDate((v) => v || data.todayDate);
    setComparedPlayerIds((v) => (v.length ? v : data.players.slice(0, 2).map((p) => p.id)));
  }, [data]);

  // Restore identity from this browser; first-time visitors land on onboarding.
  useEffect(() => {
    if (!data || identityChecked) return;
    const saved = window.localStorage.getItem(IDENTITY_KEY);
    if (saved && data.players.some((p) => p.id === saved)) {
      setCurrentUserId(saved);
      setViewedPlayerId(saved);
      setHasJoined(true);
    }
    setIdentityChecked(true);
  }, [data, identityChecked, initialTab]);

  // An empty league has nothing to show yet; keep people on the join screen.
  useEffect(() => {
    if (data && data.players.length === 0 && activeTab !== "onboarding") {
      setActiveTab("onboarding");
    }
  }, [data, activeTab]);

  // Keep the URL in step with the Games tab (/games/[slug]).
  useEffect(() => {
    if (!identityChecked) return;
    const path =
      activeTab === "games" ? `/games/${selectedGameSlug}` : activeTab === "admin" ? "/admin" : "/";
    if (window.location.pathname !== path) window.history.replaceState(null, "", path);
  }, [activeTab, selectedGameSlug, identityChecked]);

  const manageResult = async (action: string, extra: Record<string, string>) => {
    try {
      const res = await fetch("/api/league", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actingPlayerId: currentUserId, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      await fetchLeagueData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  const chooseIdentity = (id: string) => {
    window.localStorage.setItem(IDENTITY_KEY, id);
    setCurrentUserId(id);
    setViewedPlayerId(id);
    setHasJoined(true);
  };

  const toggleVisiblePlayer = (id: string) => {
    setVisiblePlayerIds((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((x) => x !== id)
          : prev
        : [...prev, id]
    );
  };

  const toggleComparedPlayer = (id: string) => {
    setComparedPlayerIds((prev) =>
      prev.includes(id)
        ? prev.length > 2
          ? prev.filter((x) => x !== id)
          : prev
        : [...prev, id]
    );
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const res = await fetch("/api/league", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        name: newPlayerName.trim(),
      }),
    });
    const json = await res.json();
    if (json.player) {
      chooseIdentity(json.player.id);
      setNewPlayerName("");
      setIsJoinModalOpen(false);
      setActiveTab("today");
      fetchLeagueData();
    }
  };

  const currentUserPlayer = useMemo(() => {
    if (!data) return null;
    return data.players.find((p) => p.id === currentUserId) || data.players[0] || null;
  }, [data, currentUserId]);

  const canAddPlayers = isAdmin || (data?.players.length ?? 0) === 0;
  const showAdminLink = isAdmin || currentUserPlayer?.slug === "maksim";

  const currentUserStandingRow = useMemo(() => {
    if (!data) return null;
    return (
      data.stats.standings.find((r) => r.player.id === currentUserId) ||
      data.stats.standings[0] ||
      null
    );
  }, [data, currentUserId]);

  const selectedCalendarDayObj = useMemo(() => {
    if (!data) return null;
    return (
      data.stats.activityCalendar.find((d) => d.date === selectedCalendarDate) ||
      data.stats.activityCalendar[data.stats.activityCalendar.length - 1] ||
      null
    );
  }, [data, selectedCalendarDate]);

  if (!data && loading) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-lime animate-pulse" />
          <span className="text-sm font-bold tracking-widest uppercase">
            {APP_WORDMARK}
          </span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-lime" />
            <span className="text-sm font-bold tracking-widest uppercase">{APP_WORDMARK}</span>
          </div>
          <p className="text-[15px] font-semibold">Couldn&apos;t load the league.</p>
          {loadError && <p className="text-xs text-muted break-words">{loadError}</p>}
          <button
            type="button"
            onClick={() => fetchLeagueData()}
            className="px-5 py-2.5 rounded-full bg-lime text-[#121212] text-sm font-extrabold"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Period Selector Component shared by Statistics, Player, and Game pages
  const renderPeriodSelector = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="bg-surface border border-line/60 rounded-full p-1 flex items-center gap-1 overflow-x-auto">
        {(
          [
            { id: "today", label: "Today" },
            { id: "week", label: "This week" },
            { id: "month", label: "This month" },
            { id: "all", label: "All time" },
            { id: "custom", label: "Custom range" },
          ] as Array<{ id: PeriodPreset; label: string }>
        ).map((item) => {
          const active = preset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors ${
                active
                  ? "bg-text text-[#121212]"
                  : "text-muted hover:text-text"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2 bg-surface border border-line/60 rounded-full px-3 py-1 text-xs">
          <input
            type="date"
            value={customStart}
            max={customEnd}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-transparent text-text font-semibold focus:outline-none"
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            max={data.todayDate}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-transparent text-text font-semibold focus:outline-none"
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-text pb-36 md:pb-16">
      {/* DESKTOP & MOBILE TOP NAV */}
      <header className="sticky top-0 z-30 bg-bg border-b border-line/50">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 h-[68px] md:h-[80px] flex items-center justify-between gap-4">
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("statistics")}
              className="flex items-center gap-2.5 text-left group"
            >
              <span className="w-3.5 h-3.5 rounded-full bg-lime group-hover:scale-110 transition-transform" />
              <span className="text-[12px] font-extrabold tracking-[0.16em] text-text">
                {APP_WORDMARK}
              </span>
            </button>
          </div>

          {/* Center Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-9">
            {(
              [
                { id: "today", label: "League" },
                { id: "feed", label: "Feed" },
                { id: "statistics", label: "Statistics" },
                { id: "games", label: "Games" },
                { id: "players", label: "Players" },
              ] as Array<{ id: NavTab; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                data-active={activeTab === t.id}
                className={`nav-tab text-[14px] font-semibold ${
                  activeTab === t.id ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5">
            {hasJoined ? (
              <div className="flex items-center gap-1.5 bg-surface border border-line/70 rounded-full pl-2 pr-3 py-1">
                <span
                  style={{ backgroundColor: currentUserPlayer?.color || "#FF8A3D" }}
                  className="w-5 h-5 rounded-full text-[#121212] text-[11px] font-extrabold flex items-center justify-center"
                >
                  {currentUserPlayer?.avatarInitials}
                </span>
                <select
                  aria-label="Current player identity"
                  value={currentUserId}
                  onChange={(e) => {
                    if (e.target.value === "__add") {
                      openJoin("new");
                      return;
                    }
                    chooseIdentity(e.target.value);
                  }}
                  className="bg-transparent text-[12px] font-bold text-text focus:outline-none cursor-pointer"
                >
                  {data.players.map((p) => (
                    <option key={p.id} value={p.id} className="bg-surface text-text">
                      {p.name} (you)
                    </option>
                  ))}
                  {isAdmin && (
                    <option value="__add" className="bg-surface text-text">
                      + Add player…
                    </option>
                  )}
                </select>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openJoin("both")}
                className="btn-secondary flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-line text-[13px] font-semibold text-text"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Join the league</span>
              </button>
            )}

            {showAdminLink && (
              <button
                type="button"
                onClick={() => setActiveTab("admin")}
                className={`px-3.5 py-2 rounded-full border text-[12px] font-bold ${
                  activeTab === "admin"
                    ? "border-lime text-lime"
                    : "border-line text-muted hover:text-text hover:bg-surface"
                }`}
              >
                Admin
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPasteOpen(true)}
              className="btn-primary wobble-twice hidden md:flex items-center gap-2 px-5 py-2.5 rounded-full bg-lime text-[#121212] text-[13px] font-bold"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Paste result</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="max-w-[1440px] mx-auto px-5 md:px-12 pt-7 md:pt-9 space-y-7">
        {/* =========================================================
            1. ONBOARDING / JOIN VIEW (Screen 1)
           ========================================================= */}
        {activeTab === "onboarding" && (
          <div className="max-w-md mx-auto pt-6 pb-44 md:pb-6 space-y-7">
            <h1 className="text-[44px] md:text-[56px] font-bold tracking-[-1.5px] leading-none text-text">
              Daily games.
              <br />
              One table.
            </h1>

            <div className="flex flex-wrap gap-2">
              {data.games.map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => {
                    setSelectedGameSlug(g.slug);
                    setActiveTab("games");
                  }}
                  style={{ backgroundColor: g.color, color: "#121212" }}
                  className="px-3.5 py-2 rounded-full text-[13px] font-bold"
                >
                  {g.name}
                </button>
              ))}
            </div>

            <div className="space-y-3.5 pt-2">
              {[
                { num: "1", text: "Play today's games" },
                { num: "2", text: "Paste your result" },
                { num: "3", text: "See where you rank" },
              ].map((s) => (
                <div key={s.num} className="flex items-center gap-4">
                  <span className="font-serif text-[44px] leading-none text-lime w-7">
                    {s.num}
                  </span>
                  <span className="text-[19px] font-semibold text-text">
                    {s.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-4">
              {data.players.length > 0 && (
                <button
                  type="button"
                  onClick={() => openJoin("existing")}
                  className="w-full h-[60px] rounded-full bg-lime text-[#121212] text-[16px] font-extrabold flex items-center justify-center gap-2"
                >
                  <Users className="w-5 h-5" />
                  <span>Choose an existing player</span>
                </button>
              )}
              {canAddPlayers && (
                <button
                  type="button"
                  onClick={() => openJoin("new")}
                  className={
                    data.players.length > 0
                      ? "w-full h-[60px] rounded-full border border-line text-text text-[16px] font-bold flex items-center justify-center gap-2 hover:bg-surface"
                      : "w-full h-[60px] rounded-full bg-lime text-[#121212] text-[16px] font-extrabold flex items-center justify-center gap-2"
                  }
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Add a new player</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPasteOpen(true)}
                className="hidden md:flex w-full h-[60px] rounded-full border border-line text-text text-[16px] font-bold items-center justify-center gap-2 hover:bg-surface"
              >
                <ClipboardPaste className="w-5 h-5" />
                <span>Paste a result</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            2. TODAY'S LEAGUE VIEW (Screen 2)
           ========================================================= */}
        {activeTab === "admin" && (
          <AdminPanel onChanged={fetchLeagueData} onAuthChange={setIsAdmin} />
        )}

        {activeTab === "feed" && (
          <FeedView
            items={data.feed.items}
            hasMore={data.feed.hasMore}
            viewerId={hasJoined ? currentUserId : ""}
            geoguessrPlayed={data.feed.geoguessrPlayed}
            onMore={() => setFeedLimit((n) => n + 20)}
            filter={feedFilter}
            onFilter={setFeedFilter}
            games={data.games.map((g) => ({ slug: g.slug, name: g.name, color: g.color }))}
            todayDate={data.todayDate}
            todayStandings={data.today.standings}
            onPaste={() => setIsPasteOpen(true)}
            links={{
              onOpenPlayer: (id) => {
                setViewedPlayerId(id);
                setActiveTab("players");
              },
              onOpenGame: (slug) => {
                setSelectedGameSlug(slug);
                setActiveTab("games");
              },
            }}
            actions={{
              canManage: (playerId) => isAdmin || (hasJoined && playerId === currentUserId),
              players: data.players,
              onDelete: (submissionId) => manageResult("delete-result", { submissionId }),
              onReassign: (submissionId, toPlayerId) =>
                manageResult("reassign-result", { submissionId, toPlayerId }),
            }}
          />
        )}

        {activeTab === "today" && (() => {
          const totalGames = data.today.games.length;
          const mySubmitted = data.today.games.filter((g) =>
            g.rankings.some((r) => r.playerId === currentUserId)
          ).length;
          const qualifiedCount = data.today.games.filter((g) => g.status === "Qualified").length;
          const required = data.today.games[0]?.requiredCount ?? 1;
          const active = data.today.games[0]?.activePlayers ?? 0;
          const dateLabel = new Date(`${data.todayDate}T12:00:00Z`).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          });
          const isMonday = new Date(`${data.todayDate}T12:00:00Z`).getUTCDay() === 1;
          const yesterday = shiftIsoDate(data.todayDate, -1);
          const lastWeek = data.leagues.previous.find((w) => w.endDate === yesterday);
          const showBanner = isMonday && !!lastWeek && dismissedBanner !== lastWeek.startDate;
          const openWeekResults = (w: LeagueWeek) => {
            setPreset("custom");
            setCustomStart(w.startDate);
            setCustomEnd(w.endDate);
            setActiveTab("statistics");
          };
          const shareFinal = (w: LeagueWeek) => {
            setShareWeek(w);
            setShareModalMode("final");
          };
          const firstLeagueEnds = new Date(`${data.leagues.current.endDate}T12:00:00Z`).toLocaleDateString(
            "en-GB",
            { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
          );
          const toggle = (
            <div className="inline-flex bg-surface rounded-full p-1 w-full md:w-auto">
              {(
                [
                  ["today", "Today"],
                  ["week", "This week"],
                  ["leagues", "Previous leagues"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTodayView(id)}
                  className={`flex-1 md:flex-none px-3 md:px-5 py-2 rounded-full text-[13px] md:text-[14px] font-bold whitespace-nowrap ${
                    todayView === id ? "bg-text text-[#121212]" : "text-muted"
                  }`}
                >
                  {label === "Previous leagues" ? (
                    <>
                      Previous<span className="hidden md:inline"> leagues</span>
                    </>
                  ) : (
                    label
                  )}
                </button>
              ))}
            </div>
          );
          const banner =
            showBanner && lastWeek ? (
              <MondayBanner
                week={lastWeek}
                currentUserId={currentUserId}
                onSeeResults={() => openWeekResults(lastWeek)}
                onShare={() => shareFinal(lastWeek)}
                onDismiss={() => {
                  window.localStorage.setItem("fatherdle.bannerDismissed", lastWeek.startDate);
                  setDismissedBanner(lastWeek.startDate);
                }}
              />
            ) : null;
          const leaguesView = (
            <PreviousLeagues
              weeks={data.leagues.previous}
              currentUserId={currentUserId}
              onOpen={openWeekResults}
              firstLeagueEnds={firstLeagueEnds}
            />
          );
          const weekView = todayView === "week";
          const standings = weekView
            ? data.leagues.current.standings.flatMap((r) => {
                const player = data.players.find((p) => p.id === r.playerId);
                return player
                  ? [
                      {
                        player,
                        rank: r.rank,
                        totalPoints: r.points,
                        gamesPlayed: r.gamesPlayed,
                        qualifiedGamesPlayed: r.qualifiedGames,
                        firstPlaces: r.firstPlaces,
                      } as unknown as (typeof data.today.standings)[number],
                    ]
                  : [];
              })
            : data.today.standings;
          const maxPts = Math.max(1, ...standings.map((r) => r.totalPoints));
          const me = data.players.find((p) => p.id === currentUserId);
          const openGame = (slug: GameSlug) => {
            setSelectedGameSlug(slug);
            setActiveTab("games");
          };
          const openPlayer = (id: string) => {
            setViewedPlayerId(id);
            setActiveTab("players");
          };
          const submittedLabel = (row: (typeof standings)[number]) =>
            weekView
              ? row.gamesPlayed > 0
                ? `${row.gamesPlayed} games · ${row.qualifiedGamesPlayed} counted`
                : "Nothing submitted"
              : row.gamesPlayed > 0
              ? `${row.gamesPlayed} of ${totalGames} submitted`
              : "Not submitted";
          const wk = data.leagues.current;
          const subtitle = weekView
            ? `${wk.label} · Day ${wk.daysElapsed} of 7`
            : `${dateLabel} · ${qualifiedCount} of ${totalGames} games count`;
          const shareHere = () => {
            if (weekView) setShareModalMode("league");
            else setShareModalMode("day");
          };
          const weekTiles = (
            <div className="grid grid-cols-3 gap-2.5 md:gap-3.5">
              {[
                [`${wk.daysPlayed} of 7`, "days played"],
                [String(wk.gamesCounted), "games counted"],
                [String(wk.leadChanges), wk.leadChanges === 1 ? "lead change" : "lead changes"],
              ].map(([v, l]) => (
                <div key={l} className="bg-surface rounded-2xl md:rounded-[18px] p-4 md:p-6">
                  <div className="font-serif text-[36px] md:text-[64px] leading-none">{v}</div>
                  <div className="text-[12px] md:text-[14px] text-muted mt-1.5">{l}</div>
                </div>
              ))}
            </div>
          );
          const statusChip = (status: string, small = false) => (
            <span
              className={`rounded-full font-bold whitespace-nowrap ${
                small ? "px-2 py-[3px] text-[10px]" : "px-3 py-1 text-[11px] font-extrabold"
              } ${
                status === "Qualified"
                  ? "bg-lime text-[#121212]"
                  : status === "Pending"
                  ? "bg-surface2 text-muted"
                  : "bg-orange/20 text-orange"
              }`}
            >
              {status}
            </span>
          );
          const playerChips = (dg: (typeof data.today.games)[number], size: "sm" | "md") =>
            data.players.map((p) => {
              const done = dg.rankings.some((r) => r.playerId === p.id);
              return (
                <span
                  key={p.id}
                  style={done ? { backgroundColor: p.color } : undefined}
                  className={`rounded-full font-bold ${
                    size === "sm" ? "px-[7px] py-[3px] text-[11px]" : "px-3 py-1 text-[13px]"
                  } ${done ? "text-[#121212]" : "text-muted border-[1.5px] border-line"}`}
                >
                  {p.name}
                </span>
              );
            });
          const pendingNote = (
            <>
              {active === 0
                ? "Counts once someone plays. Until then: Pending."
                : `Counts once ${required} of ${active} active players submit. Until then: Pending.`}
            </>
          );

          return (
            <div>
              {/* ============ MOBILE ============ */}
              <div className="md:hidden space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-[40px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">
                      League
                    </h1>
                    <p className="text-[14px] text-muted mt-1">{subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {todayView !== "leagues" && (
                    <button
                      type="button"
                      aria-label={weekView ? "Share this week" : "Share my day"}
                      onClick={shareHere}
                      className="w-11 h-11 rounded-full bg-surface2 flex items-center justify-center"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    )}
                    {me && (
                      <button
                        type="button"
                        aria-label="My page"
                        onClick={() => openPlayer(me.id)}
                        style={{ backgroundColor: me.color }}
                        className="w-11 h-11 rounded-full text-[#121212] text-[18px] font-extrabold"
                      >
                        {me.avatarInitials}
                      </button>
                    )}
                  </div>
                </div>

                {toggle}
                {todayView === "leagues" ? (
                  leaguesView
                ) : (
                  <>
                {todayView === "today" && banner}
                <div>
                  {standings.map((row) => {
                    const isMe = row.player.id === currentUserId;
                    const played = row.gamesPlayed > 0;
                    return (
                      <div
                        key={row.player.id}
                        className="flex items-center gap-3.5 h-[56px] border-b border-line last:border-b-0"
                      >
                        <span
                          className={`font-serif text-[34px] w-[26px] leading-none ${
                            row.rank === 1 && played ? "text-lime" : "text-text"
                          }`}
                        >
                          {row.rank}
                        </span>
                        <span
                          style={{ backgroundColor: played ? row.player.color : "#948F84" }}
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => openPlayer(row.player.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="text-[18px] font-bold leading-tight truncate">
                            {row.player.name}
                            {isMe ? " (you)" : ""}
                          </div>
                          <div className="text-[12px] text-muted">{submittedLabel(row)}</div>
                        </button>
                        <span
                          className={`font-serif text-[34px] leading-none tabular-nums ${
                            played ? "text-text" : "text-muted"
                          }`}
                        >
                          {played ? row.totalPoints : "–"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-surface2 rounded-[14px] p-3 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                  <div className="text-[12px] leading-4">
                    <div className="font-bold text-text">How points work</div>
                    <p className="text-muted mt-0.5">
                      Points come from your place in each qualified game. Players with the same
                      result share a place.
                    </p>
                  </div>
                </div>

                {weekView ? weekTiles : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[24px] font-extrabold">Games</h2>
                    <span className="bg-lime text-[#121212] rounded-[14px] px-3 py-[5px] text-[12px] font-extrabold">
                      You: {mySubmitted} of {totalGames}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {data.today.games.map((dg) => {
                      const g = GAMES[dg.gameSlug];
                      const needs = Math.max(0, dg.requiredCount - dg.submissionCount);
                      return (
                        <button
                          key={dg.gameSlug}
                          type="button"
                          onClick={() => openGame(g.slug)}
                          className="bg-surface rounded-2xl pt-3 px-3 pb-3.5 text-left space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              style={{ backgroundColor: g.color }}
                              className="w-1.5 h-5 rounded-[3px] shrink-0"
                            />
                            <span className="text-[15px] font-extrabold truncate">{g.name}</span>
                          </div>
                          <div className="text-[11px] text-muted">
                            {dg.submissionCount} of {dg.totalPlayers} submitted
                            {dg.status === "Pending" && needs > 0 ? ` · needs ${needs}` : ""}
                          </div>
                          <div>{statusChip(dg.status, true)}</div>
                          <div className="flex flex-wrap gap-1">{playerChips(dg, "sm")}</div>
                        </button>
                      );
                    })}
                    {data.today.games.length % 2 === 1 && (
                      <div className="bg-surface rounded-2xl p-3 flex items-start gap-2 text-[12px] text-muted">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{pendingNote}</span>
                      </div>
                    )}
                  </div>
                </div>
                )}
                  </>
                )}
              </div>

              {/* ============ DESKTOP ============ */}
              <div className="hidden md:block space-y-7">
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-2">
                    <h1 className="text-[40px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">
                      League
                    </h1>
                    <p className="text-[16px] text-muted">{subtitle}</p>
                    <div className="pt-2">{toggle}</div>
                  </div>
                  {todayView !== "leagues" && (
                  <div className="flex items-center gap-4">
                    {weekView ? (
                      <button
                        type="button"
                        onClick={() => setIsPasteOpen(true)}
                        className="h-12 px-6 rounded-full bg-lime text-[#121212] text-[15px] font-extrabold inline-flex items-center gap-2"
                      >
                        <ClipboardPaste className="w-4 h-4" />
                        Paste result
                      </button>
                    ) : (
                    <div className="bg-lime text-[#121212] rounded-[32px] flex items-center gap-5 py-3 pl-7 pr-3">
                      <span className="font-serif text-[56px] leading-[56px] tracking-[-2px] whitespace-nowrap">
                        {mySubmitted} of {totalGames}
                      </span>
                      <div className="text-[14px] leading-tight">
                        <div className="font-bold">games submitted</div>
                        <div className="opacity-70">
                          {Math.max(0, totalGames - mySubmitted)} left to play
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPasteOpen(true)}
                        className="h-12 px-[22px] rounded-full bg-[#121212] text-text text-[15px] font-extrabold inline-flex items-center gap-2"
                      >
                        <ClipboardPaste className="w-4 h-4" />
                        Paste result
                      </button>
                    </div>
                    )}
                    <button
                      type="button"
                      onClick={shareHere}
                      className="h-12 px-[22px] rounded-full border-[1.5px] border-line text-[14px] font-bold inline-flex items-center gap-2 hover:bg-surface"
                    >
                      <Share2 className="w-4 h-4" />
                      {weekView ? "Share this week" : "Share my day"}
                    </button>
                  </div>
                  )}
                </div>

                {todayView === "leagues" ? (
                  leaguesView
                ) : (
                  <>
                {todayView === "today" && banner}
                <div className="grid grid-cols-[minmax(0,1fr)_484px] gap-6 items-start">
                <div className="space-y-4 min-w-0">
                <div className="space-y-2.5">
                  {standings.map((row, idx) => {
                    const isMe = row.player.id === currentUserId;
                    const played = row.gamesPlayed > 0;
                    const pct = played ? Math.max(30, (row.totalPoints / maxPts) * 100) : 30;
                    return (
                      <div key={row.player.id} className="bar-row flex items-center gap-4 h-[72px]">
                        <span
                          className={`font-serif text-[40px] leading-none w-10 shrink-0 ${
                            row.rank === 1 && played ? "text-lime" : "text-muted"
                          }`}
                        >
                          {row.rank}
                        </span>
                        <div className="flex-1 relative h-[72px]">
                          <button
                            type="button"
                            onClick={() => openPlayer(row.player.id)}
                            style={{
                              width: `${pct}%`,
                              animationDelay: `${idx * 60}ms`,
                              ...(played ? { backgroundColor: row.player.color } : {}),
                            }}
                            className={`bar-fill grow-in absolute left-0 top-0 h-[72px] rounded-2xl text-left px-6 flex flex-col justify-center ${
                              played ? "text-[#121212]" : "text-muted bg-surface"
                            }`}
                          >
                            <div className="text-[22px] font-bold tracking-[-0.3px] leading-tight truncate">
                              {row.player.name}
                              {isMe ? " (you)" : ""}
                            </div>
                            <div className={`text-[13px] font-medium ${played ? "opacity-70" : ""}`}>
                              {submittedLabel(row)}
                            </div>
                          </button>
                        </div>
                        <span className="bar-score font-serif text-[48px] leading-none w-[96px] text-right tabular-nums shrink-0">
                          {played ? <CountUp value={row.totalPoints} /> : <span className="text-muted">–</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-surface rounded-[14px] px-4 py-3 flex items-center gap-2.5 text-[13px] text-muted">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    How points work: points come from your place in each qualified game. Players
                    with the same result share a place.
                  </span>
                </div>
                </div>
                {weekView ? <div className="min-w-0">{weekTiles}</div> : (
                <div className="bg-surface rounded-[24px] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[20px] font-bold">Games today</h2>
                    <span className="text-[12px] text-muted">{data.today.games.filter((g) => g.submissionCount > 0).length} of {data.today.games.length} played</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {data.today.games.filter((dg) => dg.submissionCount > 0).map((dg) => {
                      const g = GAMES[dg.gameSlug];
                      const done = data.players.filter((p) => dg.rankings.some((r) => r.playerId === p.id));
                      return (
                        <button
                          key={dg.gameSlug}
                          type="button"
                          onClick={() => openGame(g.slug)}
                          className="game-tile bg-surface2 rounded-[16px] p-3.5 text-left space-y-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <GameIcon slug={g.slug} size={32} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[14px] font-semibold truncate">{g.name}</div>
                              <div className="text-[12px] text-muted">
                                {dg.submissionCount}/{dg.totalPlayers}
                                {dg.status === "Pending" ? " · pending" : ""}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {done.slice(0, 3).map((p) => (
                              <span key={p.id} style={{ backgroundColor: p.color }} className="rounded-full px-2 py-[2px] text-[11px] font-bold text-[#121212]">
                                {p.name}
                              </span>
                            ))}
                            {done.length > 3 && (
                              <span className="rounded-full px-2 py-[2px] text-[11px] font-bold text-muted border border-line">+{done.length - 3}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {data.today.games.some((dg) => dg.submissionCount === 0) && (
                    <div className="rounded-[14px] bg-bg/50 px-3.5 py-3 text-[12px] text-muted">
                      <span className="font-semibold text-text">Not played yet: </span>
                      {data.today.games.filter((dg) => dg.submissionCount === 0).map((dg) => GAMES[dg.gameSlug].name).join(", ")}
                    </div>
                  )}
                  <div className="text-[12px] text-muted leading-4">{pendingNote}</div>
                  <button
                    type="button"
                    onClick={() => setIsPasteOpen(true)}
                    className="btn-primary w-full h-12 rounded-full bg-lime text-[#121212] text-[14px] font-bold inline-flex items-center justify-center gap-2"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    Paste result
                  </button>
                </div>
                )}
                </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* =========================================================
            3. GLOBAL STATISTICS VIEW (Screens 3 & 4)
           ========================================================= */}
        {activeTab === "statistics" && currentUserStandingRow && (
          <div className="space-y-7">
            {/* Title & Period Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h1 className="text-[40px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">
                Statistics
              </h1>
              {renderPeriodSelector()}
            </div>

            {/* 4 Highlight Colour Blocks */}
            <HighlightBlocks
              playerRow={currentUserStandingRow}
              allStandings={data.stats.standings}
              period={data.period}
              series={data.stats.timeSeries.series}
              onShare={() => setShareModalMode("player")}
            />

            {/* Row 1: Standings + Points Over Time */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* League Standings (2.3) */}
              <div className="lg:col-span-5 bg-surface border border-line/50 rounded-[22px] p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[19px] font-bold tracking-tight">
                      {preset === "today"
                        ? "Today's standings"
                        : preset === "week"
                        ? "Weekly standings"
                        : preset === "month"
                        ? "Monthly standings"
                        : "League standings"}
                    </h2>
                    {data.period.prevLabel && (
                      <span className="text-[11px] text-muted">
                        vs {data.period.prevLabel}
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-line/60 text-[11px] text-muted font-semibold">
                          <th className="py-2 font-medium">Player</th>
                          <th className="py-2 text-right font-medium">Pts</th>
                          <th className="py-2 text-right font-medium">1st</th>
                          <th
                            className="py-2 text-right font-medium"
                            title="Qualified games / Total submitted"
                          >
                            Games
                          </th>
                          <th className="py-2 text-right font-medium">
                            {preset === "week" ? "vs last wk" : "Change"}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/40 text-[14px] tabular-nums">
                        {data.stats.standings.map((row) => {
                          const isMe = row.player.id === currentUserId;
                          const change = row.positionChange;
                          return (
                            <tr key={row.player.id} className="group">
                              <td className="py-3 pr-2">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`font-serif text-[22px] w-4 leading-none ${
                                      row.rank === 1 ? "text-lime" : "text-text"
                                    }`}
                                  >
                                    {row.rank}
                                  </span>
                                  <span
                                    style={{ backgroundColor: row.player.color }}
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewedPlayerId(row.player.id);
                                      setActiveTab("players");
                                    }}
                                    className="font-bold text-text hover:underline truncate"
                                  >
                                    {row.player.name}
                                    {isMe ? " (you)" : ""}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 text-right font-extrabold text-text text-[15px]">
                                {row.totalPoints}
                              </td>
                              <td className="py-3 text-right text-muted font-medium">
                                {row.firstPlaces}
                              </td>
                              <td
                                className="py-3 text-right text-muted font-medium"
                                title={`${row.qualifiedGamesPlayed} qualified of ${row.gamesPlayed} submitted`}
                              >
                                {row.qualifiedGamesPlayed}
                                {row.gamesPlayed > row.qualifiedGamesPlayed && (
                                  <span className="text-[11px] text-muted/70">
                                    /{row.gamesPlayed}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-right font-bold text-[12px]">
                                {change === null || change === 0 ? (
                                  <span className="text-muted">–</span>
                                ) : change > 0 ? (
                                  <span className="text-lime">+{change}</span>
                                ) : (
                                  <span className="text-orange">{change}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-surface2/70 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed text-muted">
                    <strong className="text-text block">How points work</strong>
                    Points come from your place in each qualified game. Players with the same
                    result share a place. Position change compares with the equivalent previous
                    period ({data.period.prevLabel || "prior window"}).
                  </div>
                </div>
              </div>

              {/* Points Over Time (2.4) */}
              <div className="lg:col-span-7 bg-surface border border-line/50 rounded-[22px] p-6 flex flex-col justify-between space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Points over time
                  </h2>
                  <div className="bg-surface2 rounded-full p-0.5 flex items-center text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPointsChartMode("cumulative")}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        pointsChartMode === "cumulative"
                          ? "bg-text text-[#121212]"
                          : "text-muted hover:text-text"
                      }`}
                    >
                      Cumulative
                    </button>
                    <button
                      type="button"
                      onClick={() => setPointsChartMode("daily")}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        pointsChartMode === "daily"
                          ? "bg-text text-[#121212]"
                          : "text-muted hover:text-text"
                      }`}
                    >
                      Daily
                    </button>
                  </div>
                </div>

                <PointsOverTimeChart
                  series={data.stats.timeSeries.series}
                  players={data.players}
                  visiblePlayerIds={visiblePlayerIds}
                  mode={pointsChartMode}
                />

                {/* Interactive Player Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {data.players.map((p) => {
                    const active = visiblePlayerIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleVisiblePlayer(p.id)}
                        style={{
                          borderColor: active ? p.color : "#3A3935",
                          opacity: active ? 1 : 0.45,
                        }}
                        className="px-3 py-1 rounded-full border text-[12px] font-bold flex items-center gap-1.5 transition-opacity"
                      >
                        <span
                          style={{ backgroundColor: p.color }}
                          className="w-2 h-2 rounded-full"
                        />
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 2: Position History (Bump Chart) + Points by Game (Stacked Bar) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Position History (2.5) */}
              <div className="lg:col-span-6 bg-surface border border-line/50 rounded-[22px] p-6 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Position history
                  </h2>
                  <span className="text-xs text-muted">1 = top</span>
                </div>

                <PositionBumpChart
                  series={data.stats.timeSeries.series}
                  players={data.players}
                  visiblePlayerIds={visiblePlayerIds}
                />

                <div className="text-[12px] text-muted">
                  {data.stats.timeSeries.lastLeadChange
                    ? `${data.stats.timeSeries.lastLeadChange.newLeaderName} took the lead on ${data.stats.timeSeries.lastLeadChange.date.slice(
                        8,
                        10
                      )} Nov. The lead has changed ${
                        data.stats.timeSeries.leadChangesCount === 1
                          ? "once"
                          : `${data.stats.timeSeries.leadChangesCount} times`
                      } in this period.`
                    : `${data.stats.standings[0]?.player.name || "The leader"} held first place throughout this period.`}
                </div>
              </div>

              {/* Points Breakdown (2.6) */}
              <div className="lg:col-span-6 bg-surface border border-line/50 rounded-[22px] p-6 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Points by game
                  </h2>
                  <div className="bg-surface2 rounded-full p-0.5 flex items-center text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setBreakdownMode("by_player")}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        breakdownMode === "by_player"
                          ? "bg-text text-[#121212]"
                          : "text-muted hover:text-text"
                      }`}
                    >
                      By player
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreakdownMode("by_game")}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        breakdownMode === "by_game"
                          ? "bg-text text-[#121212]"
                          : "text-muted hover:text-text"
                      }`}
                    >
                      By game
                    </button>
                  </div>
                </div>

                <PointsBreakdownChart
                  standings={data.stats.standings}
                  mode={breakdownMode}
                />
              </div>
            </div>

            {/* Row 3: Automatic Factual Insights (3) + Activity Calendar (2.8) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Automatic Insights */}
              <div className="lg:col-span-5 bg-surface border border-line/50 rounded-[22px] p-6 space-y-4">
                <h2 className="text-[19px] font-bold tracking-tight">
                  {preset === "today"
                    ? "Today's insights"
                    : preset === "week"
                    ? "This week"
                    : "Key findings"}
                </h2>

                {data.stats.insights.length === 0 ? (
                  <p className="text-sm text-muted">
                    More results are needed to calculate insights for this period.
                  </p>
                ) : (
                  <div className="divide-y divide-line/50">
                    {data.stats.insights.map((ins) => (
                      <div
                        key={ins.id}
                        className="py-3.5 flex items-center gap-4"
                      >
                        <div
                          style={{ color: ins.leadColor }}
                          className="font-serif text-[36px] leading-none w-14 shrink-0 tabular-nums"
                        >
                          {ins.leadValue}
                        </div>
                        <div className="text-[13px] leading-snug text-text font-medium">
                          {ins.text}
                          {ins.detail && (
                            <span className="block text-[11px] text-muted mt-0.5">
                              {ins.detail}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity Calendar Heatmap */}
              <div className="lg:col-span-7 bg-surface border border-line/50 rounded-[22px] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Activity
                  </h2>
                  <div className="bg-surface2 rounded-full p-0.5 flex items-center text-[11px] font-bold">
                    {(
                      [
                        { id: "submissions", label: "Submissions" },
                        { id: "players", label: "Players" },
                        { id: "points", label: "Points" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCalendarMetric(m.id)}
                        className={`px-3 py-1 rounded-full transition-colors ${
                          calendarMetric === m.id
                            ? "bg-text text-[#121212]"
                            : "text-muted hover:text-text"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-7">
                    <ActivityCalendarHeatmap
                      days={data.stats.activityCalendar}
                      metric={calendarMetric}
                      selectedDate={selectedCalendarDate}
                      onSelectDate={setSelectedCalendarDate}
                    />
                  </div>

                  {selectedCalendarDayObj && (
                    <div className="md:col-span-5 space-y-2.5 border-t md:border-t-0 md:border-l border-line/50 pt-4 md:pt-0 md:pl-5">
                      <div className="text-[18px] font-extrabold text-text">
                        {selectedCalendarDayObj.label}
                      </div>
                      <div className="divide-y divide-line/40 text-[13px] tabular-nums">
                        <div className="py-1.5 flex justify-between">
                          <span className="text-muted">Submissions</span>
                          <span className="font-bold text-text">
                            {selectedCalendarDayObj.totalSubmissions}
                          </span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-muted">Active players</span>
                          <span className="font-bold text-text">
                            {selectedCalendarDayObj.activePlayers}
                          </span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-muted">Qualified games</span>
                          <span className="font-bold text-text">
                            {selectedCalendarDayObj.qualifiedGames}
                          </span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-muted">Winner</span>
                          <span className="font-bold text-text">
                            {selectedCalendarDayObj.dailyWinnerName || "–"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 4: Head-to-Head Player Comparison (Section 2.7 - No Radar Charts!) */}
            <div className="bg-surface border border-line/50 rounded-[22px] p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Player comparison
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Select two or more players to compare league metrics across{" "}
                    {data.period.label}.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {data.players.map((p) => {
                    const selected = comparedPlayerIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleComparedPlayer(p.id)}
                        style={{
                          borderColor: selected ? p.color : "#3A3935",
                          backgroundColor: selected ? "rgba(255,255,255,0.04)" : "transparent",
                        }}
                        className="px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5"
                      >
                        <span
                          style={{ backgroundColor: p.color }}
                          className="w-2 h-2 rounded-full"
                        />
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse tabular-nums">
                  <thead>
                    <tr className="border-b border-line/60 text-[11px] text-muted">
                      <th className="py-2.5 font-medium">Metric</th>
                      {comparedPlayerIds.map((pid) => {
                        const row = data.stats.standings.find((r) => r.player.id === pid);
                        if (!row) return null;
                        return (
                          <th key={pid} className="py-2.5 text-right font-bold text-text">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                style={{ backgroundColor: row.player.color }}
                                className="w-2 h-2 rounded-full"
                              />
                              {row.player.name}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40 text-[14px]">
                    {[
                      {
                        label: "Total points",
                        render: (r: PlayerStandingRow) => `${r.totalPoints}`,
                      },
                      {
                        label: "First-place finishes",
                        render: (r: PlayerStandingRow) => `${r.firstPlaces}`,
                      },
                      {
                        label: "Average placement (lower is better)",
                        render: (r: PlayerStandingRow) =>
                          r.averagePlacement !== null ? r.averagePlacement.toFixed(2) : "–",
                      },
                      {
                        label: "Qualified games played",
                        render: (r: PlayerStandingRow) =>
                          `${r.qualifiedGamesPlayed} (${r.gamesPlayed} total)`,
                      },
                      {
                        label: "Win rate",
                        render: (r: PlayerStandingRow) =>
                          r.winRate !== null ? `${Math.round(r.winRate * 100)}%` : "–",
                      },
                      {
                        label: "Points per qualified game",
                        render: (r: PlayerStandingRow) =>
                          r.pointsPerQualifiedGame !== null
                            ? r.pointsPerQualifiedGame.toFixed(2)
                            : "–",
                      },
                    ].map((metricRow) => (
                      <tr key={metricRow.label}>
                        <td className="py-3 text-muted font-medium">{metricRow.label}</td>
                        {comparedPlayerIds.map((pid) => {
                          const row = data.stats.standings.find((r) => r.player.id === pid);
                          if (!row) return null;
                          return (
                            <td key={pid} className="py-3 text-right font-bold text-text">
                              {metricRow.render(row)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            4. INDIVIDUAL PLAYER PAGE (Screens 5 & 7)
           ========================================================= */}
        {activeTab === "players" && data.playerPage.standingRow && (
          <div className="space-y-7">
            <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6 lg:items-start space-y-7 lg:space-y-0">
            <aside className="hidden lg:block bg-surface rounded-[24px] p-3 space-y-1 sticky top-[96px]">
              {data.players.map((p) => {
                const active = p.id === data.playerPage.player.id;
                const row = data.stats.standings.find((r) => r.player.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setViewedPlayerId(p.id)}
                    className={`rail-item w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-left ${
                      active ? "bg-surface2 outline outline-1 outline-lime" : ""
                    }`}
                  >
                    <span style={{ backgroundColor: p.color }} className="w-9 h-9 rounded-full text-[#121212] text-[15px] font-bold flex items-center justify-center shrink-0">
                      {p.avatarInitials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold truncate">{p.name}</span>
                      <span className="block text-[12px] text-muted">{row ? `${row.gamesPlayed} games` : "no games"}</span>
                    </span>
                    <span className="font-serif text-[26px] leading-none text-text">{row ? row.totalPoints : 0}</span>
                  </button>
                );
              })}
            </aside>
            <div className="lg:hidden flex items-center gap-3 overflow-x-auto pb-1 -mx-5 px-5">
              {data.players.map((p) => {
                const active = p.id === data.playerPage.player.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setViewedPlayerId(p.id)}
                    aria-label={p.name}
                    className={`shrink-0 p-1 rounded-full ${active ? "outline outline-1 outline-lime bg-surface2" : ""}`}
                  >
                    <span style={{ backgroundColor: p.color }} className="w-11 h-11 rounded-full text-[#121212] text-[16px] font-bold flex items-center justify-center">
                      {p.avatarInitials}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-7 min-w-0">

            {/* Player Header + Period Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  style={{ backgroundColor: data.playerPage.player.color }}
                  className="w-16 h-16 rounded-full text-[#121212] text-[28px] font-extrabold flex items-center justify-center shrink-0"
                >
                  {data.playerPage.player.avatarInitials}
                </div>
                <div>
                  <h1 className="text-[44px] sm:text-[56px] font-bold tracking-[-1.5px] leading-none">
                    {data.playerPage.player.name}
                  </h1>
                  <p className="text-[13px] text-muted mt-1">
                    Joined {data.playerPage.player.joinedAt}
                  </p>
                </div>
              </div>
              {renderPeriodSelector()}
            </div>

            {/* 4 Highlight Blocks for this Player */}
            <HighlightBlocks
              playerRow={data.playerPage.standingRow}
              allStandings={data.stats.standings}
              period={data.period}
              series={data.stats.timeSeries.series}
              onShare={() => setShareModalMode("player")}
              isPlayerPage
            />

            {/* Row 1: Points over time vs Leader + League position over time */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-surface border border-line/50 rounded-[22px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Points over time
                  </h2>
                  <span className="text-xs text-muted">
                    Cumulative · grey is the leader
                  </span>
                </div>

                <PointsOverTimeChart
                  series={data.stats.timeSeries.series}
                  players={data.players}
                  visiblePlayerIds={[data.playerPage.player.id]}
                  highlightPlayerId={data.playerPage.player.id}
                  compareLeaderOnly
                  mode="cumulative"
                />
              </div>

              <div className="lg:col-span-5 bg-surface border border-line/50 rounded-[22px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    League position
                  </h2>
                  <span className="text-xs text-muted">1 = top</span>
                </div>

                <PositionBumpChart
                  series={data.stats.timeSeries.series}
                  players={data.players}
                  singlePlayerId={data.playerPage.player.id}
                />

                <div className="text-[12px] text-muted">
                  Currently ranked #{data.playerPage.standingRow.rank} in{" "}
                  {data.period.label}.
                </div>
              </div>
            </div>

            {/* Row 2: Game Strengths Table (4.4) + Points by Game */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-surface border border-line/50 rounded-[22px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Game strengths
                  </h2>
                  <span className="text-xs text-muted">Sorted by average place</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse tabular-nums">
                    <thead>
                      <tr className="border-b border-line/60 text-[11px] text-muted">
                        <th className="py-2 font-medium">Game</th>
                        <th className="py-2 text-right font-medium">Played</th>
                        <th className="py-2 text-right font-medium">First places</th>
                        <th className="py-2 text-right font-medium">Avg place</th>
                        <th className="py-2 text-right font-medium">Best result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40 text-[14px]">
                      {data.playerPage.strengths.map((st) => (
                        <tr key={st.gameSlug}>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGameSlug(st.gameSlug);
                                setActiveTab("games");
                              }}
                              className="flex items-center gap-2.5 font-bold text-text hover:underline"
                            >
                              <span
                                style={{ backgroundColor: st.gameColor }}
                                className="w-1.5 h-5 rounded-full"
                              />
                              <span>{st.gameName}</span>
                            </button>
                          </td>
                          <td className="py-3 text-right font-bold text-text">
                            {st.played}
                          </td>
                          <td className="py-3 text-right text-muted font-medium">
                            {st.firstPlaces}
                          </td>
                          <td className="py-3 text-right font-bold text-text">
                            {st.averagePlacement !== null
                              ? st.averagePlacement.toFixed(1)
                              : "–"}
                          </td>
                          <td className="py-3 text-right text-muted font-medium">
                            {st.bestResult}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-surface2/70 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                  <div className="text-[11px] text-muted">
                    <strong className="text-text block">Average place</strong>
                    Your mean placement in qualified games played. Lower is better.
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-surface border border-line/50 rounded-[22px] p-6 space-y-4">
                <h2 className="text-[19px] font-bold tracking-tight">
                  Points by game
                </h2>

                <div className="space-y-3 pt-1">
                  {data.playerPage.strengths
                    .filter((s) => s.totalPoints > 0)
                    .sort((a, b) => b.totalPoints - a.totalPoints)
                    .map((s) => {
                      const maxPts = Math.max(
                        1,
                        ...data.playerPage.strengths.map((x) => x.totalPoints)
                      );
                      const wPct = Math.max(12, (s.totalPoints / maxPts) * 100);
                      return (
                        <div key={s.gameSlug} className="flex items-center gap-3">
                          <div className="w-24 text-[13px] font-bold text-text truncate">
                            {s.gameName}
                          </div>
                          <div className="flex-1">
                            <div
                              style={{
                                width: `${wPct}%`,
                                backgroundColor: s.gameColor,
                              }}
                              className="h-[22px] rounded-[5px]"
                            />
                          </div>
                          <div className="w-8 text-right text-[13px] font-bold text-text tabular-nums">
                            {s.totalPoints}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Row 3: Personal Records (4.3) + Activity Calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-surface border border-line/50 rounded-[22px] p-6 space-y-4">
                <h2 className="text-[19px] font-bold tracking-tight">Records</h2>
                <div className="divide-y divide-line/50">
                  {data.playerPage.records.map((rec) => (
                    <div
                      key={rec.label}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-[14px] font-bold text-text">
                          {rec.label}
                        </div>
                        <div className="text-[11px] text-muted">{rec.sublabel}</div>
                      </div>
                      <div
                        style={{ color: data.playerPage.player.color }}
                        className="font-serif text-[32px] leading-none"
                      >
                        {rec.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 bg-surface border border-line/50 rounded-[22px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Activity
                  </h2>
                  <span className="text-xs text-muted">Submissions per day</span>
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-10 gap-[6px]">
                  {data.stats.activityCalendar.map((day) => {
                    const count = data.playerPage.dailySubCounts[day.date] || 0;
                    const bg =
                      count === 0
                        ? "#2A2A27"
                        : count <= 3
                        ? "rgba(230, 235, 94, 0.35)"
                        : count <= 6
                        ? "rgba(230, 235, 94, 0.68)"
                        : "#E6EB5E";
                    return (
                      <div
                        key={day.date}
                        style={{ backgroundColor: bg }}
                        className="w-[24px] h-[24px] rounded-[5px]"
                        title={`${day.label}: ${count} games submitted`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
            </div>
          </div>
        )}

        {/* =========================================================
            5. INDIVIDUAL GAME PAGE (Screens 6 & 8)
           ========================================================= */}
        {activeTab === "games" && (
          <div className="space-y-7">
            <h1 className="text-[40px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">Games</h1>

            <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6 lg:items-start space-y-7 lg:space-y-0">
            {/* Rail (desktop) */}
            <aside className="hidden lg:block bg-surface rounded-[24px] p-3 space-y-1 sticky top-[96px] max-h-[calc(100vh-120px)] overflow-y-auto">
              {data.games.map((g) => {
                const active = g.slug === selectedGameSlug;
                return (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setSelectedGameSlug(g.slug)}
                    className={`rail-item w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-left ${
                      active ? "bg-surface2 outline outline-1 outline-lime" : ""
                    }`}
                  >
                    <GameIcon slug={g.slug} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold truncate">{g.name}</span>
                      <span className="block text-[12px] text-muted truncate">{g.unit}</span>
                    </span>
                  </button>
                );
              })}
            </aside>
            {/* Icon strip (phone) */}
            <div className="lg:hidden flex items-center gap-3 overflow-x-auto pb-1 -mx-5 px-5">
              {data.games.map((g) => {
                const active = g.slug === selectedGameSlug;
                return (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setSelectedGameSlug(g.slug)}
                    className={`shrink-0 p-1 rounded-[16px] ${active ? "outline outline-1 outline-lime bg-surface2" : ""}`}
                    aria-label={g.name}
                  >
                    <GameIcon slug={g.slug} size={44} />
                  </button>
                );
              })}
            </div>
            <div className="space-y-7 min-w-0">

            {/* Period for the history, distribution and player stats below */}
            {renderPeriodSelector()}

            {/* Game Coloured Hero Card (5.1) */}
            <div
              style={{ background: gameGradient(data.gamePage.game.slug, 120), color: GAME_ICON[data.gamePage.game.slug]?.fg ?? "#121212" }}
              className="rounded-[24px] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <h1 className={`font-bold leading-none tracking-[-1.5px] break-words ${data.gamePage.game.name.length > 14 ? "text-[30px] sm:text-[40px] lg:text-[48px]" : "text-[44px] sm:text-[56px]"}`}>
                  {data.gamePage.game.name}
                </h1>
                <p className="text-[15px] font-semibold max-w-xl">
                  {data.gamePage.game.description}
                </p>
                <div className="pt-1">
                  <a
                    href={data.gamePage.game.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary inline-flex items-center gap-1.5 text-[13px] font-bold px-4 py-2 rounded-full bg-[#121212] text-text"
                  >
                    <span>Play {data.gamePage.game.name}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <div className="flex flex-wrap sm:justify-end gap-2">
                  <span className="px-3.5 py-1.5 rounded-full bg-black/15 text-[12px] font-extrabold whitespace-nowrap">
                    {data.gamePage.todayStanding.submissionCount} of{" "}
                    {data.gamePage.todayStanding.totalPlayers} submitted
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-[#121212] text-lime text-[12px] font-extrabold whitespace-nowrap">
                    {data.gamePage.todayStanding.status === "Qualified"
                      ? `Qualified: counts towards ${gameDate && gameDate !== data.todayDate ? "that day's" : "today's"} league`
                      : data.gamePage.todayStanding.status === "Pending"
                      ? `Pending: needs ${data.gamePage.todayStanding.requiredCount} submissions`
                      : "Excluded from league points"}
                  </span>
                </div>
                <span className="px-3.5 py-1 rounded-full bg-black/10 text-[11px] font-bold whitespace-nowrap self-start sm:self-end">
                  {data.gamePage.todayStanding.isFinalised
                    ? "Results are final"
                    : "Provisional until midnight"}
                </span>
                <button
                  type="button"
                  onClick={() => setShareModalMode("day")}
                  className="mt-1 px-4 py-2.5 rounded-full bg-[#121212] text-text text-[13px] font-bold inline-flex items-center gap-2 hover:opacity-90 whitespace-nowrap self-start sm:self-end"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share my day</span>
                </button>
              </div>
            </div>

            {/* Game Specific Callouts */}
            {data.gamePage.visualisation.callouts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.gamePage.visualisation.callouts.map((c) => (
                  <div
                    key={c.label}
                    className="bg-surface border border-line/50 rounded-[18px] p-5 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-muted">
                        {c.label}
                      </div>
                      <div className="text-[12px] text-muted mt-1">{c.subtext}</div>
                    </div>
                    <div
                      style={{ color: data.gamePage.game.color }}
                      className="font-serif text-[36px] leading-none"
                    >
                      {c.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Row 1: Today's Results (5.2 & 5.3) + Game History (5.4) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Today's Leaderboard */}
              <div className="lg:col-span-5 bg-surface border border-line/50 rounded-[22px] p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[19px] font-bold tracking-tight">
                      {(gameDate || data.todayDate) === data.todayDate
                        ? "Today's results"
                        : "Results"}
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <button
                        type="button"
                        aria-label="Previous day"
                        onClick={() => setGameDate(shiftIsoDate(gameDate || data.todayDate, -1))}
                        className="w-6 h-6 rounded-full border border-line hover:bg-surface2 text-text"
                      >
                        ‹
                      </button>
                      <span className="min-w-[78px] text-center font-semibold text-text">
                        {new Date(`${gameDate || data.todayDate}T12:00:00Z`).toLocaleDateString(
                          "en-GB",
                          { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label="Next day"
                        disabled={(gameDate || data.todayDate) >= data.todayDate}
                        onClick={() => {
                          const next = shiftIsoDate(gameDate || data.todayDate, 1);
                          setGameDate(next >= data.todayDate ? "" : next);
                        }}
                        className="w-6 h-6 rounded-full border border-line hover:bg-surface2 text-text disabled:opacity-30"
                      >
                        ›
                      </button>
                      <span className="ml-1">
                        {data.gamePage.todayStanding.isFinalised ? "Final" : "Provisional"}
                      </span>
                    </div>
                  </div>

                  <table className="w-full text-left border-collapse tabular-nums">
                    <thead>
                      <tr className="border-b border-line/60 text-[11px] text-muted">
                        {data.gamePage.columns.map((col) => (
                          <th
                            key={col.key}
                            className={`py-2 font-medium ${
                              col.align === "right" ? "text-right" : "text-left"
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40 text-[14px]">
                      {data.gamePage.todayStanding.rankings.map((r) => {
                        const isMe = r.playerId === currentUserId;
                        return (
                          <tr key={r.id}>
                            <td className="py-3 font-bold text-text">
                              <div className="flex items-center gap-2.5">
                                <span
                                  style={{ backgroundColor: r.playerColor }}
                                  className="w-1.5 h-5 rounded-full"
                                />
                                <span>
                                  {r.playerName}
                                  {isMe ? " (you)" : ""}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 text-right font-extrabold text-text">
                              {r.displayResult}
                            </td>
                            <td className="py-3 text-right text-muted font-medium">
                              {formatOrdinal(r.placement)}
                            </td>
                            <td className="py-3 text-right text-muted font-medium">
                              {data.gamePage.todayStanding.status === "Qualified"
                                ? r.leaguePoints
                                : "–"}
                            </td>
                          </tr>
                        );
                      })}

                      {data.gamePage.todayStanding.missingPlayers.map((mp) => (
                        <tr key={mp.id} className="opacity-60">
                          <td className="py-3 text-muted">
                            <div className="flex items-center gap-2.5">
                              <span
                                style={{ backgroundColor: mp.color }}
                                className="w-1.5 h-5 rounded-full"
                              />
                              <span>{mp.name} · not submitted</span>
                            </div>
                          </td>
                          <td className="py-3 text-right text-muted">–</td>
                          <td className="py-3 text-right text-muted">–</td>
                          <td className="py-3 text-right text-muted">–</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-surface2/70 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed text-muted">
                    <strong className="text-text block">
                      {data.gamePage.todayStanding.status === "Qualified"
                        ? "Why this game counts"
                        : "Qualification status"}
                    </strong>
                    {data.gamePage.todayStanding.submissionCount} of{" "}
                    {data.gamePage.todayStanding.activePlayers} active players have submitted and{" "}
                    {data.gamePage.todayStanding.requiredCount} are needed (at least half of those
                    who played anything that day), so the results are{" "}
                    {data.gamePage.todayStanding.status}. An Excluded game still shows rankings and
                    results here, but awards no league points.
                  </div>
                </div>
              </div>

              {/* Historical Performance (5.4) */}
              <div className="lg:col-span-7 bg-surface border border-line/50 rounded-[22px] p-6 flex flex-col justify-between space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Game history
                  </h2>
                  <span className="text-xs text-muted">
                    {data.gamePage.visualisation.historySubtitle}
                  </span>
                </div>

                <GameHistoryChart
                  historyPoints={data.gamePage.visualisation.historyPoints}
                  players={data.players}
                  visiblePlayerIds={visiblePlayerIds}
                  axisStart={data.gamePage.visualisation.axisStart}
                  axisEnd={data.gamePage.visualisation.axisEnd}
                  invertYAxis={data.gamePage.visualisation.invertYAxis}
                  unit={data.gamePage.game.unit}
                />

                <div className="flex flex-wrap items-center gap-2">
                  {data.players.map((p) => {
                    const active = visiblePlayerIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleVisiblePlayer(p.id)}
                        style={{
                          borderColor: active ? p.color : "#3A3935",
                          opacity: active ? 1 : 0.45,
                        }}
                        className="px-3 py-1 rounded-full border text-[12px] font-bold flex items-center gap-1.5"
                      >
                        <span
                          style={{ backgroundColor: p.color }}
                          className="w-2 h-2 rounded-full"
                        />
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 2: Score Distribution Histogram (5.5) + Per-Player Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Distribution Histogram */}
              <div className="lg:col-span-6 bg-surface border border-line/50 rounded-[22px] p-6 flex flex-col justify-between space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    {data.gamePage.visualisation.distributionTitle}
                  </h2>
                  <span className="text-xs text-muted">
                    {data.gamePage.visualisation.distributionSubtitle}
                  </span>
                </div>

                <div className="h-[190px] flex items-end justify-between gap-3 pt-6">
                  {(() => {
                    const buckets = data.gamePage.visualisation.distributionBuckets;
                    const maxCount = Math.max(1, ...buckets.map((b) => b.count));
                    return buckets.map((b) => {
                      const hPct = Math.max(12, (b.count / maxCount) * 100);
                      return (
                        <div
                          key={b.label}
                          className="flex-1 flex flex-col items-center h-full justify-end"
                        >
                          <span className="text-[13px] font-extrabold text-text mb-1.5 tabular-nums">
                            {b.count}
                          </span>
                          <div
                            style={{
                              height: `${hPct}%`,
                              backgroundColor: b.isPeak
                                ? data.gamePage.game.color
                                : "rgba(184, 121, 79, 0.45)",
                            }}
                            className="w-full rounded-[8px] transition-all"
                          />
                          <span className="text-[11px] text-muted mt-2 text-center truncate w-full">
                            {b.label}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Players Table in this Game */}
              <div className="lg:col-span-6 bg-surface border border-line/50 rounded-[22px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight">
                    Players
                  </h2>
                  <span className="text-xs text-muted">{data.period.label}</span>
                </div>

                <table className="w-full text-left border-collapse tabular-nums">
                  <thead>
                    <tr className="border-b border-line/60 text-[11px] text-muted">
                      <th className="py-2 font-medium">Player</th>
                      <th className="py-2 text-right font-medium">Played</th>
                      <th className="py-2 text-right font-medium">Average</th>
                      <th className="py-2 text-right font-medium">Best</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40 text-[14px]">
                    {data.gamePage.visualisation.playerStats.map((ps) => (
                      <tr key={ps.playerId}>
                        <td className="py-3 font-bold text-text">
                          <button
                            type="button"
                            onClick={() => {
                              setViewedPlayerId(ps.playerId);
                              setActiveTab("players");
                            }}
                            className="flex items-center gap-2.5 hover:underline"
                          >
                            <span
                              style={{ backgroundColor: ps.playerColor }}
                              className="w-1.5 h-5 rounded-full"
                            />
                            <span>{ps.playerName}</span>
                          </button>
                        </td>
                        <td className="py-3 text-right font-bold text-text">
                          {ps.played}
                        </td>
                        <td className="py-3 text-right text-muted font-medium">
                          {ps.averageFormatted}
                        </td>
                        <td className="py-3 text-right text-muted font-medium">
                          {ps.bestFormatted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
            </div>
          </div>
        )}
      </main>

      {/* PERSISTENT MOBILE DOCK (60px Lime "Paste result" pill + 4-tab bar) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-gradient-to-t from-bg via-bg/95 to-transparent pt-3 pb-3 px-5 space-y-2.5">
        <button
          type="button"
          onClick={() => setIsPasteOpen(true)}
          className="btn-primary w-full h-[52px] rounded-full bg-lime text-[#121212] text-[15px] font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          <ClipboardPaste className="w-4 h-4" />
          <span>Paste result</span>
        </button>

        <nav className="bg-surface border border-line/80 rounded-full p-1 grid grid-cols-5 gap-1">
          {[
            { id: "today" as NavTab, label: "League", icon: Trophy },
            { id: "feed" as NavTab, label: "Feed", icon: Activity },
            { id: "statistics" as NavTab, label: "Stats", icon: BarChart3 },
            { id: "games" as NavTab, label: "Games", icon: Gamepad2 },
            { id: "players" as NavTab, label: "Me", icon: Users },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "players") setViewedPlayerId(currentUserId);
                  setActiveTab(item.id);
                }}
                className={`py-2 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors ${
                  active ? "bg-lime text-[#121212]" : "text-muted hover:text-text"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* MULTI-GAME PASTE MODAL */}
      <PasteResultModal
        isOpen={isPasteOpen}
        onClose={() => setIsPasteOpen(false)}
        players={data.players}
        activePlayerId={currentUserId}
        defaultDate={data.todayDate}
        onSubmitted={fetchLeagueData}
      />

      {/* JOIN / ADD PLAYER MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="bg-surface border border-line rounded-[24px] w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-text">
                Join Fatherdle
              </h3>
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(false)}
                className="text-muted hover:text-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {(joinMode !== "new" || !canAddPlayers) && (
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                {data.players.length ? "Choose your name" : "No players yet"}
              </p>
              <div className="flex flex-wrap gap-2">
                {data.players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      chooseIdentity(p.id);
                      setIsJoinModalOpen(false);
                      setActiveTab("today");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-xs font-bold text-text hover:bg-surface2"
                  >
                    <span style={{ backgroundColor: p.color }} className="w-2 h-2 rounded-full" />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            )}
            {joinMode === "both" && canAddPlayers && (
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Or join as new</p>
            )}
            {joinMode !== "existing" && canAddPlayers && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                  Display name
                </label>
                <input
                  type="text"
                  required
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="e.g. Max"
                  className="w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm font-bold text-text focus:outline-none focus:border-lime"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-4 py-2.5 rounded-full border border-line text-xs font-bold text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full bg-lime text-[#121212] text-xs font-extrabold"
                >
                  Join league
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* SHARE CARD MODAL (1080x1350) */}
      {shareModalMode && currentUserStandingRow && (
        <ShareCardModal
          isOpen={Boolean(shareModalMode)}
          onClose={() => setShareModalMode(null)}
          mode={shareModalMode}
          playerRow={
            shareModalMode === "day"
              ? data.today.standings.find((r) => r.player.id === currentUserId) ??
                currentUserStandingRow
              : activeTab === "players" && data.playerPage.standingRow
              ? data.playerPage.standingRow
              : currentUserStandingRow
          }
          allStandings={data.stats.standings}
          period={shareModalMode === "day" ? { ...data.period, endDate: data.todayDate } : data.period}
          dayGames={data.today.games}
          week={shareModalMode === "final" ? shareWeek ?? undefined : data.leagues.current}
        />
      )}
    </div>
  );
}
