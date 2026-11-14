import { getStore } from "@netlify/blobs";
import fs from "fs";
import path from "path";
import { DEFAULT_PLAYERS } from "../constants";
import { getLondonDateString } from "../analytics/dates";
import { GameSlug, Player, Submission } from "../types";

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
  return isDemoMode() ? DEMO_TODAY : getLondonDateString();
}

interface LeagueData {
  players: Player[];
  submissions: Submission[];
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

/** Netlify configures Blobs automatically; the env vars are a manual fallback. */
function blobStore() {
  const siteID = process.env.FATHERDLE_BLOBS_SITE_ID;
  const token = process.env.FATHERDLE_BLOBS_TOKEN;
  return siteID && token
    ? getStore({ name: BLOB_STORE, siteID, token, consistency: "strong" })
    : getStore({ name: BLOB_STORE, consistency: "strong" });
}

async function readPersisted(): Promise<LeagueData | null> {
  if (onNetlify()) {
    const store = blobStore();
    return ((await store.get(BLOB_KEY, { type: "json" })) as LeagueData | null) ?? null;
  }
  try {
    return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8")) as LeagueData;
  } catch {
    return null;
  }
}

async function writePersisted(data: LeagueData): Promise<void> {
  if (onNetlify()) {
    const store = blobStore();
    await store.setJSON(BLOB_KEY, data);
    return;
  }
  fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(data));
}

async function load(): Promise<LeagueData> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      let data = await readPersisted();
      if (!data) {
        data = isDemoMode() ? buildDemoDataset() : { players: [], submissions: [] };
        await writePersisted(data);
      }
      cache = data;
      return data;
    })().finally(() => {
      loading = null;
    });
  }
  return loading;
}

/** Serialise writes so concurrent requests can't clobber each other. */
function persist(data: LeagueData): Promise<void> {
  writeChain = writeChain.then(() => writePersisted(data));
  return writeChain;
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
        displayResult: `${altitude.toLocaleString("en-GB")}m`,
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
        displayResult: `${points.toLocaleString("en-GB")} pts`,
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
  const data = await load();
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
  const data = await load();
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
  const data = await load();
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
