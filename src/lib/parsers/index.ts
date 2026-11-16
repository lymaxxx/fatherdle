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
  displayResult: string; // Shown in leaderboard, e.g. "6/6", "988", "57 moves", "10,857"
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

  // Extract round scores (e.g. 100🎯 99🔥 99🔥 97🔥 100🎯). Every round carries a different
  // emoji badge, so accept any non-digit suffix.
  const rounds = block
    .split(/\s+/)
    .map((token) => token.match(/^(\d{1,3})([^\d\s]+)$/u))
    .filter((m): m is RegExpMatchArray => m !== null && parseInt(m[1], 10) <= 100)
    .map((m) => ({ score: parseInt(m[1], 10), badge: m[2] }));
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
 * Parses Flagle share text:
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
    displayResult: `${altitude.toLocaleString("en-GB")}`,
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
    displayResult: `${points.toLocaleString("en-GB")}`,
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

/**
 * Parses Metrodle share text:
 * Metrodle #1631
 * 🟩 🎯
 * 1/6
 * #metrodle https://metrodle.com/
 */
export function parseMetrodle(block: string): ParsedGameSubmission | null {
  const header = block.match(/Metrodle\s*#?([\d,]+)/i);
  if (!header) return null;
  const result = block.match(/(?:^|\s)([1-6X])\s*\/\s*6\b/im);
  if (!result) return null;

  const attemptStr = result[1].toUpperCase();
  const failed = attemptStr === "X";
  const attempts = failed ? 7 : parseInt(attemptStr, 10);

  return {
    gameSlug: "metrodle",
    gameName: GAMES.metrodle.name,
    puzzleId: `#${header[1].replace(/,/g, "")}`,
    extractedDate: null,
    primaryValue: attempts,
    secondaryValue: null,
    tertiaryValue: null,
    displayResult: `${attemptStr}/6`,
    failed,
    rawText: block.trim(),
    metadata: { attempts: failed ? null : attempts, attemptStr: `${attemptStr}/6` },
  };
}

/**
 * Parses Connections share text:
 * Connections
 * Puzzle #1252
 * 🟪🟪🟪🟪
 * 🟦🟦🟦🟦
 * 🟩🟩🟩🟩
 * 🟨🟨🟨🟨
 *
 * Every row is a guess. A row of one colour is a correct group; any other row is a mistake.
 * Four mistakes end the game.
 */
export function parseConnections(block: string): ParsedGameSubmission | null {
  if (!/^\s*Connections\b/im.test(block)) return null;
  const puzzle = block.match(/Puzzle\s*#?([\d,]+)/i);
  if (!puzzle) return null;

  const rows = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[🟪🟦🟩🟨]{4}$/u.test(l));
  if (rows.length === 0) return null;

  const isGroup = (row: string) => new Set(Array.from(row)).size === 1;
  const groups = rows.filter(isGroup).length;
  const mistakes = rows.length - groups;
  const failed = groups < 4;

  return {
    gameSlug: "connections",
    gameName: GAMES.connections.name,
    puzzleId: `#${puzzle[1].replace(/,/g, "")}`,
    extractedDate: null,
    // Solved: fewer mistakes is better. Failed games rank below every solved game, and among
    // them the one with more groups found is better.
    primaryValue: failed ? 4 - groups : mistakes,
    secondaryValue: groups,
    tertiaryValue: null,
    displayResult: failed
      ? `${groups}/4`
      : mistakes === 0
      ? "Perfect"
      : `${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}`,
    failed,
    rawText: block.trim(),
    metadata: { mistakes, groups, guesses: rows.length },
  };
}

/**
 * Parses Strands share text:
 * Strands #986
 * “Preschool fun”
 * 🟡🔵🔵🔵
 * 🔵🔵🔵🔵
 *
 * 🔵 is a word found, 🟡 the spangram, 💡 a hint.
 */
export function parseStrands(block: string): ParsedGameSubmission | null {
  const header = block.match(/Strands\s*#?([\d,]+)/i);
  if (!header) return null;

  const rows = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[🔵🟡💡]+$/u.test(l));
  if (rows.length === 0) return null;

  const dots = Array.from(rows.join(""));
  const hints = dots.filter((d) => d === "💡").length;
  const spangramAt = dots.indexOf("🟡");
  const theme = block.match(/[“"]([^”"\n]+)[”"]/);

  return {
    gameSlug: "strands",
    gameName: GAMES.strands.name,
    puzzleId: `#${header[1].replace(/,/g, "")}`,
    extractedDate: null,
    primaryValue: hints,
    secondaryValue: spangramAt >= 0 ? spangramAt : null,
    tertiaryValue: null,
    displayResult: hints === 0 ? "No hints" : `${hints} ${hints === 1 ? "hint" : "hints"}`,
    failed: false,
    rawText: block.trim(),
    metadata: { hints, spangramAt, words: dots.length - hints, theme: theme ? theme[1] : null },
  };
}

// ---------------------------------------------------------------------------------------------
// GeoGuessr daily challenge, Flagcognito, Flagments
// ---------------------------------------------------------------------------------------------

const toNumber = (raw: string) => parseFloat(raw.replace(/,/g, ""));

/** "Nov 16, 2026" -> "2026-11-16" */
function dateFromHeader(block: string): string | null {
  const m = block.match(/·\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS_MAP[m[1].slice(0, 3).toLowerCase()];
  return month ? `${m[3]}-${month}-${m[2].padStart(2, "0")}` : null;
}

function distanceKm(text: string): number | null {
  const m = text.match(/([\d,]*\.?\d+)\s*(km|mi|m)\b/i);
  if (!m) return null;
  const value = toNumber(m[1]);
  const unit = m[2].toLowerCase();
  return unit === "km" ? value : unit === "mi" ? value * 1.609344 : value / 1000;
}

function durationSeconds(text: string): number | null {
  const min = text.match(/(\d+)\s*min/i);
  const sec = text.match(/(\d+)\s*sec/i);
  if (!min && !sec) return null;
  return (min ? parseInt(min[1], 10) * 60 : 0) + (sec ? parseInt(sec[1], 10) : 0);
}

/**
 * Parses a GeoGuessr daily challenge result (no header, the total line is the score):
 * 1. South Korea: 4,957 pts, 13 km, 20 sec, 2 steps
 * ...
 * Total: 18,708 pts, 3,682 km, 2 min, 21 sec, 10 steps
 */
export function parseGeoguessr(block: string): ParsedGameSubmission | null {
  const lines = block.split("\n").map((l) => l.trim());
  const totalLine = lines.find((l) => /^Total:\s*[\d,]+\s*pts?/i.test(l));
  if (!totalLine) return null;

  const total = {
    points: toNumber(totalLine.match(/([\d,]+)\s*pts?/i)![1]),
    km: distanceKm(totalLine),
    seconds: durationSeconds(totalLine),
    steps: totalLine.match(/(\d+)\s*steps?/i) ? parseInt(totalLine.match(/(\d+)\s*steps?/i)![1], 10) : null,
  };

  const rounds = lines
    .map((l) => l.match(/^(\d)\.\s+(.+?):\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null && /pts?/i.test(m[3]))
    .map((m) => ({
      n: parseInt(m[1], 10),
      country: m[2].trim(),
      points: toNumber(m[3].match(/([\d,]+)\s*pts?/i)![1]),
      km: distanceKm(m[3]),
      seconds: durationSeconds(m[3]),
      steps: m[3].match(/(\d+)\s*steps?/i) ? parseInt(m[3].match(/(\d+)\s*steps?/i)![1], 10) : null,
    }));

  return {
    gameSlug: "geoguessr",
    gameName: GAMES.geoguessr.name,
    puzzleId: null,
    extractedDate: null,
    primaryValue: total.points,
    secondaryValue: total.km,
    tertiaryValue: total.seconds,
    displayResult: total.points.toLocaleString("en-GB"),
    failed: false,
    rawText: block.trim(),
    metadata: { rounds, total },
  };
}

/**
 * Parses Flagcognito share text:
 * Flagcognito · Nov 16, 2026
 * 🇩🇿 Algeria: 5 taps
 * 🇴🇲 Oman: 5 taps
 * 🇸🇮 Slovenia: 3 taps
 * 2,000 / 3,000
 * I beat 87% of players.
 */
export function parseFlagcognito(block: string): ParsedGameSubmission | null {
  if (!/Flagcognito/i.test(block)) return null;
  const score = block.match(/([\d,]+)\s*\/\s*([\d,]+)/);
  if (!score) return null;
  const points = toNumber(score[1]);

  const flags = block
    .split("\n")
    .map((l) => l.trim().match(/^(\S+)\s+(.+?):\s*(\d+)\s*taps?/iu))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ flag: m[1], country: m[2].trim(), taps: parseInt(m[3], 10) }));
  const beat = block.match(/beat\s+(\d+)%/i);

  return {
    gameSlug: "flagcognito",
    gameName: GAMES.flagcognito.name,
    puzzleId: null,
    extractedDate: dateFromHeader(block),
    primaryValue: points,
    secondaryValue: flags.length ? flags.reduce((a, f) => a + f.taps, 0) : null,
    tertiaryValue: null,
    displayResult: points.toLocaleString("en-GB"),
    failed: false,
    rawText: block.trim(),
    metadata: { flags, outOf: toNumber(score[2]), beatPercent: beat ? parseInt(beat[1], 10) : null },
  };
}

/**
 * Parses Flagments share text:
 * Flagments · Nov 16, 2026
 * Solved 🟣
 * 900 pts · 2 peeks · 0 misses
 * I beat 97% of players.
 */
export function parseFlagments(block: string): ParsedGameSubmission | null {
  if (!/Flagments/i.test(block)) return null;
  const pts = block.match(/([\d,]+)\s*pts?/i);
  if (!pts) return null;
  const points = toNumber(pts[1]);
  const peeks = block.match(/(\d+)\s*peeks?/i);
  const misses = block.match(/(\d+)\s*miss(?:es)?/i);
  const beat = block.match(/beat\s+(\d+)%/i);
  const solved = /(?<!not\s)solved/i.test(block);

  return {
    gameSlug: "flagments",
    gameName: GAMES.flagments.name,
    puzzleId: null,
    extractedDate: dateFromHeader(block),
    primaryValue: points,
    secondaryValue: peeks ? parseInt(peeks[1], 10) : null,
    tertiaryValue: misses ? parseInt(misses[1], 10) : null,
    displayResult: points.toLocaleString("en-GB"),
    failed: !solved,
    rawText: block.trim(),
    metadata: {
      solved,
      peeks: peeks ? parseInt(peeks[1], 10) : 0,
      misses: misses ? parseInt(misses[1], 10) : 0,
      beatPercent: beat ? parseInt(beat[1], 10) : null,
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
  parseMetrodle,
  parseConnections,
  parseStrands,
  parseGeoguessr,
  parseFlagcognito,
  parseFlagments,
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
    { slug: "metrodle", regex: /^Metrodle\s*#?\d+/i },
    { slug: "connections", regex: /^Connections[ \t]*$/im },
    { slug: "strands", regex: /^Strands\s*#?\d+/i },
    { slug: "geoguessr", regex: /^1\.\s+.+?:\s*[\d,]+\s*pts?\b/i },
    { slug: "flagcognito", regex: /^Flagcognito\b/i },
    { slug: "flagments", regex: /^Flagments\b/i },
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
