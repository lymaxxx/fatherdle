import type { LeagueWeek } from "./analytics/feed";
import { GAME_ICON } from "./game-icons";

/**
 * League share cards (1080x1350) described once as a list of shapes and text, so the on-screen
 * preview and the downloaded PNG are drawn from exactly the same layout.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;
export const DM = '"Spline Sans", system-ui, sans-serif';
export const SERIF = '"Instrument Serif", Georgia, serif';

export type Op =
  | {
      t: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill: string;
      r?: number | [number, number, number, number];
      grad?: [string, string]; // left-to-right gradient, overrides fill
      fade?: string; // vertical fade from this colour at the top to fill at the bottom
      rot?: number; // degrees, about `pivot`
      pivot?: [number, number];
    }
  | { t: "circle"; x: number; y: number; d: number; fill: string }
  | {
      t: "text";
      x: number;
      top: number;
      lh: number;
      text: string;
      size: number;
      weight: number;
      color: string;
      serif?: boolean;
      ls?: number;
      align?: "left" | "right";
      w?: number; // box width for right-aligned text
      rot?: number;
      pivot?: [number, number];
    }
  | { t: "icon"; x: number; y: number; size: number; color: string; paths: string[] };

const INK = "#121212";
const TEXT = "#F4F1EA";
const MUTED = "#948F84";
const LIME = "#E6EB5E";
const LINE = "#3A3935";

// Lucide "trophy" at 24x24
const TROPHY = [
  "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
  "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
  "M4 22h16",
  "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",
  "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",
  "M18 2H6v7a6 6 0 0 0 12 0V2Z",
];

/** Shrinks big display names so they stay inside the card. */
function nameSize(name: string, max: number, maxWidth = 860): number {
  return Math.min(max, Math.floor(maxWidth / Math.max(1, name.length * 0.58)));
}

// Shared card system (HANDOVER §6): accent fade from the top edge, wordmark, tilted date chip,
// title, four KPI tiles, labelled sections, three footer pills.
const SURFACE = "#1C1C1B";
const ACCENTS = {
  orange: ["#FF8A3D", "#2B1A10"],
  violet: ["#B79CF5", "#1E1A2B"],
  blue: ["#6FA8DC", "#141D27"],
  yellow: ["#FFD93D", "#2A2610"],
  pink: ["#F2A7C3", "#2A1A22"],
} as const;
export type Accent = keyof typeof ACCENTS;

function textWidth(text: string, size: number, ls = 0): number {
  return Math.ceil(text.length * size * 0.6 + text.length * ls);
}

function frame(accent: Accent, dateText: string, title: string, sub: string, titleMax = 108): Op[] {
  const [col, tint] = ACCENTS[accent];
  const chipW = textWidth(dateText, 26, 1) + 56;
  const size = nameSize(title, titleMax, 968);
  return [
    { t: "rect", x: 0, y: 0, w: CARD_W, h: CARD_H, fill: INK, fade: tint },
    { t: "circle", x: 56, y: 56, d: 22, fill: col },
    { t: "text", x: 92, top: 56, lh: 28, text: "FATHERDLE", size: 22, weight: 800, color: col, ls: 3 },
    { t: "rect", x: 56, y: 112, w: chipW, h: 56, fill: col, r: 28, rot: -2, pivot: [56 + chipW / 2, 140] },
    { t: "text", x: 56 + 28, top: 126, lh: 28, text: dateText, size: 26, weight: 700, color: INK, ls: 1, rot: -2, pivot: [56 + chipW / 2, 140] },
    { t: "text", x: 56, top: 196, lh: size, text: title, size, weight: 700, color: TEXT, ls: -Math.round(size / 40) },
    { t: "text", x: 56, top: 196 + size + 6, lh: 40, text: sub, size: 30, weight: 500, color: MUTED },
  ];
}

function kpis(top: number, items: Array<[string, string]>): Op[] {
  const w = 230;
  const ops: Op[] = [];
  items.slice(0, 4).forEach(([value, label], i) => {
    const x = 56 + i * (w + 16);
    ops.push({ t: "rect", x, y: top, w, h: 150, fill: SURFACE, r: 18 });
    ops.push({ t: "text", x: x + 22, top: top + 20, lh: 70, text: value, size: 68, weight: 400, color: TEXT, serif: true, ls: -1 });
    ops.push({ t: "text", x: x + 24, top: top + 102, lh: 24, text: label, size: 19, weight: 600, color: MUTED });
  });
  return ops;
}

function label(top: number, text: string): Op {
  return { t: "text", x: 56, top, lh: 22, text: text.toUpperCase(), size: 18, weight: 700, color: MUTED, ls: 3 };
}

function pills(items: string[]): Op[] {
  const ops: Op[] = [];
  let x = 56;
  for (const it of items.slice(0, 3)) {
    const w = textWidth(it, 20, 0) + 44;
    ops.push({ t: "rect", x, y: 1250, w, h: 48, fill: SURFACE, r: 24 });
    ops.push({ t: "text", x: x + 22, top: 1262, lh: 24, text: it, size: 20, weight: 600, color: TEXT });
    x += w + 12;
  }
  return ops;
}

function bars(
  rows: LeagueWeek["standings"],
  top: number,
  maxPitch: number,
  maxHeight: number,
  barH: number,
  max: number
): Op[] {
  const ops: Op[] = [];
  const pitch = Math.min(maxPitch, Math.floor(maxHeight / Math.max(1, rows.length)));
  const h = Math.min(barH, pitch - 8);
  // Width follows points, but never less than what the name and number need. That minimum must not
  // let a lower score end up with a longer bar, so widths are levelled up from the bottom and tied
  // scores share the same width.
  const widths = rows.map((r) => {
    const minW = 20 + Math.ceil(r.name.length * 17.5) + 28 + String(r.points).length * 21 + 22;
    return Math.min(968, Math.max(minW, Math.round((r.points / Math.max(1, max)) * 968)));
  });
  for (let i = widths.length - 2; i >= 0; i--) widths[i] = Math.max(widths[i], widths[i + 1]);
  for (let i = 1; i < widths.length; i++) {
    if (rows[i].points === rows[i - 1].points) widths[i] = widths[i - 1];
  }

  rows.forEach((r, i) => {
    const y = top + i * pitch;
    const w = widths[i];
    ops.push({ t: "rect", x: 56, y, w, h, fill: r.color, r: 10 });
    ops.push({
      t: "text",
      x: 76,
      top: y + (h - 34) / 2,
      lh: 34,
      text: r.name,
      size: 28,
      weight: 800,
      color: INK,
    });
    ops.push({
      t: "text",
      x: 56 + w - 20 - 120,
      top: y + (h - 52) / 2,
      lh: 52,
      text: String(r.points),
      size: 52,
      weight: 400,
      color: INK,
      serif: true,
      align: "right",
      w: 120,
    });
  });
  return ops;
}

function stats(top: number, items: Array<[string, string]>): Op[] {
  const xs = [56, 386, 716];
  const ops: Op[] = [{ t: "rect", x: 56, y: top, w: 968, h: 2, fill: LINE }];
  items.forEach(([value, label], i) => {
    ops.push({ t: "text", x: xs[i], top: top + 26, lh: 84, text: value, size: 84, weight: 400, color: TEXT, serif: true });
    ops.push({ t: "text", x: xs[i] + 4, top: top + 122, lh: 28, text: label, size: 22, weight: 500, color: MUTED });
  });
  return ops;
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export function leagueCurrentOps(week: LeagueWeek): Op[] {
  const rows = week.standings;
  const leader = rows[0];
  const second = rows[1];
  const hasPoints = !!leader && leader.points > 0;
  const gap = hasPoints && second ? leader.points - second.points : 0;
  const title = hasPoints ? `${leader.name} leads` : "No points yet";
  const sub = !hasPoints
    ? "Results will appear as games qualify"
    : second && gap === 0
    ? `level with ${second.name} on ${leader.points}`
    : second
    ? `by ${gap} ${plural(gap, "point")} this week`
    : "this week";
  return [
    ...frame("violet", week.label.toUpperCase(), title, sub),
    ...kpis(380, [
      [String(leader?.points ?? 0), "leader points"],
      [`${week.daysPlayed}/7`, "days played"],
      [String(week.gamesCounted), "games counted"],
      [String(week.leadChanges), plural(week.leadChanges, "lead change")],
    ]),
    label(560, "Standings"),
    ...bars(rows, 596, 76, 610, 64, leader?.points ?? 1),
    ...pills([`Day ${week.daysElapsed} of 7`, "Final on Sunday night", "Fatherdle league"]),
  ];
}

export function leagueFinalOps(week: LeagueWeek): Op[] {
  const rows = week.standings.filter((r) => r.played || r.points > 0);
  const winner = rows[0];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const ops: Op[] = [
    ...frame(
      "violet",
      week.label.toUpperCase(),
      winner ? `${winner.name} won` : "No winner",
      winner ? `the league with ${winner.points} ${plural(winner.points, "point")}` : "No results this week"
    ),
    { t: "icon", x: 880, y: 196, size: 140, color: ACCENTS.violet[0], paths: TROPHY },
    ...kpis(380, [
      [String(winner?.points ?? 0), "winning points"],
      [String(week.standings.length), "players"],
      [String(week.gamesCounted), "games counted"],
      [String(week.leadChanges), plural(week.leadChanges, "lead change")],
    ]),
    label(560, "Podium"),
  ];
  // Staggered podium: best widest and tallest, bottom-aligned at y=900
  const slots = [
    { idx: 0, w: 380, h: 270, label: "1st" },
    { idx: 1, w: 300, h: 220, label: "2nd" },
    { idx: 2, w: 252, h: 170, label: "3rd" },
  ];
  let x = 56;
  for (const s of slots) {
    const pl = podium[s.idx];
    if (!pl) continue;
    const top = 900 - s.h;
    ops.push({ t: "rect", x, y: top, w: s.w, h: s.h, fill: pl.color, r: 24 });
    ops.push({ t: "text", x: x + 24, top: top + 20, lh: 28, text: s.label, size: 22, weight: 800, color: INK });
    ops.push({ t: "text", x: x + 24, top: top + s.h - 120, lh: 40, text: pl.name, size: 34, weight: 700, color: INK });
    ops.push({ t: "text", x: x + 24, top: top + s.h - 84, lh: 76, text: String(pl.points), size: 76, weight: 400, color: INK, serif: true });
    x += s.w + 12;
  }
  if (rest.length) {
    ops.push(label(930, "Rest of the table"));
    ops.push(...bars(rest.slice(0, 3), 966, 66, 250, 54, winner?.points ?? 1));
  }
  ops.push(...pills([week.label, "Final results", "Fatherdle league"]));
  return ops;
}

export interface PlayerStatsInput {
  name: string;
  color: string;
  rank: number;
  points: number;
  qualifiedGames: number;
  firstPlaces: number;
  averagePlacement: number | null;
  periodLabel: string;
  games: Array<{ name: string; color: string; points: number; slug?: string }>;
}

const ordinalOf = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** A player's statistics for a period: KPIs plus game tiles sized by result. */
export function playerStatsOps(p: PlayerStatsInput): Op[] {
  const ops: Op[] = [
    ...frame("orange", p.periodLabel.toUpperCase(), p.name, `${ordinalOf(p.rank)} place · ${p.points} ${plural(p.points, "point")}`, 120),
    ...kpis(380, [
      [ordinalOf(p.rank), "league position"],
      [String(p.points), "points"],
      [String(p.firstPlaces), p.firstPlaces === 1 ? "first place" : "first places"],
      [p.averagePlacement ? p.averagePlacement.toFixed(1) : "–", "average place"],
    ]),
    label(560, "Points by game"),
  ];
  const games = p.games.slice(0, 12);
  // Top three: staggered podium row with game gradients, bottom-aligned at y=860
  const tops = games.slice(0, 3);
  const widths = [380, 300, 252];
  const heights = [250, 205, 160];
  let x = 56;
  tops.forEach((g, i) => {
    const top = 860 - heights[i];
    const icon = g.slug ? GAME_ICON[g.slug] : undefined;
    ops.push({ t: "rect", x, y: top, w: widths[i], h: heights[i], fill: g.color, grad: icon ? [icon.from, icon.to] : undefined, r: 24 });
    ops.push({ t: "text", x: x + 22, top: top + 18, lh: 30, text: g.name.length > 14 ? g.name.slice(0, 13) + "…" : g.name, size: 24, weight: 700, color: icon?.fg ?? INK });
    ops.push({ t: "text", x: x + 22, top: top + heights[i] - 90, lh: 76, text: String(g.points), size: 76, weight: 400, color: icon?.fg ?? INK, serif: true });
    x += widths[i] + 12;
  });
  // Everything else: plain dark tiles, two columns
  const rest = games.slice(3);
  rest.forEach((g, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const w = 312;
    const tx = 56 + col * (w + 16);
    const ty = 884 + row * 104;
    ops.push({ t: "rect", x: tx, y: ty, w, h: 92, fill: SURFACE, r: 18 });
    ops.push({ t: "text", x: tx + 20, top: ty + 14, lh: 26, text: g.name.length > 13 ? g.name.slice(0, 12) + "…" : g.name, size: 20, weight: 600, color: MUTED });
    ops.push({ t: "text", x: tx + 20, top: ty + 38, lh: 48, text: String(g.points), size: 48, weight: 400, color: TEXT, serif: true });
  });
  if (games.length === 0) {
    ops.push({ t: "text", x: 56, top: 600, lh: 32, text: "No points yet this period.", size: 26, weight: 500, color: MUTED });
  }
  ops.push(...pills([`${p.qualifiedGames} games counted`, p.periodLabel, "Fatherdle league"]));
  return ops;
}

// ---------------------------------------------------------------------------------------------
// Canvas renderer
// ---------------------------------------------------------------------------------------------

function roundedRect(ctx: CanvasRenderingContext2D, op: Extract<Op, { t: "rect" }>) {
  ctx.beginPath();
  if (op.r === undefined) ctx.rect(op.x, op.y, op.w, op.h);
  else ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
  ctx.fill();
}

export function drawOps(ctx: CanvasRenderingContext2D, ops: Op[]) {
  ctx.textBaseline = "middle";
  for (const op of ops) {
    const rot = (op.t === "rect" || op.t === "text") && op.rot ? op : null;
    if (rot) {
      ctx.save();
      ctx.translate(rot.pivot![0], rot.pivot![1]);
      ctx.rotate((rot.rot! * Math.PI) / 180);
      ctx.translate(-rot.pivot![0], -rot.pivot![1]);
    }
    if (op.t === "rect") {
      if (op.grad) {
        const g = ctx.createLinearGradient(op.x, 0, op.x + op.w, 0);
        g.addColorStop(0, op.grad[0]);
        g.addColorStop(1, op.grad[1]);
        ctx.fillStyle = g;
      } else if (op.fade) {
        const g = ctx.createLinearGradient(0, op.y, 0, op.y + op.h);
        g.addColorStop(0, op.fade);
        g.addColorStop(0.55, op.fill);
        g.addColorStop(1, op.fill);
        ctx.fillStyle = g;
      } else ctx.fillStyle = op.fill;
      roundedRect(ctx, op);
    } else if (op.t === "circle") {
      ctx.fillStyle = op.fill;
      ctx.beginPath();
      ctx.arc(op.x + op.d / 2, op.y + op.d / 2, op.d / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (op.t === "text") {
      ctx.fillStyle = op.color;
      ctx.letterSpacing = `${op.ls ?? 0}px`;
      ctx.font = `${op.weight} ${op.size}px ${op.serif ? SERIF : DM}`;
      if (op.align === "right") {
        ctx.textAlign = "right";
        ctx.fillText(op.text, op.x + (op.w ?? 0), op.top + op.lh / 2);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(op.text, op.x, op.top + op.lh / 2);
      }
    } else if (op.t === "icon") {
      ctx.save();
      ctx.translate(op.x, op.y);
      ctx.scale(op.size / 24, op.size / 24);
      ctx.strokeStyle = op.color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const d of op.paths) ctx.stroke(new Path2D(d));
      ctx.restore();
    }
    if (rot) ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";
}
