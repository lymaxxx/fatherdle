import type { LeagueWeek } from "./analytics/feed";

/**
 * League share cards (1080x1350) described once as a list of shapes and text, so the on-screen
 * preview and the downloaded PNG are drawn from exactly the same layout.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;
export const DM = '"DM Sans", system-ui, sans-serif';
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

function header(right: string): Op[] {
  return [
    { t: "circle", x: 56, y: 62, d: 22, fill: LIME },
    { t: "text", x: 92, top: 62, lh: 28, text: "FATHERDLE", size: 22, weight: 800, color: TEXT, ls: 3 },
    { t: "text", x: 624, top: 62, lh: 28, text: right, size: 22, weight: 700, color: TEXT, ls: 3, align: "right", w: 400 },
  ];
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
  rows.forEach((r, i) => {
    const y = top + i * pitch;
    // A bar must be wide enough for the name and the number side by side (about 17px per letter
    // at 28px bold, 21px per digit at 52px serif), whatever its share of the leader's points.
    const minW = 20 + Math.ceil(r.name.length * 17.5) + 28 + String(r.points).length * 21 + 22;
    const w = Math.min(968, Math.max(minW, Math.round((r.points / Math.max(1, max)) * 968)));
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
  const name = hasPoints ? leader.name : "No points yet";
  const size = nameSize(name, 230);
  const sub = !hasPoints
    ? "Results will appear as games qualify"
    : second && gap === 0
    ? `is level with ${second.name} on ${leader.points}`
    : second
    ? `leads the league by ${gap} ${plural(gap, "point")}`
    : "leads the league";

  const ops: Op[] = [
    { t: "rect", x: 0, y: 0, w: CARD_W, h: CARD_H, fill: INK },
    ...header("THIS WEEK"),
    { t: "rect", x: 56, y: 120, w: 968, h: 420, fill: LIME, r: 48 },
    {
      t: "text",
      x: 104,
      top: 168,
      lh: 28,
      text: `LEAGUE STANDINGS · DAY ${week.daysElapsed} OF 7`,
      size: 22,
      weight: 700,
      color: INK,
      ls: 4,
    },
    {
      t: "text",
      x: 96,
      top: 216 + (230 - size) / 2,
      lh: size,
      text: name,
      size,
      weight: 800,
      color: INK,
      ls: Math.round((-9 * size) / 230),
    },
    { t: "text", x: 104, top: 470, lh: 44, text: sub, size: 36, weight: 700, color: INK },
    ...bars(rows, 576, 68, 424, 60, leader?.points ?? 1),
    ...stats(1010, [
      [`${week.daysPlayed} of 7`, "days played"],
      [String(week.gamesCounted), "games counted"],
      [String(week.leadChanges), plural(week.leadChanges, "lead change")],
    ]),
    {
      t: "text",
      x: 56,
      top: 1278,
      lh: 32,
      text: "Standings so far. Final results come on Sunday night.",
      size: 24,
      weight: 500,
      color: MUTED,
    },
  ];
  return ops;
}

export function leagueFinalOps(week: LeagueWeek): Op[] {
  const rows = week.standings.filter((r) => r.played || r.points > 0);
  const winner = rows[0];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const name = winner?.name ?? "No winner";
  const size = nameSize(name, 210, 700);

  const ops: Op[] = [
    { t: "rect", x: 0, y: 0, w: CARD_W, h: CARD_H, fill: INK },
    ...header(week.label.toUpperCase()),
    { t: "rect", x: 56, y: 120, w: 968, h: 360, fill: TEXT, r: 48 },
    { t: "text", x: 104, top: 168, lh: 28, text: "FINAL RESULTS · LEAGUE WINNER", size: 22, weight: 700, color: INK, ls: 4 },
    {
      t: "text",
      x: 96,
      top: 212 + (210 - size) / 2,
      lh: size,
      text: name,
      size,
      weight: 800,
      color: INK,
      ls: Math.round((-8 * size) / 210),
    },
    {
      t: "text",
      x: 104,
      top: 430,
      lh: 42,
      text: winner ? `won with ${winner.points} ${plural(winner.points, "point")}` : "No results this week",
      size: 34,
      weight: 700,
      color: INK,
    },
    { t: "icon", x: 856, y: 170, size: 136, color: INK, paths: TROPHY },
  ];

  // Podium: 2nd | 1st | 3rd, bottoms aligned at y=920
  const slots: Array<{ idx: number; x: number; h: number; label: string }> = [
    { idx: 1, x: 56, h: 260, label: "2nd" },
    { idx: 0, x: 390, h: 330, label: "1st" },
    { idx: 2, x: 724, h: 200, label: "3rd" },
  ];
  for (const s of slots) {
    const p = podium[s.idx];
    if (!p) continue;
    const top = 920 - s.h;
    ops.push({ t: "rect", x: s.x, y: top, w: 300, h: s.h, fill: p.color, r: [28, 28, 0, 0] });
    ops.push({ t: "text", x: s.x + 24, top: top + 22, lh: 44, text: p.name, size: 36, weight: 800, color: INK });
    ops.push({ t: "text", x: s.x + 24, top: top + 58, lh: 92, text: String(p.points), size: 92, weight: 400, color: INK, serif: true });
    ops.push({ t: "text", x: s.x + 24, top: 876, lh: 34, text: s.label, size: 26, weight: 800, color: INK });
  }

  ops.push(...bars(rest.slice(0, 3), 950, 64, 216, 54, winner?.points ?? 1));
  ops.push(
    ...stats(1170, [
      [String(week.standings.length), "players"],
      [String(week.gamesCounted), "games counted"],
      [String(week.leadChanges), plural(week.leadChanges, "lead change")],
    ])
  );
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
  games: Array<{ name: string; color: string; points: number }>;
}

const ordinalOf = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** A player's statistics for a period: position, points, and points earned in each game. */
export function playerStatsOps(p: PlayerStatsInput): Op[] {
  const size = Math.min(176, Math.floor(880 / Math.max(1, p.name.length * 0.6)));
  const ops: Op[] = [
    { t: "rect", x: 0, y: 0, w: CARD_W, h: CARD_H, fill: INK },
    ...header(p.periodLabel.toUpperCase()),
    { t: "rect", x: 56, y: 110, w: 968, h: 420, fill: LIME, r: 48 },
    {
      t: "text",
      x: 96,
      top: 110 + 52 + (176 - size) / 2,
      lh: size,
      text: p.name,
      size,
      weight: 800,
      color: INK,
      ls: Math.round((-7 * size) / 176),
    },
  ];
  const metrics: Array<[string, string, number]> = [
    [ordinalOf(p.rank), "League position", 100],
    [String(p.points), "Points", 386],
    [String(p.firstPlaces), p.firstPlaces === 1 ? "First place" : "First places", 676],
  ];
  for (const [v, label, x] of metrics) {
    ops.push({ t: "text", x, top: 110 + 268, lh: 96, text: v, size: 96, weight: 400, color: INK, serif: true, ls: -3 });
    ops.push({ t: "text", x: x + 4, top: 110 + 366, lh: 28, text: label, size: 20, weight: 600, color: INK });
  }

  const rows = p.games.slice(0, 9);
  const pitch = Math.min(76, Math.floor(690 / Math.max(1, rows.length)));
  const rowH = pitch - 8;
  const max = Math.max(1, ...rows.map((g) => g.points));
  rows.forEach((g, i) => {
    const y = 556 + i * pitch;
    ops.push({ t: "rect", x: 56, y, w: 968, h: rowH, fill: g.color, r: 16 });
    // a darker strip shows each game's share of the best game
    ops.push({
      t: "rect",
      x: 56,
      y: y + rowH - 6,
      w: Math.max(24, Math.round((g.points / max) * 968)),
      h: 6,
      fill: "rgba(18,18,18,0.35)",
      r: [0, 3, 0, 16],
    });
    ops.push({ t: "text", x: 80, top: y + (rowH - 34) / 2, lh: 34, text: g.name, size: 26, weight: 800, color: INK });
    ops.push({
      t: "text",
      x: 1000 - 200,
      top: y + (rowH - 50) / 2,
      lh: 50,
      text: `${g.points}`,
      size: 50,
      weight: 400,
      color: INK,
      serif: true,
      align: "right",
      w: 200,
    });
  });
  if (rows.length === 0) {
    ops.push({ t: "text", x: 56, top: 580, lh: 32, text: "No points yet this period.", size: 24, weight: 500, color: MUTED });
  }
  const avg = p.averagePlacement ? `average place ${p.averagePlacement.toFixed(1)} · ` : "";
  ops.push({
    t: "text",
    x: 56,
    top: 1266,
    lh: 32,
    text: `${avg}${p.qualifiedGames} games counted · points earned in each game`,
    size: 22,
    weight: 500,
    color: MUTED,
  });
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
    if (op.t === "rect") {
      ctx.fillStyle = op.fill;
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
  }
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";
}
