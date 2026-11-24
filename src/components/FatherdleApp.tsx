"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  ClipboardPaste,
  ExternalLink,
  List,
  Play,
  Gamepad2,
  Info,
  Share2,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
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
import { MondayBanner, PreviousLeagues } from "@/components/LeaguesAndFeed";
import type { FeedDay, FeedItem, LeagueWeek, LeaguesPayload } from "@/lib/analytics/feed";
import { FeedPage } from "./FeedPage";
import {
  ActivityCalendarHeatmap,
  GameHistoryChart,
  PointsBreakdownChart,
  PointsOverTimeChart,
  PositionBumpChart,
} from "./Charts";
import { HighlightBlocks } from "./HighlightBlocks";
import { StatsDeck } from "./StatsDeck";
import { PlayerGeneral, PlayerHero } from "./PlayerPage";
import { GameStatsView, PlayerGameGrid } from "./GameStats";
import type { GameStatsPanel } from "@/lib/analytics/game-stats";
import type { GroupStats } from "@/lib/analytics/group-stats";
import { GameIcon, GAME_ICON, gameGradient, CountUp } from "./ui";
import { PasteResultModal } from "./PasteResultModal";
import { ShareCardModal } from "./ShareCardModal";

export type NavTab = "today" | "statistics" | "games" | "players" | "onboarding" | "admin" | "feed";

interface LeagueApiResponse {
  todayDate: string;
  leagues: LeaguesPayload;
  groupStats: GroupStats;
  feed: { items: FeedItem[]; hasMore: boolean; geoguessrPlayed: Record<string, string[]>; days: FeedDay[] };
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
    gameStats: Record<string, GameStatsPanel>;
    extra: { streak: number; submittedRate: number | null; weeksIn: number };
    records: PlayerRecordItem[];
    dailySubCounts: Record<string, number>;
  };
  gamePage: {
    game: GameConfig;
    todayStanding: DailyGameStanding;
    visualisation: GameVisualisationData;
    columns: LeaderboardColumn[];
    stats: GameStatsPanel;
  };
}

/** True when dark text reads better on this colour. */
function inkIsDark(hex: string): boolean {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 120;
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
  // Each page keeps its own time range (HANDOVER §3): All time on Statistics and Games, This week elsewhere.
  const [presetByTab, setPresetByTab] = useState<Partial<Record<NavTab, PeriodPreset>>>({
    statistics: "all",
    games: "all",
    players: "week",
  });
  const preset: PeriodPreset = presetByTab[activeTab] ?? "week";
  const setPreset = (v: PeriodPreset) => setPresetByTab((m) => ({ ...m, [activeTab]: v }));
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
  const [shareModalMode, setShareModalMode] = useState<"league" | "final" | "day" | "player" | "game" | null>(null);
  const [shareWeek, setShareWeek] = useState<LeagueWeek | null>(null);
  const [todayView, setTodayView] = useState<"today" | "week" | "leagues">("today");
  const [feedFilter, setFeedFilter] = useState<GameSlug | "all">("all");
  const [feedLimit, setFeedLimit] = useState(60);
  const [feedDate, setFeedDate] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());
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
      if (feedLimit !== 60) params.set("feedLimit", String(feedLimit));
      if (feedDate) params.set("feedDate", feedDate);
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
      setLastUpdated(Date.now());
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
  }, [preset, customKey, viewedPlayerId, selectedGameSlug, gameDate, feedLimit, feedDate]);

  useEffect(() => {
    fetchLeagueData();
  }, [fetchLeagueData]);

  // Keep the selected game or player visible in the phone strips
  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelectorAll('[data-strip-active="true"]').forEach((el) =>
        el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
      );
    }, 50);
    return () => clearTimeout(t);
  }, [selectedGameSlug, viewedPlayerId, activeTab, data?.todayDate]);

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

  // Time-range control shared by Statistics, Games and Players (HANDOVER §3). `onLight` is the
  // variant used on a coloured hero: translucent track, dark selected segment.
  const renderPeriodSelector = (onLight = false) => (
    <div className="flex flex-col gap-2 items-start min-w-0 max-w-full">
      <div className="flex items-center gap-1.5 max-w-full">
        <div
          className={`rounded-full p-1 flex items-center gap-0.5 overflow-x-auto no-scrollbar ${
            onLight ? "bg-black/10" : "bg-surface"
          }`}
        >
          {(
            [
              { id: "today", label: "Today" },
              { id: "week", label: "This week" },
              { id: "month", label: "This month" },
              { id: "all", label: "All time" },
            ] as Array<{ id: PeriodPreset; label: string }>
          ).map((item) => {
            const active = preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreset(item.id)}
                className={`px-2 sm:px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[11.5px] sm:text-[12px] md:text-[13px] font-semibold whitespace-nowrap transition-colors duration-200 ${
                  active
                    ? onLight
                      ? "bg-[#121212] text-text"
                      : "bg-text text-[#121212]"
                    : onLight
                    ? "text-[#121212]/75 hover:text-[#121212]"
                    : "text-muted hover:text-text"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Custom range"
          onClick={() => setPreset("custom")}
          className={`shrink-0 h-9 md:h-10 rounded-full border-[1.5px] inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold w-9 md:w-auto md:px-4 transition-colors ${
            preset === "custom"
              ? onLight
                ? "bg-[#121212] text-text border-[#121212]"
                : "bg-text text-[#121212] border-text"
              : onLight
              ? "border-[#121212]/40 text-[#121212]"
              : "border-line text-muted hover:text-text"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span className="hidden md:inline whitespace-nowrap">Custom range</span>
        </button>
      </div>

      {preset === "custom" && (
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
            onLight ? "bg-black/10 text-[#121212]" : "bg-surface text-text"
          }`}
        >
          <input
            type="date"
            value={customStart}
            max={customEnd}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-transparent font-semibold focus:outline-none"
          />
          <span className="opacity-60">to</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            max={data.todayDate}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-transparent font-semibold focus:outline-none"
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-text pb-[110px] md:pb-16">
      {/* TOP BAR: desktop = wordmark, five tabs, Join + Paste; phone = wordmark + Paste */}
      <header className="sticky top-0 z-30 bg-bg md:border-b md:border-line/60">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 h-[64px] md:h-[80px] flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className="flex items-center gap-2.5 text-left group min-w-0"
          >
            <span className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-lime group-hover:scale-110 transition-transform shrink-0" />
            <span className="text-[12px] md:text-[14px] font-bold tracking-[0.14em] text-lime md:text-text truncate">
              {APP_WORDMARK}
            </span>
          </button>

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
                onClick={() => {
                  if (t.id === "players" && !viewedPlayerId) setViewedPlayerId(currentUserId);
                  setActiveTab(t.id);
                }}
                data-active={activeTab === t.id}
                className={`nav-tab text-[15px] font-semibold ${
                  activeTab === t.id ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {showAdminLink && (
              <button
                type="button"
                onClick={() => setActiveTab("admin")}
                className={`hidden md:inline-flex px-3.5 py-2 rounded-full text-[13px] font-semibold ${
                  activeTab === "admin" ? "text-lime" : "text-muted hover:text-text"
                }`}
              >
                Admin
              </button>
            )}
            {hasJoined ? (
              <label className="relative btn-secondary flex items-center gap-2 rounded-full md:border-[1.5px] md:border-line md:pl-1.5 md:pr-4 md:h-12 cursor-pointer">
                <span
                  style={{ backgroundColor: currentUserPlayer?.color || "#FF8A3D" }}
                  className="w-9 h-9 rounded-full text-[#121212] text-[14px] font-bold flex items-center justify-center"
                >
                  {currentUserPlayer?.avatarInitials}
                </span>
                <span className="hidden md:inline text-[14px] font-semibold">{currentUserPlayer?.name}</span>
                <select
                  aria-label="Who are you?"
                  value={currentUserId}
                  onChange={(e) => {
                    if (e.target.value === "__add") {
                      openJoin("new");
                      return;
                    }
                    if (e.target.value === "__admin") {
                      setActiveTab("admin");
                      return;
                    }
                    chooseIdentity(e.target.value);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  {data.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {isAdmin && <option value="__add">+ Add player…</option>}
                  {showAdminLink && <option value="__admin">Admin panel</option>}
                </select>
              </label>
            ) : (
              <button
                type="button"
                onClick={() => openJoin("both")}
                className="btn-secondary hidden md:flex items-center gap-2 px-5 h-12 rounded-full border-[1.5px] border-line text-[15px] font-semibold text-text whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>Join the league</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => (hasJoined ? setIsPasteOpen(true) : openJoin("both"))}
              className="btn-primary wobble-twice flex items-center gap-2 px-4 md:px-7 h-10 md:h-12 rounded-full bg-lime text-[#121212] text-[13px] md:text-[16px] font-bold whitespace-nowrap"
            >
              <ClipboardPaste className="w-4 h-4 md:w-5 md:h-5" />
              <span>{hasJoined ? "Paste result" : <><span className="md:hidden">Join</span><span className="hidden md:inline">Paste result</span></>}</span>
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
                  className="btn-primary w-full h-[60px] rounded-full bg-lime text-[#121212] text-[17px] font-bold flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Join the league</span>
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
                className="btn-secondary flex w-full h-[60px] rounded-full border-[1.5px] border-line text-text text-[16px] font-semibold items-center justify-center gap-2"
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
          <FeedPage
            items={data.feed.items}
            days={data.feed.days}
            selectedDay={feedDate}
            onSelectDay={setFeedDate}
            lastUpdated={lastUpdated}
            countedLabel={`${data.today.games.filter((g) => g.status === "Qualified").length} of ${data.today.games.length} counted`}
            hasMore={data.feed.hasMore}
            viewerId={hasJoined ? currentUserId : ""}
            geoguessrPlayed={data.feed.geoguessrPlayed}
            onMore={() => setFeedLimit((n) => n + 40)}
            filter={feedFilter}
            onFilter={setFeedFilter}
            games={data.games.map((g) => ({ slug: g.slug, name: g.name }))}
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

          const leader = standings[0];
          const second = standings[1];
          const leadGap = leader && second ? leader.totalPoints - second.totalPoints : 0;
          const openGames = data.today.games.filter((g) => g.status !== "Qualified").length;
          const leadItem = data.feed.items.find((it) => it.kind === "lead" && it.date === data.todayDate);
          const leadClock = leadItem
            ? new Date(leadItem.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
            : "";
          const hasLeader = !!leader && leader.totalPoints > 0;
          const leadText = !hasLeader
            ? weekView
              ? "No points yet this week. The first qualified game starts the table."
              : `No points yet today. A game counts once ${required} of ${Math.max(active, 1)} active players post it.`
            : weekView
            ? `${leader.player.name} leads the week${second && leadGap > 0 ? ` by ${leadGap}` : ""} · day ${wk.daysElapsed} of 7 · ${wk.leadChanges} lead ${wk.leadChanges === 1 ? "change" : "changes"} so far`
            : `${leader.player.name} ${leadItem ? `took the lead at ${leadClock}` : "leads"}${
                second && leadGap > 0 ? ` · ${second.player.name} is ${leadGap} ${leadGap === 1 ? "pt" : "pts"} behind` : second && leadGap === 0 ? ` · level with ${second.player.name}` : ""
              } · ${openGames} ${openGames === 1 ? "game" : "games"} still open`;
          const counted = data.today.games.filter((g) => g.status === "Qualified").length;
          const playedGames = data.today.games
            .filter((g) => g.submissionCount > 0)
            .sort((x, y) => Number(y.status === "Qualified") - Number(x.status === "Qualified") || y.submissionCount - x.submissionCount);
          const quietGames = data.today.games.filter((g) => g.submissionCount === 0);
          const isoWeek = (d: string) => {
            const dt = new Date(`${d}T12:00:00Z`);
            const day = (dt.getUTCDay() + 6) % 7;
            dt.setUTCDate(dt.getUTCDate() - day + 3);
            const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
            return 1 + Math.round(((dt.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
          };

          const tabs = (
            <div className="inline-flex bg-surface rounded-full p-1">
              {(
                [
                  ["today", "Today"],
                  ["week", "This week"],
                  ["leagues", "Previous"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTodayView(id)}
                  className={`px-4 md:px-5 py-2 rounded-full text-[13px] md:text-[14px] font-semibold whitespace-nowrap transition-colors duration-200 ${
                    todayView === id ? "bg-text text-[#121212]" : "text-muted hover:text-text"
                  }`}
                >
                  {label}
                  {id === "leagues" && <span className="hidden md:inline"> leagues</span>}
                </button>
              ))}
            </div>
          );

          const bars = (
            <div className="space-y-2 md:space-y-2.5">
              {standings.map((row, idx) => {
                const isMe = row.player.id === currentUserId;
                const played = row.gamesPlayed > 0;
                const pct = played ? Math.max(34, (row.totalPoints / maxPts) * 100) : 26;
                const sub = !played
                  ? weekView
                    ? "Nothing submitted yet"
                    : "Not submitted yet"
                  : weekView
                  ? `${row.qualifiedGamesPlayed} counted · ${row.firstPlaces} ${row.firstPlaces === 1 ? "win" : "wins"}`
                  : `${row.qualifiedGamesPlayed} of ${counted} counted · ${row.firstPlaces} ${row.firstPlaces === 1 ? "win" : "wins"}`;
                return (
                  <div key={row.player.id} className="bar-row flex items-center gap-3 md:gap-5 h-[50px] md:h-[66px]">
                    <span className="font-serif text-[30px] md:text-[48px] leading-none w-5 md:w-9 text-muted shrink-0">
                      {row.rank}
                    </span>
                    <div className="flex-1 relative h-full min-w-0">
                      <button
                        type="button"
                        onClick={() => openPlayer(row.player.id)}
                        style={{
                          width: `${pct}%`,
                          animationDelay: `${idx * 60}ms`,
                          ...(played ? { backgroundColor: row.player.color } : {}),
                        }}
                        className={`bar-fill grow-in absolute left-0 top-0 h-full min-w-[96px] md:min-w-[160px] rounded-[12px] md:rounded-[14px] text-left px-3.5 md:px-5 flex items-center gap-3 ${
                          played ? "text-[#121212]" : "text-muted bg-surface2 md:outline md:outline-1 md:outline-line"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-[17px] md:text-[22px] font-bold tracking-[-0.3px] leading-tight truncate">
                            {row.player.name}
                          </span>
                          <span className={`hidden md:block text-[13px] ${played ? "opacity-70" : ""}`}>
                            {sub}
                            {isMe && played ? " · you" : ""}
                          </span>
                        </span>
                        {isMe && (
                          <span className="hidden md:inline-flex ml-auto shrink-0 rounded-full bg-[#121212] text-text px-2.5 py-0.5 text-[11px] font-bold tracking-[0.1em]">
                            YOU
                          </span>
                        )}
                      </button>
                    </div>
                    <span className="bar-score font-serif text-[36px] md:text-[56px] leading-none w-[56px] md:w-[96px] text-right tabular-nums shrink-0">
                      {played ? <CountUp value={row.totalPoints} /> : <span className="text-muted">–</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          );

          const leadStrip = (
            <div className="bg-surface rounded-[14px] px-4 md:px-5 py-3 md:py-3.5 flex items-center gap-2.5 md:gap-3 text-[13px] md:text-[14px]">
              <Zap className="w-4 h-4 text-lime shrink-0" />
              <span className="min-w-0">{leadText}</span>
            </div>
          );

          const gameTile = (dg: (typeof data.today.games)[number]) => {
            const g = GAMES[dg.gameSlug];
            const done = data.players.filter((p) => dg.rankings.some((r) => r.playerId === p.id));
            const isCounted = dg.status === "Qualified";
            return (
              <button
                key={dg.gameSlug}
                type="button"
                onClick={() => openGame(g.slug)}
                className={`game-tile rounded-[14px] p-3 md:p-3.5 text-left space-y-2.5 min-w-0 ${
                  isCounted ? "bg-surface2" : "bg-transparent outline outline-1 outline-line -outline-offset-1"
                }`}
              >
                <div className="flex items-center gap-2 md:gap-2.5">
                  <GameIcon slug={g.slug} size={26} />
                  <span className="text-[13px] md:text-[14px] font-semibold leading-tight flex-1 min-w-0 line-clamp-2 [overflow-wrap:anywhere]">{g.name}</span>
                  <span className={`text-[12px] font-bold tabular-nums shrink-0 ${isCounted ? "text-lime" : "text-muted"}`}>
                    {dg.submissionCount}/{dg.totalPlayers}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {done.slice(0, 3).map((p) => (
                    <span key={p.id} style={{ backgroundColor: p.color }} className="rounded-[6px] px-1.5 py-[1px] text-[11px] font-semibold text-[#121212]">
                      {p.name}
                    </span>
                  ))}
                  {done.length > 3 && (
                    <span className="rounded-[6px] px-1.5 py-[1px] text-[11px] font-semibold text-muted bg-[#121212]/40">+{done.length - 3}</span>
                  )}
                </div>
              </button>
            );
          };

          const gamesPanel = (
            <div className="md:bg-surface md:rounded-[24px] md:p-6 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="hidden md:block text-[13px] text-muted">Games today</div>
                  <h2 className="text-[22px] md:text-[26px] font-bold tracking-[-0.3px]">
                    <span className="md:hidden">Games today</span>
                    <span className="hidden md:inline">
                      {counted} of {totalGames} counted
                    </span>
                  </h2>
                </div>
                <span className="text-[12px] text-muted text-right">
                  <span className="md:hidden">
                    {counted} of {totalGames} counted
                  </span>
                  <span className="hidden md:inline">½ of active players = counts</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {playedGames.map(gameTile)}
                {/* phone: quiet games as dimmed tiles */}
                {quietGames.map((dg) => (
                  <div key={dg.gameSlug} className="md:hidden rounded-[14px] p-3 outline outline-1 outline-line -outline-offset-1 opacity-50 space-y-2">
                    <div className="flex items-center gap-2">
                      <GameIcon slug={dg.gameSlug} size={26} />
                      <span className="text-[13px] font-semibold flex-1 min-w-0 truncate">{GAMES[dg.gameSlug].name}</span>
                      <span className="text-[12px] font-bold text-muted">0/{dg.totalPlayers}</span>
                    </div>
                    <div className="text-[11px] text-muted">No one yet</div>
                  </div>
                ))}
              </div>
              {quietGames.length > 0 && (
                <div className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] outline outline-1 outline-line -outline-offset-1 px-3.5 py-3">
                  <span className="text-[12px] font-semibold text-muted">Still quiet</span>
                  {quietGames.map((dg) => (
                    <button
                      key={dg.gameSlug}
                      type="button"
                      onClick={() => openGame(dg.gameSlug)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold hover:text-lime"
                    >
                      <GameIcon slug={dg.gameSlug} size={18} />
                      {GAMES[dg.gameSlug].name}
                      <span className="text-muted">0/{dg.totalPlayers}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => (hasJoined ? setIsPasteOpen(true) : openJoin("both"))}
                className="hidden md:flex btn-primary w-full h-14 rounded-[16px] bg-lime text-[#121212] text-[16px] font-bold items-center justify-between px-5"
              >
                Paste today&apos;s result
                <ClipboardPaste className="w-5 h-5" />
              </button>
            </div>
          );

          const previousCards = (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {data.leagues.previous.length === 0 && (
                <div className="bg-surface rounded-[20px] p-6 text-muted text-[14px] md:col-span-2">
                  The first league finishes on {firstLeagueEnds}.
                </div>
              )}
              {data.leagues.previous.map((w) => {
                const rows = w.standings.filter((r) => r.played);
                const win = rows[0];
                const run = rows[1];
                if (!win) return null;
                return (
                  <div
                    key={w.startDate}
                    style={{ backgroundColor: win.color }}
                    className="game-tile relative rounded-[20px] text-[#121212] p-4 md:p-5 flex items-center gap-4"
                  >
                    <button type="button" onClick={() => openWeekResults(w)} className="absolute inset-0 rounded-[20px]" aria-label={`Open ${w.label}`} />
                    <span className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#121212] text-[18px] md:text-[20px] font-bold flex items-center justify-center shrink-0" style={{ color: win.color }}>
                      {win.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold opacity-70">
                        Week {isoWeek(w.startDate)} · {w.label}
                      </div>
                      <div className="text-[22px] md:text-[26px] font-bold tracking-[-0.5px] leading-tight truncate">{win.name} won</div>
                      <div className="text-[12px] opacity-70 truncate">
                        {run ? `Runner-up ${run.name} ${run.points}` : "No runner-up"}
                      </div>
                    </div>
                    <span className="font-serif text-[44px] md:text-[52px] leading-none">{win.points}</span>
                    <button
                      type="button"
                      onClick={() => shareFinal(w)}
                      aria-label="Share this league"
                      className="relative z-10 w-9 h-9 rounded-full bg-[#121212]/10 hover:bg-[#121212]/20 flex items-center justify-center shrink-0"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          );

          return (
            <div className="space-y-5 md:space-y-6">
              {todayView === "today" && banner}
              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_484px] lg:gap-12 lg:items-start space-y-6 lg:space-y-0">
                <div className={`space-y-5 md:space-y-6 min-w-0 ${todayView !== "today" ? "lg:col-span-2" : ""}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h1 className="text-[44px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">League</h1>
                    <div className="flex items-center gap-2">
                      {tabs}
                      {todayView !== "leagues" && (
                        <button
                          type="button"
                          aria-label={weekView ? "Share this week" : "Share my day"}
                          onClick={shareHere}
                          className="btn-secondary w-10 h-10 md:w-11 md:h-11 rounded-full bg-surface flex items-center justify-center shrink-0"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {todayView === "leagues" ? (
                    previousCards
                  ) : (
                    <>
                      {bars}
                      {leadStrip}
                      {weekView && weekTiles}
                    </>
                  )}
                </div>
                {todayView === "today" && gamesPanel}
              </div>
            </div>
          );
        })()}

        {/* =========================================================
            3. GLOBAL STATISTICS VIEW (Screens 3 & 4)
           ========================================================= */}
        {activeTab === "statistics" && (
          <div className="space-y-7">
            {/* Title & Period Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h1 className="text-[44px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">
                Statistics
              </h1>
              {renderPeriodSelector()}
            </div>

            <StatsDeck stats={data.groupStats} />
          </div>
        )}

        {/* =========================================================
            4. INDIVIDUAL PLAYER PAGE (Screens 5 & 7)
           ========================================================= */}
        {activeTab === "players" && data.playerPage.standingRow && (
          <div className="space-y-5">
            <h1 className="lg:hidden text-[44px] font-bold tracking-[-1.5px] leading-none">Players</h1>
            <div className="lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-8 lg:items-start space-y-5 lg:space-y-0">
            <aside className="hidden lg:block sticky top-[100px] p-1 -m-1">
              <div className="px-3 pb-2 text-[11px] font-bold tracking-[1.6px] uppercase text-muted">
                {data.players.length} players
              </div>
              {data.players.map((p) => {
                const active = p.id === data.playerPage.player.id;
                const row = data.stats.standings.find((r) => r.player.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setViewedPlayerId(p.id)}
                    style={active ? { outlineColor: p.color } : undefined}
                    className={`rail-item w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-left ${
                      active ? "bg-surface2 outline outline-1" : ""
                    }`}
                  >
                    <span style={{ backgroundColor: p.color }} className="w-9 h-9 rounded-full text-[#121212] text-[15px] font-bold flex items-center justify-center shrink-0">
                      {p.avatarInitials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold truncate">{p.name}</span>
                      <span className="block text-[12px] text-muted truncate">
                        {row ? `${row.gamesPlayed} games · ${row.firstPlaces} ${row.firstPlaces === 1 ? "win" : "wins"}` : "no games"}
                      </span>
                    </span>
                    <span className="font-serif text-[28px] leading-none text-muted">{row ? row.totalPoints : 0}</span>
                  </button>
                );
              })}
            </aside>
            <div className="lg:hidden flex items-start gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 py-1">
              {data.players.map((p) => {
                const active = p.id === data.playerPage.player.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-strip-active={active}
                    onClick={() => setViewedPlayerId(p.id)}
                    className="shrink-0 w-[58px] flex flex-col items-center gap-1.5"
                  >
                    <span
                      style={{ backgroundColor: p.color, boxShadow: active ? `0 0 0 2px #121212, 0 0 0 4px ${p.color}` : undefined }}
                      className="w-12 h-12 rounded-full text-[#121212] text-[17px] font-bold flex items-center justify-center"
                    >
                      {p.avatarInitials}
                    </span>
                    <span className={`text-[11px] truncate w-full text-center ${active ? "text-text font-semibold" : "text-muted"}`}>{p.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-6 min-w-0">

            <PlayerHero
              player={data.playerPage.player}
              row={data.playerPage.standingRow}
              period={data.period}
              series={data.stats.timeSeries.series}
              strengths={data.playerPage.strengths}
              extra={data.playerPage.extra}
              todayDate={data.todayDate}
              dailySubCounts={data.playerPage.dailySubCounts}
              periodControl={renderPeriodSelector(inkIsDark(data.playerPage.player.color))}
              onShare={() => setShareModalMode("player")}
            />

            <PlayerGeneral
              player={data.playerPage.player}
              leagues={data.leagues}
              records={data.playerPage.records}
              dailySubCounts={data.playerPage.dailySubCounts}
              todayDate={data.todayDate}
            />

            <PlayerGameGrid strengths={data.playerPage.strengths} gameStats={data.playerPage.gameStats} playerName={data.playerPage.player.name} accent={data.playerPage.player.color} />
            </div>
            </div>
          </div>
        )}

        {/* =========================================================
            5. INDIVIDUAL GAME PAGE (Screens 6 & 8)
           ========================================================= */}
        {activeTab === "games" && (
          <div className="space-y-6">
            <h1 className="lg:hidden text-[44px] font-bold tracking-[-1.5px] leading-none">Games</h1>

            <div className="lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-8 lg:items-start space-y-5 lg:space-y-0">
            {/* Rail (desktop): every game with today's leader */}
            <aside className="hidden lg:block sticky top-[100px] max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar p-1 -m-1">
              <div className="px-3 pb-2 text-[11px] font-bold tracking-[1.6px] uppercase text-muted">
                {data.games.length} games
              </div>
              {data.games.map((g) => {
                const active = g.slug === selectedGameSlug;
                const today = data.today.games.find((x) => x.gameSlug === g.slug);
                const lead = today?.rankings[0];
                return (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setSelectedGameSlug(g.slug)}
                    className={`rail-item w-full flex items-center gap-3 px-3 py-2 rounded-[14px] text-left ${
                      active ? "bg-surface2 outline outline-1 outline-lime" : ""
                    }`}
                  >
                    <GameIcon slug={g.slug} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold truncate">{g.name}</span>
                      <span className="block text-[12px] text-muted truncate">
                        Lead · {lead ? `${lead.playerName} ${lead.displayResult}` : "—"}
                      </span>
                    </span>
                    {active && <ChevronRight className="w-4 h-4 text-lime shrink-0" />}
                  </button>
                );
              })}
            </aside>
            {/* Icon strip (phone) */}
            <div className="lg:hidden flex items-start gap-1 overflow-x-auto no-scrollbar -mx-5 px-5 py-1">
              {data.games.map((g) => {
                const active = g.slug === selectedGameSlug;
                return (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setSelectedGameSlug(g.slug)}
                    data-strip-active={active}
                    className={`shrink-0 w-[76px] py-2 rounded-[16px] flex flex-col items-center gap-1.5 ${
                      active ? "outline outline-1 outline-lime bg-surface2" : ""
                    }`}
                    aria-label={g.name}
                  >
                    <GameIcon slug={g.slug} size={48} />
                    <span className={`text-[11px] w-full px-1 truncate text-center ${active ? "text-text" : "text-muted"}`}>
                      {g.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-6 min-w-0">

            {/* Hero in the game's colours: name, Play, time range, KPIs */}
            {(() => {
              const g = data.gamePage.game;
              const fg = GAME_ICON[g.slug]?.fg ?? "#121212";
              const kpis = [
                { label: "results posted", value: String(data.gamePage.stats.results) },
                ...data.gamePage.stats.kpis,
              ].slice(0, 4);
              return (
                <div
                  style={{ background: gameGradient(g.slug, 135), color: fg }}
                  className="rounded-[24px] p-5 md:p-9 space-y-5 md:space-y-7"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2
                      className={`font-bold leading-[0.95] tracking-[-2px] break-words min-w-0 ${
                        g.name.length > 14 ? "text-[30px] md:text-[56px]" : "text-[40px] md:text-[88px]"
                      }`}
                    >
                      {g.name}
                    </h2>
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noreferrer"
                      className="md:hidden btn-primary shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#121212] text-text text-[14px] font-semibold"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Play
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hidden md:inline-flex btn-primary items-center gap-2.5 h-12 px-6 rounded-full bg-[#121212] text-text text-[15px] font-semibold"
                    >
                      <Play className="w-4 h-4" />
                      Play {g.name.length > 14 ? "" : g.name}
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                    <div className="max-w-full">{renderPeriodSelector(fg === "#121212")}</div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 border-t border-current/30" style={{ borderColor: fg === "#121212" ? "rgba(18,18,18,0.35)" : "rgba(255,255,255,0.4)" }}>
                    {kpis.map((k, i) => (
                      <div
                        key={k.label}
                        className={`pt-4 md:pt-5 pb-1 ${i % 2 === 1 ? "pl-4 md:pl-6" : "md:pl-6"} ${i === 0 ? "md:pl-0" : ""} ${
                          i > 0 ? "md:border-l" : ""
                        } ${i >= 2 ? "border-t md:border-t-0" : ""}`}
                        style={{ borderColor: fg === "#121212" ? "rgba(18,18,18,0.35)" : "rgba(255,255,255,0.4)" }}
                      >
                        <div className="font-serif text-[40px] md:text-[56px] leading-none tracking-[-1px]">
                          <span className="stat-num">{k.value}</span>
                        </div>
                        <div className="text-[12px] md:text-[13px] mt-1 opacity-80">{k.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
                    <span className="px-3 py-1 rounded-full bg-black/15">
                      Today {data.gamePage.todayStanding.submissionCount} of {data.gamePage.todayStanding.totalPlayers}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-black/15">
                      {data.gamePage.todayStanding.status === "Qualified"
                        ? "Counts today"
                        : data.gamePage.todayStanding.status === "Pending"
                        ? `Pending: needs ${data.gamePage.todayStanding.requiredCount}`
                        : "Excluded"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShareModalMode("game")}
                      className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121212] text-text"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>
                  </div>
                </div>
              );
            })()}

            <GameStatsView
              slug={data.gamePage.game.slug}
              stats={data.gamePage.stats}
              today={data.gamePage.todayStanding}
            />

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
              {/* Players Table in this Game */}
              <div className="lg:col-span-12 bg-surface rounded-[22px] p-6 space-y-4">
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

      {/* PHONE DOCK: five equal tabs, icon over label, selected tab filled lime */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#1A1A19] border-t border-line/50 px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1.5">
        {[
          { id: "today" as NavTab, label: "League", icon: Trophy },
          { id: "feed" as NavTab, label: "Feed", icon: List },
          { id: "statistics" as NavTab, label: "Stats", icon: BarChart3 },
          { id: "games" as NavTab, label: "Games", icon: Gamepad2 },
          { id: "players" as NavTab, label: "Players", icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "players" && !viewedPlayerId) setViewedPlayerId(currentUserId);
                setActiveTab(item.id);
              }}
              className={`h-[52px] rounded-[16px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-200 ${
                active ? "bg-lime text-[#121212]" : "text-muted active:text-text"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={1.75} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

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
          period={
            shareModalMode === "day"
              ? { ...data.period, endDate: data.todayDate }
              : shareModalMode === "game"
              ? { ...data.period, endDate: gameDate || data.todayDate }
              : data.period
          }
          dayGames={data.today.games}
          dayStandings={data.today.standings}
          gameStanding={data.gamePage.todayStanding}
          gameStats={data.gamePage.stats}
          week={shareModalMode === "final" ? shareWeek ?? undefined : data.leagues.current}
        />
      )}
    </div>
  );
}
