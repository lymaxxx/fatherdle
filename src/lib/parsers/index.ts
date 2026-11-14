import { GameSlug } from "../types";
import { GAMES } from "../constants";

export interface ParsedGameSubmission {
  gameSlug: GameSlug;
  gameName: string;
  puzzleId: string | null;
  extractedDate: string | null; // YYYY-MM-DD if present in share text
  primaryValue: number; // Used for ranking
  secondaryValue: number | null; // Tie-breaker 1
  tertiaryValue: number | null; // Tie-breaker 2
  displayResult: string; // Shown in leaderboard, e.g. "6/6", "988", "57 moves", "10,857 pts"
  failed: boolean;
  rawText: string;
  metadata: Record<string, unknown>;
}

export interface MultiParseResult {
  parsed: ParsedGameSubmission[];
  unrecognisedBlocks: string[];
}

const MONTHS_MAP: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

/**
 * Parses Huedle share text:
 * 🎨 Huedle #318
 * 📅 14 Nov 2026
 * ⭐ 113 / 1000
 * ⏱️ 1:51
 * 🔀 57 moves
 * https://www.huedle.uk?ref=share
 *
 * Ranking rule: Lower moves is better. Tie-break: higher star score, then lower timeSeconds.
 */
export function parseHuedle(block: string): ParsedGameSubmission | null {
  if (!/Huedle/i.test(block)) return null;

  const puzzleMatch = block.match(/Huedle\s*#?(\d+)/i);
  const movesMatch = block.match(/(\d+)\s*moves/i);
  if (!movesMatch) return null;

  const moves = parseInt(movesMatch[1], 10);
  const scoreMatch = block.match(/⭐\s*(\d+)\s*\/\s*(\d+)/) || block.match(/(\d+)\s*\/\s*1000/);
  const starScore = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
  const maxScore = scoreMatch ? parseInt(scoreMatch[2], 10) : 1000;

  const timeMatch = block.match(/(\d+):(\d{2})/);
  const timeSeconds = timeMatch
    ? parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10)
    : null;
  const timeFormatted = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : null;

  let extractedDate: string | null = null;
  const dateMatch = block.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const month = MONTHS_MAP[dateMatch[2].toLowerCase()];
    const year = dateMatch[3];
    if (month) extractedDate = `${year}-${month}-${day}`;
  }

  return {
    gameSlug: "huedle",
    gameName: GAMES.huedle.name,
    puzzleId: puzzleMatch ? `#${puzzleMatch[1]}` : null,
    extractedDate,
    primaryValue: moves,
    secondaryValue: starScore, // Higher star score is better
    tertiaryValue: timeSeconds, // Lower time is better
    displayResult: `${moves} moves`,
    failed: false,
    rawText: block.trim(),
    metadata: {
      moves,
      starScore,
      maxScore,
      timeSeconds,
      timeFormatted,
    },
  };
}

/**
 * Parses Wordle share text:
 * Wordle 1,974 6/6
 *
 * ⬜⬜⬜⬜⬜
 * ...
 */
export function parseWordle(block: string): ParsedGameSubmission | null {
  const headerMatch = block.match(/Wordle\s+([\d,]+)\s+([1-6X])\/6(\*)?/i);
  if (!headerMatch) return null;

  const puzzleNum = headerMatch[1].replace(/,/g, "");
  const attemptStr = headerMatch[2].toUpperCase();
  const hardMode = Boolean(headerMatch[3]);
  const failed = attemptStr === "X";
  const attempts = failed ? 7 : parseInt(attemptStr, 10);

  // Extract emoji rows
  const gridLines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[⬜⬛🟨🟩🟦🟧]+$/u.test(l));

  // Count green and yellow tiles for tie-break metadata
  let greenTiles = 0;
  let yellowTiles = 0;
  for (const row of gridLines) {
    greenTiles += (row.match(/🟩|🟧/gu) || []).length;
    yellowTiles += (row.match(/🟨|🟦/gu) || []).length;
  }

  return {
    gameSlug: "wordle",
    gameName: GAMES.wordle.name,
    puzzleId: `#${puzzleNum}`,
    extractedDate: null,
    primaryValue: attempts,
    secondaryValue: hardMode ? 1 : 0,
    tertiaryValue: greenTiles,
    displayResult: `${attemptStr}/6${hardMode ? "*" : ""}`,
    failed,
    rawText: block.trim(),
    metadata: {
      attempts: failed ? null : attempts,
      attemptStr: `${attemptStr}/6`,
      hardMode,
      gridRows: gridLines.length,
      greenTiles,
      yellowTiles,
    },
  };
}

/**
 * Parses Krillion share text:
 * Krillion #122 🦐
 * 330
 *
 * 🦑🦑🐟🐟🐟🦑🦑
 */
export function parseKrillion(block: string): ParsedGameSubmission | null {
  if (!/Krillion/i.test(block)) return null;

  const puzzleMatch = block.match(/Krillion\s*#?(\d+)/i);
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let score: number | null = null;
  for (const line of lines) {
    if (/Krillion/i.test(line)) {
      // Check if score is on the same line after puzzle id
      const inlineScore = line.replace(/Krillion\s*#?\d+/i, "").match(/\b(\d[\d,]*)\b/);
      if (inlineScore) {
        score = parseInt(inlineScore[1].replace(/,/g, ""), 10);
      }
      continue;
    }
    const numMatch = line.match(/^(\d[\d,]*)$/);
    if (numMatch) {
      score = parseInt(numMatch[1].replace(/,/g, ""), 10);
      break;
    }
  }

  if (score === null) return null;

  const squidCount = (block.match(/🦑/gu) || []).length;
  const fishCount = (block.match(/🐟/gu) || []).length;
  const shrimpCount = (block.match(/🦐/gu) || []).length;
  const emojiStrip = (block.match(/[🦑🐟🦐🐙🐡]+/gu) || []).join("");

  return {
    gameSlug: "krillion",
    gameName: GAMES.krillion.name,
    puzzleId: puzzleMatch ? `#${puzzleMatch[1]}` : null,
    extractedDate: null,
    primaryValue: score,
    secondaryValue: fishCount,
    tertiaryValue: squidCount,
    displayResult: `${score}`,
    failed: false,
    rawText: block.trim(),
    metadata: {
      score,
      squidCount,
      fishCount,
      shrimpCount,
      emojiStrip,
    },
  };
}

/**
 * Parses Catfishing share text:
 * catfishing.net
 * #874 - 4/10
 * 🐟🐈🐈🐈🐈
 * 🐟🐟🐟🐟🐟
 */
export function parseCatfishing(block: string): ParsedGameSubmission | null {
  if (!/catfishing/i.test(block)) return null;

  const match =
    block.match(/#?(\d+)\s*[-–·]\s*(\d+(?:\.\d+)?)\s*\/\s*10/i) ||
    block.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  if (!match) return null;

  const hasPuzzle = match.length >= 3;
  const puzzleId = hasPuzzle ? `#${match[1]}` : null;
  const score = parseFloat(hasPuzzle ? match[2] : match[1]);

  const emojis = Array.from(block).filter((ch) => ch === "🐟" || ch === "🐈" || ch === "🥚");
  const fishCount = emojis.filter((ch) => ch === "🐟").length;
  const catCount = emojis.filter((ch) => ch === "🐈").length;
  const questionResults = emojis.slice(0, 10).map((ch) => (ch === "🐟" ? 1 : 0));

  return {
    gameSlug: "catfishing",
    gameName: GAMES.catfishing.name,
    puzzleId,
    extractedDate: null,
    primaryValue: score,
    secondaryValue: fishCount,
    tertiaryValue: null,
    displayResult: `${score}/10`,
    failed: false,
    rawText: block.trim(),
    metadata: {
      score,
      maxScore: 10,
      fishCount,
      catCount,
      questionResults,
    },
  };
}

/**
 * Parses MapTap share text:
 * www.maptap.gg November 14
 * 100🎯 99🔥 99🔥 97🔥 100🎯
 * Final score: 988
 */
export function parseMapTap(block: string): ParsedGameSubmission | null {
  if (!/maptap/i.test(block) && !/Final score:\s*\d+/i.test(block)) return null;
  if (/WORDISHINGRILLIONTAPDLE/i.test(block)) return null;

  const finalScoreMatch = block.match(/Final score:\s*([\d,]+)/i);
  if (!finalScoreMatch) return null;

  const finalScore = parseInt(finalScoreMatch[1].replace(/,/g, ""), 10);

  let extractedDate: string | null = null;
  const dateLabelMatch = block.match(/maptap\.gg\s+([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i);
  if (dateLabelMatch) {
    const month = MONTHS_MAP[dateLabelMatch[1].toLowerCase()];
    const day = dateLabelMatch[2].padStart(2, "0");
    const year = dateLabelMatch[3] || "2026";
    if (month) extractedDate = `${year}-${month}-${day}`;
  }

  // Extract round scores (e.g. 100🎯 99🔥 99🔥 97🔥 100🎯)
  const roundMatches = [...block.matchAll(/\b(\d{1,3})(🎯|🔥|📍|✨|👍|🗺️)?/gu)].filter(
    (m) => {
      const val = parseInt(m[1], 10);
      return Boolean(m[2]) && val <= 100;
    }
  );
  const rounds = roundMatches.map((m) => ({
    score: parseInt(m[1], 10),
    badge: m[2] || "",
  }));
  const bullseyes = rounds.filter((r) => r.score === 100 || r.badge === "🎯").length;
  const roundSum = rounds.reduce((acc, r) => acc + r.score, 0);

  return {
    gameSlug: "maptap",
    gameName: GAMES.maptap.name,
    puzzleId: dateLabelMatch ? `${dateLabelMatch[1]} ${dateLabelMatch[2]}` : null,
    extractedDate,
    primaryValue: finalScore,
    secondaryValue: bullseyes,
    tertiaryValue: roundSum || null,
    displayResult: `${finalScore}`,
    failed: false,
    rawText: block.trim(),
    metadata: {
      finalScore,
      rounds,
      bullseyes,
      roundAverage: rounds.length > 0 ? Math.round((roundSum / rounds.length) * 10) / 10 : null,
    },
  };
}

/**
 * Parses Flagle / Flagdle share text:
 * #Flagle #1727 (14.11.2026) 2/6
 * 🟩🟩🟩
 * 🟥🟩🟩
 * https://www.flagle.io/?utm_source=share&utm_medium=native
 */
export function parseFlagle(block: string): ParsedGameSubmission | null {
  if (!/Flagd?le/i.test(block)) return null;

  const headerMatch = block.match(/#?Flagd?le\s*#?([\d,]+)(?:\s*\(([\d./-]+)\))?\s+([1-6X])\/6/i);
  if (!headerMatch) return null;

  const puzzleNum = headerMatch[1].replace(/,/g, "");
  const dateRaw = headerMatch[2];
  const attemptStr = headerMatch[3].toUpperCase();
  const failed = attemptStr === "X";
  const attempts = failed ? 7 : parseInt(attemptStr, 10);

  let extractedDate: string | null = null;
  if (dateRaw) {
    const dmy = dateRaw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dmy) {
      extractedDate = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
  }

  const greenCount = (block.match(/🟩/gu) || []).length;
  const redCount = (block.match(/🟥/gu) || []).length;

  return {
    gameSlug: "flagle",
    gameName: GAMES.flagle.name,
    puzzleId: `#${puzzleNum}`,
    extractedDate,
    primaryValue: attempts,
    secondaryValue: greenCount,
    tertiaryValue: null,
    displayResult: `${attemptStr}/6`,
    failed,
    rawText: block.trim(),
    metadata: {
      attempts: failed ? null : attempts,
      attemptStr: `${attemptStr}/6`,
      greenCount,
      redCount,
    },
  };
}

/**
 * Parses Noillirk share text:
 * Noillirk 🎈 The Daily Climb · No. 49 · 5,863m
 *
 * 🟥🟨🟦🟨🟥🟦🟥
 *
 * Climb today's prompts: https://playdaily.org/noillirk
 */
export function parseNoillirk(block: string): ParsedGameSubmission | null {
  if (!/Noillirk/i.test(block)) return null;

  const puzzleMatch = block.match(/No\.?\s*(\d+)/i) || block.match(/Noillirk\s*#?(\d+)/i);
  const altitudeMatch = block.match(/([\d,]+)\s*m\b/i);
  if (!altitudeMatch) return null;

  const altitude = parseInt(altitudeMatch[1].replace(/,/g, ""), 10);

  const blueTiles = (block.match(/🟦/gu) || []).length;
  const yellowTiles = (block.match(/🟨/gu) || []).length;
  const redTiles = (block.match(/🟥/gu) || []).length;
  const greenTiles = (block.match(/🟩/gu) || []).length;
  const promptStrip = (block.match(/[🟥🟨🟦🟩⬜⬛]+/gu) || []).join("");

  return {
    gameSlug: "noillirk",
    gameName: GAMES.noillirk.name,
    puzzleId: puzzleMatch ? `#${puzzleMatch[1]}` : null,
    extractedDate: null,
    primaryValue: altitude,
    secondaryValue: blueTiles + greenTiles,
    tertiaryValue: yellowTiles,
    displayResult: `${altitude.toLocaleString("en-GB")}m`,
    failed: false,
    rawText: block.trim(),
    metadata: {
      altitude,
      blueTiles,
      yellowTiles,
      redTiles,
      greenTiles,
      promptStrip,
    },
  };
}

/**
 * Parses Poople share text:
 * Poople #457 7/5
 * ⬜⬜⬜⬜
 * ...
 * https://poople.io/
 *
 * Ranking rule: Lower guesses is better.
 */
export function parsePoople(block: string): ParsedGameSubmission | null {
  if (!/Poople/i.test(block)) return null;

  const match = block.match(/Poople\s*#?(\d+)\s+(\d+|X)\/(\d+)/i);
  if (!match) return null;

  const puzzleId = `#${match[1]}`;
  const guessesRaw = match[2].toUpperCase();
  const par = parseInt(match[3], 10);
  const failed = guessesRaw === "X";
  const guesses = failed ? par + 10 : parseInt(guessesRaw, 10);
  const relativeToPar = guesses - par;

  const gridRows = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[⬜🟫⬛🟩🟨]+$/u.test(l));

  return {
    gameSlug: "poople",
    gameName: GAMES.poople.name,
    puzzleId,
    extractedDate: null,
    primaryValue: guesses,
    secondaryValue: -relativeToPar,
    tertiaryValue: null,
    displayResult: `${guessesRaw}/${par}`,
    failed,
    rawText: block.trim(),
    metadata: {
      guesses: failed ? null : guesses,
      par,
      relativeToPar: failed ? null : relativeToPar,
      gridRowCount: gridRows.length,
    },
  };
}

/**
 * Parses Wordishingrilliontapdle share text:
 * WORDISHINGRILLIONTAPDLE #5
 * 2/6 · 10,857 pts ×1.00
 *
 * 🟩⬛🟨🟨🟩⬛⬜⬜⬜⬜
 * ⚪ 🐟1 📍500–1k
 *
 * 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩
 * 🟣 🎯 📍250–500
 *
 * Ranking rule: Higher points is better. Tie-break: fewer attempts, higher multiplier.
 */
export function parseWordishingrilliontapdle(block: string): ParsedGameSubmission | null {
  if (!/WORDISHINGRILLIONTAPDLE/i.test(block) && !/wordishingrilliontapdle/i.test(block)) {
    return null;
  }

  const puzzleMatch = block.match(/WORDISHINGRILLIONTAPDLE\s*#?(\d+)/i);
  const statsMatch = block.match(
    /([1-6X])\/(\d+)\s*[·•-]\s*([\d,]+)\s*pts?(?:\s*[×x](\d+(?:\.\d+)?))?/i
  );

  let attempts = 6;
  let maxAttempts = 6;
  let attemptStr = "6/6";
  let points = 0;
  let multiplier = 1.0;
  let failed = false;

  // Newer share format:
  //   "Found it in 2/6 · 15,023 points (rarity ×1.40)"
  //   "Didn't find it (X/6) · 6,018 points (rarity ×1.30)"
  const longMatch = block.match(
    /(?:found it in\s+|didn'?t find it\s*\()([1-6X])\/(\d+)\)?\s*[·•-]\s*([\d,]+)\s*(?:pts?|points?)(?:\s*\(?\s*(?:rarity\s*)?[×x](\d+(?:\.\d+)?)\s*\)?)?/i
  );
  const stats = statsMatch || longMatch;

  if (stats) {
    const rawAttempt = stats[1].toUpperCase();
    maxAttempts = parseInt(stats[2], 10);
    failed = rawAttempt === "X";
    attempts = failed ? maxAttempts + 1 : parseInt(rawAttempt, 10);
    attemptStr = `${rawAttempt}/${maxAttempts}`;
    points = parseInt(stats[3].replace(/,/g, ""), 10);
    if (stats[4]) {
      multiplier = parseFloat(stats[4]);
    }
  } else {
    const fallbackPts = block.match(/([\d,]+)\s*(?:pts|points)/i);
    if (!fallbackPts) return null;
    points = parseInt(fallbackPts[1].replace(/,/g, ""), 10);
  }

  const bullseyes = (block.match(/🎯/gu) || []).length;
  const fishMatches = [...block.matchAll(/🐟(\d+)?/gu)];
  const fishTotal = fishMatches.reduce((acc, m) => acc + (m[1] ? parseInt(m[1], 10) : 1), 0);
  const distanceBands = [...block.matchAll(/📍([^\s\n]+)/gu)].map((m) => m[1]);

  return {
    gameSlug: "wordishingrilliontapdle",
    gameName: GAMES.wordishingrilliontapdle.name,
    puzzleId: puzzleMatch ? `#${puzzleMatch[1]}` : null,
    extractedDate: null,
    primaryValue: points,
    secondaryValue: -attempts, // Fewer attempts breaks ties
    tertiaryValue: multiplier,
    displayResult: `${points.toLocaleString("en-GB")} pts`,
    failed,
    rawText: block.trim(),
    metadata: {
      points,
      attempts: failed ? null : attempts,
      maxAttempts,
      attemptStr,
      multiplier,
      bullseyes,
      fishTotal,
      distanceBands,
    },
  };
}

const SINGLE_BLOCK_PARSERS: Array<(block: string) => ParsedGameSubmission | null> = [
  parseWordishingrilliontapdle,
  parseHuedle,
  parseWordle,
  parseKrillion,
  parseCatfishing,
  parseMapTap,
  parseFlagle,
  parseNoillirk,
  parsePoople,
];

/**
 * Parses a single game result block.
 */
export function parseSingleGameText(block: string): ParsedGameSubmission | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  for (const parser of SINGLE_BLOCK_PARSERS) {
    const res = parser(trimmed);
    if (res) return res;
  }
  return null;
}

/**
 * Splits a multi-game paste window into individual game blocks automatically,
 * even if the user pasted multiple games back-to-back without separators or with
 * custom dividers (`_____`, `-------`, blank lines, etc.).
 */
export function parseMultiGamePaste(rawInput: string): MultiParseResult {
  const normalized = rawInput.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { parsed: [], unrecognisedBlocks: [] };
  }

  // Step 1: Identify game header anchor lines across the full input
  const lines = normalized.split("\n");
  const headerPatterns: Array<{ slug: GameSlug; regex: RegExp }> = [
    { slug: "wordishingrilliontapdle", regex: /WORDISHINGRILLIONTAPDLE\s*#?\d+/i },
    { slug: "huedle", regex: /(?:🎨\s*)?Huedle\s*#?\d+/i },
    { slug: "wordle", regex: /^Wordle\s+[\d,]+\s+[1-6X]\/6/i },
    { slug: "krillion", regex: /^Krillion\s*#?\d+/i },
    { slug: "catfishing", regex: /^(?:https?:\/\/)?(?:www\.)?catfishing\.net/i },
    { slug: "maptap", regex: /(?:www\.)?maptap\.gg/i },
    { slug: "flagle", regex: /^#?Flagd?le\s*#?\d+/i },
    { slug: "noillirk", regex: /^Noillirk\b/i },
    { slug: "poople", regex: /^Poople\s*#?\d+/i },
  ];

  // Clean out pure divider lines (`_____`, `-------`, `(less moves is better)`, etc.)
  const cleanedLines: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^[_=\-*~]{3,}$/.test(t)) {
      cleanedLines.push("__DIVIDER__");
      continue;
    }
    if (/^\((?:less|more|fewer|higher|lower)\s+.*better\)$/i.test(t)) {
      continue;
    }
    cleanedLines.push(line);
  }

  // Split whenever a new game header starts OR on explicit divider lines
  const candidateChunks: string[] = [];
  let currentChunk: string[] = [];

  for (const line of cleanedLines) {
    if (line === "__DIVIDER__") {
      if (currentChunk.join("\n").trim()) {
        candidateChunks.push(currentChunk.join("\n").trim());
      }
      currentChunk = [];
      continue;
    }

    const trimmedLine = line.trim();
    const isHeaderStart = headerPatterns.some((p) => p.regex.test(trimmedLine));

    if (isHeaderStart && currentChunk.join("\n").trim().length > 0) {
      // Check if currentChunk already contains a valid game header
      const currentText = currentChunk.join("\n").trim();
      const alreadyHasHeader = headerPatterns.some((p) => p.regex.test(currentText));
      if (alreadyHasHeader) {
        candidateChunks.push(currentText);
        currentChunk = [line];
        continue;
      }
    }

    currentChunk.push(line);
  }

  if (currentChunk.join("\n").trim()) {
    candidateChunks.push(currentChunk.join("\n").trim());
  }

  const parsed: ParsedGameSubmission[] = [];
  const unrecognisedBlocks: string[] = [];

  for (const chunk of candidateChunks) {
    const result = parseSingleGameText(chunk);
    if (result) {
      parsed.push(result);
    } else if (chunk.trim().length > 0) {
      unrecognisedBlocks.push(chunk.trim());
    }
  }

  return { parsed, unrecognisedBlocks };
}
