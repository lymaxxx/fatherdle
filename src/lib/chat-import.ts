import { parseMultiGamePaste } from "./parsers";
import type { GameSlug, Player } from "./types";

/**
 * Reads an exported WhatsApp chat and pulls out every game result, so it can be assigned to
 * players and days without anyone pasting results one by one. Pure functions only: the admin
 * panel runs this in the browser for the preview, and the server re-parses each result text
 * before saving anything.
 */

export interface ChatMessage {
  date: string; // YYYY-MM-DD the message was sent
  time: string;
  sender: string;
  body: string;
}

export interface ChatResult {
  sender: string;
  /** League day this result belongs to (from the share itself where it says, else the send date). */
  date: string;
  messageDate: string;
  game: GameSlug;
  displayResult: string;
  /** The share text for this one result. */
  text: string;
}

export interface ParsedChat {
  messages: ChatMessage[];
  results: ChatResult[];
  /** Messages that look like a result but aren't a game Fatherdle knows, grouped by game name. */
  unrecognised: Record<string, number>;
  senders: Array<{ name: string; messages: number; results: number }>;
  dateOrder: "DMY" | "MDY";
}

const INVISIBLE = /[‎‏‪-‮]/g;

const TIME = String.raw`(\d{1,2}[:.]\d{2}(?::\d{2})?(?:\s?[AaPp]\.?[Mm]\.?)?)`;
// iPhone export: [16/11/2026, 12:52:58] Name: text
const IOS = new RegExp(String.raw`^\[(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),?\s+${TIME}\]\s([^:]+?):\s?(.*)$`);
// Android export: 16/11/2026, 12:52 - Name: text
const ANDROID = new RegExp(String.raw`^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),?\s+${TIME}\s[-–]\s([^:]+?):\s?(.*)$`);

interface RawLine {
  a: number;
  b: number;
  year: number;
  time: string;
  sender: string;
  body: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseChatMessages(raw: string): { messages: ChatMessage[]; dateOrder: "DMY" | "MDY" } {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const rows: Array<RawLine | { cont: string }> = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(INVISIBLE, "");
    const m = line.match(IOS) ?? line.match(ANDROID);
    if (m) {
      const year = parseInt(m[3], 10);
      rows.push({
        a: parseInt(m[1], 10),
        b: parseInt(m[2], 10),
        year: year < 100 ? 2000 + year : year,
        time: m[4],
        sender: m[5].trim(),
        body: m[6],
      });
    } else if (/^\[?\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s/.test(line)) {
      // a system line such as "Adam added Peter": no sender, ends any message in progress
      rows.push({ cont: "\u0000" });
    } else {
      rows.push({ cont: line });
    }
  }

  const stamped = rows.filter((r): r is RawLine => "a" in r);
  // 16/11 can only be day/month and 11/16 only month/day; with neither, assume day first
  const dayFirstImpossible = stamped.some((r) => r.a > 12 && r.b <= 12) ? false : stamped.some((r) => r.b > 12 && r.a <= 12);
  const dateOrder: "DMY" | "MDY" = dayFirstImpossible ? "MDY" : "DMY";

  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;
  for (const row of rows) {
    if ("a" in row) {
      const month = dateOrder === "DMY" ? row.b : row.a;
      const day = dateOrder === "DMY" ? row.a : row.b;
      current = { date: `${row.year}-${pad(month)}-${pad(day)}`, time: row.time, sender: row.sender, body: row.body };
      messages.push(current);
    } else if (row.cont === "\u0000") {
      current = null;
    } else if (current) {
      current.body += `\n${row.cont}`;
    }
  }
  return { messages, dateOrder };
}

/** Puzzle numbers whose day is known, to date shares that carry no date of their own. */
const ANCHORS: Partial<Record<GameSlug, { puzzle: number; date: string }>> = {
  wordle: { puzzle: 1974, date: "2026-11-14" },
  krillion: { puzzle: 122, date: "2026-11-14" },
  catfishing: { puzzle: 874, date: "2026-11-14" },
  metrodle: { puzzle: 1625, date: "2026-11-09" },
  strands: { puzzle: 982, date: "2026-11-10" },
  connections: { puzzle: 1248, date: "2026-11-10" },
  huedle: { puzzle: 318, date: "2026-11-14" },
  poople: { puzzle: 457, date: "2026-11-14" },
  wordishingrilliontapdle: { puzzle: 5, date: "2026-11-14" },
  noillirk: { puzzle: 49, date: "2026-11-14" },
  flagle: { puzzle: 1727, date: "2026-11-14" },
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function resultDate(
  game: GameSlug,
  puzzleId: string | null,
  extractedDate: string | null,
  text: string,
  messageDate: string
): string {
  // MapTap only says "November 16": take the year from when it was sent, not a fixed one
  if (game === "maptap") {
    const m = text.match(/maptap\.gg\s+([A-Za-z]+)\s+(\d{1,2})/i);
    const month = m ? MONTHS[m[1].slice(0, 3).toLowerCase()] : undefined;
    if (m && month) {
      const year = parseInt(messageDate.slice(0, 4), 10);
      let iso = `${year}-${pad(month)}-${pad(parseInt(m[2], 10))}`;
      if (iso > addDays(messageDate, 180)) iso = `${year - 1}-${pad(month)}-${pad(parseInt(m[2], 10))}`;
      return iso;
    }
  }
  if (extractedDate) return extractedDate;
  const anchor = ANCHORS[game];
  const num = puzzleId ? parseInt(puzzleId.replace(/\D/g, ""), 10) : NaN;
  if (anchor && Number.isFinite(num)) {
    const derived = addDays(anchor.date, num - anchor.puzzle);
    // posted just before or after midnight for the neighbouring day's puzzle; anything further off
    // is probably a different series or a late share, so keep the day it was sent
    if (Math.abs((new Date(derived).getTime() - new Date(messageDate).getTime()) / 86400000) <= 1) return derived;
  }
  return messageDate;
}

/** Text from "> _quoted reply_" up to the line that closes the quote is someone else's message. */
function withoutQuotes(body: string): string {
  const lines = body.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith(">")) {
      while (i < lines.length && !lines[i].trimEnd().endsWith("_")) i++;
      continue;
    }
    kept.push(lines[i]);
  }
  return kept.join("\n");
}

// "Bordivide · Nov 16, 2026", or the name alone on a line with the date on the next
const GAME_LINE = /^([A-Za-z][A-Za-z ]{2,24}?)\s*(?:·\s*|\n)[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}/m;

export function parseWhatsAppChat(raw: string): ParsedChat {
  const { messages, dateOrder } = parseChatMessages(raw);
  const results: ChatResult[] = [];
  const unrecognised: Record<string, number> = {};
  const senderStats = new Map<string, { messages: number; results: number }>();

  for (const msg of messages) {
    const stats = senderStats.get(msg.sender) ?? { messages: 0, results: 0 };
    stats.messages++;
    senderStats.set(msg.sender, stats);

    const body = withoutQuotes(msg.body).trim();
    if (!body) continue;
    const { parsed } = parseMultiGamePaste(body);
    for (const item of parsed) {
      results.push({
        sender: msg.sender,
        date: resultDate(item.gameSlug, item.puzzleId, item.extractedDate, item.rawText, msg.date),
        messageDate: msg.date,
        game: item.gameSlug,
        displayResult: item.displayResult,
        text: item.rawText,
      });
      stats.results++;
    }
    if (parsed.length === 0) {
      const named = body.match(GAME_LINE);
      if (named) {
        const name = named[1].trim();
        unrecognised[name] = (unrecognised[name] ?? 0) + 1;
      }
    }
  }

  return {
    messages,
    results,
    unrecognised,
    senders: [...senderStats.entries()]
      .map(([name, s]) => ({ name, ...s }))
      .filter((s) => s.results > 0)
      .sort((a, b) => b.results - a.results),
    dateOrder,
  };
}

/** Best guess at which player a chat name is: exact name, then first name. */
export function suggestPlayerId(sender: string, players: Player[]): string | null {
  const clean = sender.trim().toLowerCase();
  const first = clean.split(/\s+/)[0];
  const exact = players.find((p) => p.name.toLowerCase() === clean || p.slug === clean);
  if (exact) return exact.id;
  const byFirst = players.filter((p) => p.name.toLowerCase() === first || p.slug === first);
  return byFirst.length === 1 ? byFirst[0].id : null;
}

/** Only the first name is used when someone has to be created. */
export function firstName(sender: string): string {
  return sender.trim().split(/\s+/)[0].slice(0, 24);
}
