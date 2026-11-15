import { getStore } from "@netlify/blobs";
import { nodeFetch } from "./node-fetch";
import fs from "fs";
import path from "path";
import { DEFAULT_PLAYERS } from "../constants";
import { getLondonDateString } from "../analytics/dates";
import { GameSlug, Player, Submission } from "../types";
import { parseMultiGamePaste } from "../parsers";
import quizboisSeed from "../seed/quizbois-seed.json";
import newGamesBackfill from "../seed/backfill-newgames.json";

/**
 * Storage layer.
 *
 * League data (players + submissions) lives in one JSON document that is kept in memory
 * and persisted to:
 *   - Netlify Blobs when running on Netlify (survives deploys and cold starts)
 *   - data/league.json when running locally
 *
 * FATHERDLE_DEMO=1 seeds a fictional six-player league and pins "today" to 2026-11-14.
 * Without it the league starts empty and "today" is the real Europe/London date.
 */

export const DEMO_TODAY = "2026-11-14";

export function isDemoMode(): boolean {
  return process.env.FATHERDLE_DEMO === "1" || process.env.FATHERDLE_DEMO === "true";
}

export function getTodayDate(): string {
  // FATHERDLE_TODAY=YYYY-MM-DD pretends it is that day (handy for trying the Monday banner)
  const forced = process.env.FATHERDLE_TODAY;
  if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) return forced;
  return isDemoMode() ? DEMO_TODAY : getLondonDateString();
}

interface LeagueData {
  players: Player[];
  submissions: Submission[];
  /** One-off data migrations that have already been applied to this league. */
  appliedBackfills?: string[];
}

const BLOB_STORE = "fatherdle";
const BLOB_KEY = isDemoMode() ? "league-demo" : "league";
const LOCAL_FILE = path.join(
  process.cwd(),
  "data",
  isDemoMode() ? "league-demo.json" : "league.json"
);

function onNetlify(): boolean {
  // Serverless runtimes have a read-only filesystem, so anything that looks like Netlify/Lambda
  // must use Blobs. Only plain local Node falls back to a JSON file.
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_BLOBS_CONTEXT ||
      process.env.NETLIFY_DEV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT
  );
}

export function storageKind(): "netlify-blobs" | "local-file" {
  return onNetlify() ? "netlify-blobs" : "local-file";
}

let cache: LeagueData | null = null;
let loading: Promise<LeagueData> | null = null;
let writeChain: Promise<void> = Promise.resolve();

/**
 * Next.js wraps the global fetch with its own caching layer; hand the Blobs client the original,
 * unwrapped fetch so requests behave like plain Node fetches.
 */
function rawFetch(): typeof fetch {
  // Node's own http/https client: the platform fetch hung on every Blobs request.
  return nodeFetch as typeof fetch;
}

interface BlobsContext {
  apiURL?: string;
  edgeURL?: string;
  uncachedEdgeURL?: string;
  primaryRegion?: string;
  siteID?: string;
  token?: string;
  deployID?: string;
}

function blobsContext(): BlobsContext {
  const raw =
    (globalThis as { netlifyBlobsContext?: string }).netlifyBlobsContext ||
    process.env.NETLIFY_BLOBS_CONTEXT;
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as BlobsContext;
  } catch {
    return {};
  }
}

type StoreRoute = { label: string; open: () => ReturnType<typeof getStore>; timeoutMs: number };

/**
 * Ways of reaching the store, tried in order. Manual credentials win if set; otherwise the
 * automatic edge route, then the Netlify API using the same automatic credentials.
 */
function storeRoutes(): StoreRoute[] {
  const siteID = process.env.FATHERDLE_BLOBS_SITE_ID;
  const token = process.env.FATHERDLE_BLOBS_TOKEN;
  if (siteID && token) {
    return [
      {
        label: "manual credentials",
        open: () => getStore({ name: BLOB_STORE, siteID, token, fetch: rawFetch() }),
        timeoutMs: 7000,
      },
    ];
  }
  const ctx = blobsContext();
  const routes: StoreRoute[] = [
    { label: "edge", open: () => getStore({ name: BLOB_STORE, fetch: rawFetch() }), timeoutMs: 3000 },
  ];
  if (ctx.siteID && ctx.token) {
    routes.push({
      label: "api",
      open: () =>
        getStore({
          name: BLOB_STORE,
          siteID: ctx.siteID!,
          token: ctx.token!,
          apiURL: ctx.apiURL,
          fetch: rawFetch(),
        }),
      timeoutMs: 4000,
    });
  }
  return routes;
}

let workingRoute: StoreRoute | null = null;

/** Runs a Blobs call on the route that last worked, or tries each route until one does. */
async function onStore<T>(
  what: string,
  fn: (store: ReturnType<typeof getStore>) => Promise<T>
): Promise<T> {
  const routes = workingRoute ? [workingRoute] : storeRoutes();
  const errors: string[] = [];
  for (const route of routes) {
    try {
      const result = await withTimeout(fn(route.open()), route.timeoutMs, `Netlify Blobs ${what} (${route.label})`);
      workingRoute = route;
      return result;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  workingRoute = null;
  throw new Error(errors.join("; "));
}

/** What the server can see about its Blobs setup, for /api/health (no secrets). */
export function blobDiagnostics() {
  const f = globalThis.fetch as typeof fetch & { _nextOriginalFetch?: unknown; __nextPatched?: unknown };
  const ctx = blobsContext();
  const host = (u?: string) => {
    try {
      return u ? new URL(u).host : null;
    } catch {
      return "invalid";
    }
  };
  return {
    envContext: Boolean(process.env.NETLIFY_BLOBS_CONTEXT),
    globalContext: Boolean((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext),
    contextKeys: Object.keys(ctx),
    apiHost: host(ctx.apiURL),
    edgeHost: host(ctx.edgeURL),
    uncachedEdgeHost: host(ctx.uncachedEdgeURL),
    primaryRegion: ctx.primaryRegion ?? null,
    manualCredentials: Boolean(process.env.FATHERDLE_BLOBS_SITE_ID && process.env.FATHERDLE_BLOBS_TOKEN),
    usingOriginalFetch: Boolean(f._nextOriginalFetch),
    workingRoute: workingRoute?.label ?? null,
  };
}

/** Fail with a readable message instead of hanging until the platform kills the request. */
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function readPersisted(): Promise<LeagueData | null> {
  if (onNetlify()) {
    const value = await onStore("read", (store) => store.get(BLOB_KEY, { type: "json" }));
    return (value as LeagueData | null) ?? null;
  }
  try {
    return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8")) as LeagueData;
  } catch {
    return null;
  }
}

async function writePersisted(data: LeagueData): Promise<void> {
  if (onNetlify()) {
    await onStore("write", (store) => store.setJSON(BLOB_KEY, data));
    return;
  }
  fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(data));
}

/**
 * Wordishingrilliontapdle and Noillirk used to store their unit in the result text ("10,857 pts",
 * "5,863m"). The unit is implied by the game, so keep just the number. Returns true if anything changed.
 */
function normalizeResults(data: LeagueData): boolean {
  let changed = false;
  for (const s of data.submissions) {
    let next = s.displayResult;
    if (s.gameSlug === "wordishingrilliontapdle") next = next.replace(/\s*pts$/i, "");
    else if (s.gameSlug === "noillirk") next = next.replace(/m$/i, "");
    if (next !== s.displayResult) {
      s.displayResult = next;
      changed = true;
    }
  }
  return changed;
}

const CACHE_TTL_MS = 2000;
let cachedAt = 0;

/**
 * Several function instances can run at once, so the in-memory copy is only trusted for a
 * couple of seconds, and every write starts from a fresh read.
 */
async function load(forWrite = false): Promise<LeagueData> {
  if (cache && !forWrite && Date.now() - cachedAt < CACHE_TTL_MS) return cache;
  if (!loading) {
    loading = (async () => {
      let data = await readPersisted();
      const empty = !data || (data.players.length === 0 && data.submissions.length === 0);
      if (!data || (empty && !isDemoMode() && seedEnabled())) {
        data = isDemoMode()
          ? buildDemoDataset()
          : seedEnabled()
          ? mergeQuizboisSeed({ players: [], submissions: [] })
          : { players: [], submissions: [] };
        await writePersisted(data);
      }
      const normalised = normalizeResults(data);
      const backfilled = applyBackfills(data);
      if (normalised || backfilled) await writePersisted(data);
      cache = data;
      cachedAt = Date.now();
      return data;
    })().finally(() => {
      loading = null;
    });
  }
  return loading;
}

/** Serialise writes so concurrent requests can't clobber each other. */
function persist(data: LeagueData): Promise<void> {
  writeChain = writeChain.then(async () => {
    await writePersisted(data);
    cachedAt = Date.now();
  });
  return writeChain;
}

const SEED_PALETTE = ["#E6EB5E", "#FF8A3D", "#E3CDBE", "#6FA8DC", "#8A8C45", "#F2A7C3", "#5CC8B0", "#B388FF", "#B8794F"];

function seedEnabled(): boolean {
  return process.env.FATHERDLE_SEED !== "none";
}

/**
 * Merges the Quizbois chat history (9-14 Nov 2026) into a league document: adds missing players by
 * first name and upserts every parsed result. Safe to run more than once.
 */
const slugOfName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Parses each entry's share text and adds the results for the matching player (by first name). */
function applySeedEntries(
  data: LeagueData,
  entries: Array<{ date: string; player: string; text: string }>,
  overwrite: boolean
): number {
  let added = 0;
  for (const entry of entries) {
    const player = data.players.find((p) => p.slug === slugOfName(entry.player));
    if (!player) continue;
    for (const item of parseMultiGamePaste(entry.text).parsed) {
      const exists = data.submissions.some(
        (x) => x.playerId === player.id && x.gameSlug === item.gameSlug && x.leagueDate === entry.date
      );
      if (exists && !overwrite) continue;
      const id = `sub_${entry.date}_${item.gameSlug}_${player.id}`;
      const sub: Submission = {
        id,
        playerId: player.id,
        gameSlug: item.gameSlug,
        leagueDate: entry.date,
        puzzleId: item.puzzleId,
        rawText: item.rawText,
        primaryValue: item.primaryValue,
        secondaryValue: item.secondaryValue,
        tertiaryValue: item.tertiaryValue,
        displayResult: item.displayResult,
        failed: item.failed,
        metadataJson: JSON.stringify(item.metadata),
        submittedAt: `${entry.date}T12:00:00.000Z`,
        isLate: false,
        isCorrected: false,
      };
      const i = data.submissions.findIndex((x) => x.id === id);
      if (i >= 0) data.submissions[i] = sub;
      else data.submissions.push(sub);
      added++;
    }
  }
  return added;
}

/**
 * Adds history for games that were supported later (Metrodle, Connections, Strands) to leagues that
 * already exist. Runs once per league, never overwrites a result, and skips players that were
 * renamed or removed.
 */
function applyBackfills(data: LeagueData): boolean {
  const done = (data.appliedBackfills ??= []);
  if (done.includes(newGamesBackfill.id)) return false;
  if (!isDemoMode() && seedEnabled()) applySeedEntries(data, newGamesBackfill.entries, false);
  done.push(newGamesBackfill.id);
  return true;
}

export function mergeQuizboisSeed(data: LeagueData): LeagueData {
  const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const sp of quizboisSeed.players) {
    if (!data.players.some((p) => p.slug === slugOf(sp.name))) {
      data.players.push({
        id: `p_${slugOf(sp.name)}`,
        slug: slugOf(sp.name),
        name: sp.name,
        color: SEED_PALETTE[data.players.length % SEED_PALETTE.length],
        avatarInitials: sp.name.slice(0, 1).toUpperCase(),
        joinedAt: sp.joinedAt,
      });
    }
  }
  applySeedEntries(data, quizboisSeed.entries, true);
  return data;
}

export async function importQuizboisSeed(): Promise<{ players: number; submissions: number }> {
  const data = mergeQuizboisSeed(await load(true));
  await persist(data);
  return { players: data.players.length, submissions: data.submissions.length };
}

function buildDemoDataset(): LeagueData {
  const players: Player[] = [];
  const submissions: Submission[] = [];
  {
    players.push(...DEFAULT_PLAYERS);

    // Generate dates from 2026-10-12 to 2026-11-14 (34 days)
    const start = new Date("2026-10-12T12:00:00Z");
    const end = new Date("2026-11-14T12:00:00Z");

    let dayIdx = 0;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dateStr === "2026-11-14";

      // Core daily games played by the group
      const dailyGames: GameSlug[] = [
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

      for (const gameSlug of dailyGames) {
        // Determine participating players for this game on this date
        const activePlayers = DEFAULT_PLAYERS.filter((p, pIdx) => {
          if (p.joinedAt > dateStr) return false;
          if (isToday) {
            // Today (Sat 14 Nov): some games are Qualified (4-6 submitted), some Pending (1-3 submitted)
            if (gameSlug === "wordle") return true; // 6 of 6
            if (gameSlug === "maptap") return pIdx < 5; // 5 of 6
            if (gameSlug === "flagle") return pIdx < 4; // 4 of 6
            if (gameSlug === "wordishingrilliontapdle") return pIdx < 5; // 5 of 6
            if (gameSlug === "catfishing") return pIdx < 4; // 4 of 6
            if (gameSlug === "krillion") return pIdx < 2; // 2 of 6 (Pending)
            if (gameSlug === "huedle") return pIdx < 3; // 3 of 6 (Pending)
            if (gameSlug === "noillirk") return pIdx < 2; // 2 of 6 (Pending)
            if (gameSlug === "poople") return pIdx < 1; // 1 of 6 (Pending)
          }

          // Historical days: vary participation so most games qualify (4-6) and occasional ones are excluded (<4)
          const hash = (dayIdx * 17 + pIdx * 31 + gameSlug.length * 13) % 20;
          if (gameSlug === "poople" && dayIdx % 4 === 0) {
            return pIdx < 2; // Excluded (<4) on some days
          }
          if (pIdx === 5) return hash < 13; // Dan plays ~65%
          if (pIdx === 4) return hash < 15; // Jo plays ~75%
          if (pIdx === 3) return hash < 17; // Sam plays ~85%
          if (pIdx === 2) return hash < 18; // Maya plays ~90%
          return hash < 19; // Chris & Alex play ~95%
        });

        for (let i = 0; i < activePlayers.length; i++) {
          const player = activePlayers[i];
          const pIdx = DEFAULT_PLAYERS.findIndex((x) => x.id === player.id);
          const seedVal = (dayIdx * 23 + pIdx * 7 + gameSlug.charCodeAt(0) * 11) % 100;

          // Make Alex strong early in the week (8-12 Nov) and Chris overtake on 13-14 Nov
          const isChrisPeak = pIdx === 0 && dateStr >= "2026-11-12";
          const isAlexStrong = pIdx === 1 && dateStr >= "2026-11-08" && dateStr <= "2026-11-12";
          const isMayaClimb = pIdx === 2 && dateStr >= "2026-11-08";

          const perfBoost = isChrisPeak ? 2 : isAlexStrong ? 2 : isMayaClimb ? 1 : 0;
          const skillTier = Math.max(0, 5 - pIdx + perfBoost); // 0..7

          const generated = buildDeterministicSubmission(
            player.id,
            gameSlug,
            dateStr,
            dayIdx,
            pIdx,
            skillTier,
            seedVal
          );

          submissions.push(generated);
        }
      }

      dayIdx++;
    }
  }
  return { players, submissions };
}

function buildDeterministicSubmission(
  playerId: string,
  gameSlug: GameSlug,
  dateStr: string,
  dayIdx: number,
  pIdx: number,
  skillTier: number,
  seedVal: number
): Submission {
  const id = `sub_${dateStr}_${gameSlug}_${playerId}`;
  const submittedAt = `${dateStr}T${String(9 + (pIdx % 8)).padStart(2, "0")}:${String(
    (seedVal * 3) % 60
  ).padStart(2, "0")}:00.000Z`;

  switch (gameSlug) {
    case "wordle": {
      const puzzleNum = 1940 + dayIdx;
      const baseAttempts = 6 - Math.min(4, Math.floor((skillTier + (seedVal % 4)) / 2));
      const attempts = Math.max(2, Math.min(6, baseAttempts));
      const hardMode = pIdx <= 1;
      const disp = `${attempts}/6${hardMode ? "*" : ""}`;
      return {
        id,
        playerId,
        gameSlug,
        leagueDate: dateStr,
        puzzleId: `#${puzzleNum}`,
        rawText: `Wordle ${puzzleNum.toLocaleString("en-GB")} ${disp}\n\n⬜🟨⬜⬜⬜\n🟩🟩🟩🟩🟩`,
        primaryValue: attempts,
        secondaryValue: hardMode ? 1 : 0,
        tertiaryValue: 5 + attempts,
        displayResult: disp,
        failed: false,
        metadataJson: JSON.stringify({
          attempts,
          attemptStr: `${attempts}/6`,
          hardMode,
          gridRows: attempts,
          greenTiles: 5 + attempts,
          yellowTiles: 3,
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }

    case "maptap": {
      // On 2026-11-14 match the exact design screen scores for MapTap if today
      let finalScore = 840 + skillTier * 18 + (seedVal % 35);
      if (dateStr === "2026-11-14") {
        const todayScores = [962, 934, 901, 876, 842, 820];
        finalScore = todayScores[pIdx] ?? finalScore;
      } else if (pIdx === 1 && dateStr >= "2026-11-08") {
        // Alex's strong MapTap week
        const alexWeek = [918, 895, 942, 928, 948, 922, 934];
        const offset = Math.max(0, Math.min(6, dayIdx - 27));
        finalScore = alexWeek[offset] ?? finalScore;
      } else if (pIdx === 0 && dateStr >= "2026-11-08") {
        const chrisWeek = [922, 948, 902, 960, 932, 970, 962];
        const offset = Math.max(0, Math.min(6, dayIdx - 27));
        finalScore = chrisWeek[offset] ?? finalScore;
      }
      finalScore = Math.min(996, Math.max(780, finalScore));
      const bullseyes = finalScore >= 950 ? 2 : finalScore >= 910 ? 1 : 0;
      const rounds = [
        { score: bullseyes >= 1 ? 100 : 94, badge: bullseyes >= 1 ? "🎯" : "🔥" },
        { score: Math.min(99, Math.round(finalScore / 5)), badge: "🔥" },
        { score: Math.min(99, Math.round(finalScore / 5) - 1), badge: "🔥" },
        { score: Math.min(98, Math.round(finalScore / 5) - 2), badge: "🔥" },
        { score: bullseyes >= 2 ? 100 : 93, badge: bullseyes >= 2 ? "🎯" : "🔥" },
      ];
      return {
        id,
        playerId,
        gameSlug,
        leagueDate: dateStr,
        puzzleId: dateStr,
        rawText: `www.maptap.gg ${dateStr}\n100🎯 98🔥 97🔥 96🔥 99🔥\nFinal score: ${finalScore}`,
        primaryValue: finalScore,
        secondaryValue: bullseyes,
        tertiaryValue: finalScore,
        displayResult: `${finalScore}`,
        failed: false,
        metadataJson: JSON.stringify({
          finalScore,
          rounds,
          bullseyes,
          roundAverage: Math.round(finalScore / 5),
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }

    case "krillion": {
      const puzzleNum = 88 + dayIdx;
      const score = 260 + skillTier * 16 + (seedVal % 45);
      const fishCount = 2 + (seedVal % 4);
      const squidCount = 7 - fishCount;
      const emojiStrip = "🐟".repeat(fishCount) + "🦑".repeat(squidCount);
      return {
        id,
        playerId,
        gameSlug,
        leagueDate: dateStr,
        puzzleId: `#${puzzleNum}`,
        rawText: `Krillion #${puzzleNum} 🦐\n${score}\n\n${emojiStrip}`,
        primaryValue: score,
        secondaryValue: fishCount,
        tertiaryValue: squidCount,
        displayResult: `${score}`,
        failed: false,
        metadataJson: JSON.stringify({
          score,
          fishCount,
          squidCount,
          shrimpCount: 1,
          emojiStrip,
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }

    case "noillirk": {
      const puzzleNum = 15 + dayIdx;
      const altitude = 4200 + skillTier * 260 + ((seedVal * 19) % 650);
      const blueTiles = 2 + (skillTier % 3);
      const yellowTiles = 3;
      const redTiles = Math.max(0, 7 - blueTiles - yellowTiles);
      const promptStrip = "🟦".repeat(blueTiles) + "🟨".repeat(yellowTiles) + "🟥".repeat(redTiles);
      return {
        id,
        playerId,
        gameSlug,
        leagueDate: dateStr,
        puzzleId: `#${puzzleNum}`,
        rawText: `Noillirk 🎈 The Daily Climb · No. ${puzzleNum} · ${altitude.toLocaleString(
          "en-GB"
        )}m\n\n${promptStrip}\n\nClimb today's prompts: https://playdaily.org/noillirk`,
        primaryValue: altitude,
        secondaryValue: blueTiles,
        tertiaryValue: yellowTiles,
        displayResult: `${altitude.toLocaleString("en-GB")}`,
        failed: false,
        metadataJson: JSON.stringify({
          altitude,
          blueTiles,
          yellowTiles,
          redTiles,
          greenTiles: 0,
          promptStrip,
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }

    case "huedle": {
      const puzzleNum = 284 + dayIdx;
      const moves = Math.max(24, 68 - skillTier * 5 - (seedVal % 12));
      const starScore = Math.min(1000, Math.max(60, 1000 - (moves - 22) * 18));
      const timeSeconds = 65 + moves * 2;
      const mins = Math.floor(timeSeconds / 60);
      const secs = String(timeSeconds % 60).padStart(2, "0");
      return {
        id,
        playerId,
        gameSlug,
        leagueDate: dateStr,
        puzzleId: `#${puzzleNum}`,
        rawText: `🎨 Huedle #${puzzleNum}\n📅 ${dateStr}\n⭐ ${starScore} / 1000\n⏱️ ${mins}:${secs}\n🔀 ${moves} moves\n\nhttps://www.huedle.uk?ref=share`,
        primaryValue: moves,
        secondaryValue: starScore,
        tertiaryValue: timeSeconds,
        displayResult: `${moves} moves`,
        failed: false,
        metadataJson: JSON.stringify({
          moves,
          starScore,
          maxScore: 1000,
          timeSeconds,
          timeFormatted: `${mins}:${secs}`,
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }

    case "flagle": {
      const puzzleNum = 1693 + dayIdx;
      const attempts = Math.max(1, Math.min(6, 5 - Math.floor((skillTier + (seedVal % 3)) / 2)));
      return {
        id,
        playerId,
        gameSlug,
        leagueDate: dateStr,
        puzzleId: `#${puzzleNum}`,
        rawText: `#Flagle #${puzzleNum} (${dateStr}) ${attempts}/6\n🟩🟩🟩\n🟥🟩🟩\n\nhttps://www.flagle.io`,
        primaryValue: attempts,
        secondaryValue: 6 - attempts,
        tertiaryValue: null,
        displayResult: `${attempts}/6`,
        failed: false,
        metadataJson: JSON.stringify({
          attempts,
          attemptStr: `${attempts}/6`,
          greenCount: 6 - attempts + 1,
          redCount: attempts - 1,
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }

    case "catfishing": {
      const puzzleNum = 840 + dayIdx;
      const score = Math.min(10, Math.max(2, 4 + Math.floor((skillTier + (seedVal % 4)) / 2)));
      const questionResults = Array.from({ length: 10 }, (_, idx) =>
        (idx + dayIdx + pIdx) % 10 < score ? 1 : 0
      );
      const row1 = questionResults
        .slice(0, 5)
        .map((v) => (v ? "🐟" : "🐈"))
        .join("");
      const row2 = questionResults
        .slice(5, 10)
        .map((v) => (v ? "🐟" : "🐈"))
        .join("");
      return {
        id,
        playerId,
        gameSlug,
        leagueDate: dateStr,
        puzzleId: `#${puzzleNum}`,
        rawText: `catfishing.net\n#${puzzleNum} - ${score}/10\n${row1}\n${row2}`,
        primaryValue: score,
        secondaryValue: score,
        tertiaryValue: null,
        displayResult: `${score}/10`,
        failed: false,
        metadataJson: JSON.stringify({
          score,
          maxScore: 10,
          fishCount: score,
          catCount: 10 - score,
          questionResults,
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }

    case "poople": {
      const puzzleNum = 423 + dayIdx;
      const par = 5;
      const guesses = Math.max(4, 9 - Math.floor((skillTier + (seedVal % 3)) / 2));
      const relativeToPar = guesses - par;
      return {
        id,
        playerId,
        gameSlug,
        leagueDate: dateStr,
        puzzleId: `#${puzzleNum}`,
        rawText: `Poople #${puzzleNum} ${guesses}/${par}\n⬜⬜⬜⬜\n🟫🟫🟫🟫\n\nhttps://poople.io/`,
        primaryValue: guesses,
        secondaryValue: -relativeToPar,
        tertiaryValue: null,
        displayResult: `${guesses}/${par}`,
        failed: false,
        metadataJson: JSON.stringify({
          guesses,
          par,
          relativeToPar,
          gridRowCount: guesses,
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }

    case "wordishingrilliontapdle":
    default: {
      const puzzleNum = Math.max(1, dayIdx - 28);
      const attempts = Math.max(2, Math.min(6, 5 - Math.floor(skillTier / 2)));
      const points = 7800 + skillTier * 480 + ((seedVal * 37) % 950);
      const multiplier = attempts <= 2 ? 1.25 : attempts <= 3 ? 1.1 : 1.0;
      const bullseyes = points > 10200 ? 1 : 0;
      const fishTotal = 1 + (seedVal % 3);
      return {
        id,
        playerId,
        gameSlug: "wordishingrilliontapdle",
        leagueDate: dateStr,
        puzzleId: `#${puzzleNum}`,
        rawText: `WORDISHINGRILLIONTAPDLE #${puzzleNum}\n${attempts}/6 · ${points.toLocaleString(
          "en-GB"
        )} pts ×${multiplier.toFixed(
          2
        )}\n\n🟩⬛🟨🟨🟩⬛⬜⬜⬜⬜\n⚪ 🐟${fishTotal} 📍500–1k\n\n🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩\n🟣 ${
          bullseyes ? "🎯" : "🔥"
        } 📍250–500`,
        primaryValue: points,
        secondaryValue: -attempts,
        tertiaryValue: multiplier,
        displayResult: `${points.toLocaleString("en-GB")}`,
        failed: false,
        metadataJson: JSON.stringify({
          points,
          attempts,
          maxAttempts: 6,
          attemptStr: `${attempts}/6`,
          multiplier,
          bullseyes,
          fishTotal,
          distanceBands: ["500–1k", "250–500"],
        }),
        submittedAt,
        isLate: false,
        isCorrected: false,
      };
    }
  }
}

export async function getAllPlayers(): Promise<Player[]> {
  return (await load()).players;
}

export async function getSubmissionsInRange(
  startDate: string,
  endDate: string
): Promise<Submission[]> {
  const { submissions } = await load();
  return submissions
    .filter((s) => s.leagueDate >= startDate && s.leagueDate <= endDate)
    .sort(
      (a, b) =>
        a.leagueDate.localeCompare(b.leagueDate) || a.submittedAt.localeCompare(b.submittedAt)
    );
}

export async function upsertSubmission(
  sub: Omit<Submission, "id" | "submittedAt"> & { id?: string; submittedAt?: string }
): Promise<Submission> {
  const data = await load(true);
  const existing = data.submissions.find(
    (s) =>
      s.playerId === sub.playerId && s.gameSlug === sub.gameSlug && s.leagueDate === sub.leagueDate
  );
  const saved: Submission = {
    ...sub,
    id: existing?.id || sub.id || `sub_${sub.leagueDate}_${sub.gameSlug}_${sub.playerId}`,
    submittedAt: sub.submittedAt || new Date().toISOString(),
    isCorrected: existing ? true : sub.isCorrected,
  };
  if (existing) Object.assign(existing, saved);
  else data.submissions.push(saved);
  await persist(data);
  return saved;
}

export async function upsertSubmissions(
  subs: Array<Omit<Submission, "id" | "submittedAt">>
): Promise<Submission[]> {
  const data = await load(true);
  const out: Submission[] = [];
  for (const sub of subs) {
    const existing = data.submissions.find(
      (s) =>
        s.playerId === sub.playerId &&
        s.gameSlug === sub.gameSlug &&
        s.leagueDate === sub.leagueDate
    );
    const saved: Submission = {
      ...sub,
      id: existing?.id || `sub_${sub.leagueDate}_${sub.gameSlug}_${sub.playerId}`,
      submittedAt: new Date().toISOString(),
      isCorrected: existing ? true : sub.isCorrected,
    };
    if (existing) Object.assign(existing, saved);
    else data.submissions.push(saved);
    out.push(saved);
  }
  await persist(data);
  return out;
}

const PALETTE = [
  "#E6EB5E",
  "#FF8A3D",
  "#E3CDBE",
  "#6FA8DC",
  "#8A8C45",
  "#F2A7C3",
  "#5CC8B0",
  "#B388FF",
  "#B8794F",
];

export async function createPlayer(
  name: string,
  color?: string,
  joinedAt: string = getTodayDate()
): Promise<Player> {
  const data = await load(true);
  const cleanName = name.trim();
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const existing = data.players.find((p) => p.slug === slug);
  if (existing) return existing;

  const player: Player = {
    id: `p_${slug}_${Date.now().toString(36)}`,
    slug,
    name: cleanName,
    color: color || PALETTE[data.players.length % PALETTE.length],
    avatarInitials: cleanName.slice(0, 1).toUpperCase(),
    joinedAt,
  };
  data.players.push(player);
  await persist(data);
  return player;
}

// ---------------------------------------------------------------------------------------------
// Admin operations on the players list
// ---------------------------------------------------------------------------------------------

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function playerSubmissionCounts(): Promise<Record<string, number>> {
  const { submissions } = await load(true);
  const counts: Record<string, number> = {};
  for (const s of submissions) counts[s.playerId] = (counts[s.playerId] || 0) + 1;
  return counts;
}

export async function updatePlayer(
  id: string,
  changes: { name?: string; color?: string }
): Promise<Player> {
  const data = await load(true);
  const player = data.players.find((p) => p.id === id);
  if (!player) throw new Error("Player not found.");
  if (changes.name !== undefined) {
    const name = changes.name.trim().slice(0, 24);
    if (!name) throw new Error("Name can't be empty.");
    const slug = slugify(name);
    if (!slug) throw new Error("Name needs at least one letter or number.");
    if (data.players.some((p) => p.id !== id && p.slug === slug)) {
      throw new Error(`There is already a player called ${name}. Use Merge to combine them.`);
    }
    player.name = name;
    player.slug = slug;
    player.avatarInitials = name.slice(0, 1).toUpperCase();
  }
  if (changes.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(changes.color)) throw new Error("Colour must look like #E6EB5E.");
    player.color = changes.color;
  }
  await persist(data);
  return player;
}

export async function removePlayer(id: string): Promise<{ removedSubmissions: number }> {
  const data = await load(true);
  if (!data.players.some((p) => p.id === id)) throw new Error("Player not found.");
  const before = data.submissions.length;
  data.submissions = data.submissions.filter((s) => s.playerId !== id);
  data.players = data.players.filter((p) => p.id !== id);
  await persist(data);
  return { removedSubmissions: before - data.submissions.length };
}

/**
 * Moves all of `sourceId`'s results to `targetId` and deletes the source player. If both players
 * have a result for the same game on the same day, the target's result is kept.
 */
export async function mergePlayers(
  sourceId: string,
  targetId: string
): Promise<{ moved: number; dropped: number }> {
  if (sourceId === targetId) throw new Error("Pick two different players.");
  const data = await load(true);
  const source = data.players.find((p) => p.id === sourceId);
  const target = data.players.find((p) => p.id === targetId);
  if (!source || !target) throw new Error("Player not found.");

  const taken = new Set(
    data.submissions
      .filter((s) => s.playerId === targetId)
      .map((s) => `${s.leagueDate}|${s.gameSlug}`)
  );
  let moved = 0;
  let dropped = 0;
  const kept: Submission[] = [];
  for (const s of data.submissions) {
    if (s.playerId !== sourceId) {
      kept.push(s);
      continue;
    }
    const key = `${s.leagueDate}|${s.gameSlug}`;
    if (taken.has(key)) {
      dropped++;
      continue;
    }
    taken.add(key);
    moved++;
    kept.push({ ...s, playerId: targetId, id: `sub_${s.leagueDate}_${s.gameSlug}_${targetId}` });
  }
  data.submissions = kept;
  if (source.joinedAt < target.joinedAt) target.joinedAt = source.joinedAt;
  data.players = data.players.filter((p) => p.id !== sourceId);
  await persist(data);
  return { moved, dropped };
}

// ---------------------------------------------------------------------------------------------
// Managing individual results
// ---------------------------------------------------------------------------------------------

export async function findSubmission(id: string): Promise<Submission | null> {
  return (await load(true)).submissions.find((s) => s.id === id) ?? null;
}

export async function deleteSubmission(id: string): Promise<void> {
  const data = await load(true);
  const before = data.submissions.length;
  data.submissions = data.submissions.filter((s) => s.id !== id);
  if (data.submissions.length === before) throw new Error("That result no longer exists.");
  await persist(data);
}

/** Moves a result to another player. Refuses if they already have that game for that day. */
export async function reassignSubmission(id: string, toPlayerId: string): Promise<Submission> {
  const data = await load(true);
  const sub = data.submissions.find((s) => s.id === id);
  if (!sub) throw new Error("That result no longer exists.");
  const target = data.players.find((p) => p.id === toPlayerId);
  if (!target) throw new Error("Player not found.");
  if (sub.playerId === toPlayerId) throw new Error("That result already belongs to this player.");
  if (
    data.submissions.some(
      (s) => s.playerId === toPlayerId && s.gameSlug === sub.gameSlug && s.leagueDate === sub.leagueDate
    )
  ) {
    throw new Error(`${target.name} already has a result for that game on that day.`);
  }
  sub.playerId = toPlayerId;
  sub.id = `sub_${sub.leagueDate}_${sub.gameSlug}_${toPlayerId}`;
  await persist(data);
  return sub;
}
