import type { LeagueWeek } from "./analytics/feed";
import { GAME_ICON } from "./game-icons";

/**
 * Share cards (1080x1350) described once as a list of shapes and text, so the on-screen preview
 * and the downloaded PNG are drawn from exactly the same layout.
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
      stroke?: string; // 1px hairline just inside the edge
      grad?: [string, string]; // left-to-right gradient, overrides fill
      halo?: [string, string]; // centred edge-halo radial gradient: core colour, edge colour
      mesh?: string[]; // 3x3 mesh gradient (9 colours, row-major), drawn over `fill`
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
      align?: "left" | "right" | "center";
      w?: number; // box width for right/centre-aligned text
      rot?: number;
      pivot?: [number, number];
    }
  | { t: "icon"; x: number; y: number; size: number; color: string; paths: string[] };

const INK = "#121212";
const TEXT = "#F4F1EA";
const SOFT = "#F4F1EAB3"; // high-contrast label colour on the mesh
const MUTED = "#948F84";
const PANEL = "#12121255"; // translucent surface so the mesh breathes through evenly
const HAIR = "#FFFFFF14";
const HAIR_LINE = "#FFFFFF22";

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

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const ordinalOf = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function textWidth(text: string, size: number, ls = 0): number {
  return Math.ceil(text.length * size * 0.56 + text.length * ls);
}

// ---------------------------------------------------------------------------------------------
// Card system (HANDOVER §6)
// ---------------------------------------------------------------------------------------------

const THEMES = {
  orange: {
    accent: "#FF8A3D",
    // top-left glows, bottom-right falls into near-black
    mesh: ["#FF6A1A", "#B8470F", "#4A1E0A", "#8A3A0C", "#3A1A0C", "#1E1008", "#2A1608", "#1A0F0A", "#120C09"],
  },
  violet: {
    accent: "#B79CF5",
    mesh: ["#5B3FC4", "#3A2A8A", "#1B1740", "#2E2670", "#1A1738", "#101022", "#1A2A12", "#121A10", "#101012"],
  },
  blue: {
    accent: "#6FA8DC",
    mesh: ["#2E7BC4", "#1C4F86", "#0E2038", "#17406E", "#0E1D33", "#0B1522", "#0A1A22", "#0E2A2E", "#1D4F45"],
  },
  yellow: {
    accent: "#FFD93D",
    mesh: ["#8A7A12", "#5E3A8A", "#2A1E48", "#4A4410", "#2A2040", "#18132A", "#2A260C", "#1C1830", "#2E2040"],
  },
  pink: {
    accent: "#F2A7C3",
    mesh: ["#E0457B", "#8A2468", "#2E1230", "#7A1E52", "#3A1530", "#1C0F1C", "#3A1226", "#1E0F18", "#140D12"],
  },
} as const;
export type Accent = keyof typeof THEMES;

interface FrameOpts {
  theme: Accent;
  right: string; // top-right label, e.g. "DAY · ALL GAMES"
  dateText: string; // first filled element so it reads first
  title?: string;
  titleSize?: number;
}

function frame(o: FrameOpts): Op[] {
  const t = THEMES[o.theme];
  const chipW = textWidth(o.dateText, 38, -0.5) + 64;
  const ops: Op[] = [
    { t: "rect", x: 0, y: 0, w: CARD_W, h: CARD_H, fill: "#0C0C0D", mesh: [...t.mesh] },
    { t: "circle", x: 56, y: 56, d: 20, fill: t.accent },
    { t: "text", x: 90, top: 54, lh: 24, text: "DAILY GAMES LEAGUE", size: 18, weight: 700, color: t.accent, ls: 3 },
    { t: "text", x: 624, top: 54, lh: 24, text: o.right, size: 18, weight: 700, color: t.accent, ls: 3, align: "right", w: 400 },
    { t: "rect", x: 56, y: 96, w: chipW, h: 72, fill: t.accent, r: 12, rot: -2, pivot: [56 + chipW / 2, 132] },
    {
      t: "text",
      x: 56 + 30,
      top: 112,
      lh: 40,
      text: o.dateText,
      size: 38,
      weight: 800,
      color: INK,
      ls: -1,
      rot: -2,
      pivot: [56 + chipW / 2, 132],
    },
  ];
  if (o.title) {
    const size = o.titleSize ?? nameSize(o.title, 96, 968);
    ops.push({ t: "text", x: 56, top: 186, lh: size, text: o.title, size, weight: 700, color: TEXT, ls: -Math.round(size / 30) });
  }
  return ops;
}

/** Open KPI strip: hairline above and below, four columns, no box. */
function kpiStrip(top: number, items: Array<[string, string]>, accent: string): Op[] {
  const ops: Op[] = [
    { t: "rect", x: 56, y: top, w: 968, h: 1, fill: HAIR_LINE },
    { t: "rect", x: 56, y: top + 84, w: 968, h: 1, fill: HAIR_LINE },
  ];
  items.slice(0, 4).forEach(([value, label], i) => {
    const x = 56 + i * 242;
    if (i > 0) ops.push({ t: "rect", x: x - 14, y: top + 16, w: 1, h: 54, fill: HAIR_LINE });
    ops.push({ t: "text", x: x + (i ? 2 : 16), top: top + 10, lh: 44, text: value, size: 44, weight: 400, color: i === 0 ? accent : TEXT, serif: true });
    ops.push({ t: "text", x: x + (i ? 2 : 16), top: top + 56, lh: 20, text: label, size: 16, weight: 600, color: SOFT });
  });
  return ops;
}

function label(top: number, text: string): Op {
  return { t: "text", x: 56, top, lh: 22, text: text.toUpperCase(), size: 17, weight: 700, color: SOFT, ls: 3 };
}

function panel(y: number, h: number, x = 56, w = 968): Op {
  return { t: "rect", x, y, w, h, fill: PANEL, stroke: HAIR, r: 24 };
}

/** Three equal footer pills: muted label then a bold value. */
function pills(items: Array<[string, string]>, y = 1214): Op[] {
  const ops: Op[] = [];
  items.slice(0, 3).forEach(([lab, val], i) => {
    const x = 56 + i * 326;
    ops.push({ t: "rect", x, y, w: 316, h: 50, fill: PANEL, stroke: HAIR, r: 25 });
    const labW = textWidth(lab, 16);
    ops.push({ t: "text", x: x + 20, top: y + 15, lh: 20, text: lab, size: 16, weight: 500, color: SOFT });
    ops.push({ t: "text", x: x + 20 + labW + 10, top: y + 12, lh: 26, text: clip(val, Math.max(8, Math.floor((316 - 60 - labW) / 11))), size: 20, weight: 700, color: TEXT });
  });
  return ops;
}

function avatar(x: number, y: number, d: number, color: string, name: string, dim = false): Op[] {
  return [
    { t: "circle", x, y, d, fill: dim ? "#FFFFFF1A" : color },
    {
      t: "text",
      x,
      top: y + (d - d * 0.5) / 2 - 1,
      lh: d * 0.5,
      text: name.slice(0, 1).toUpperCase(),
      size: Math.round(d * 0.46),
      weight: 800,
      color: dim ? MUTED : INK,
      align: "center",
      w: d,
    },
  ];
}

/** Coloured bar with a dark track, as in the standings panels. */
function trackBar(x: number, y: number, w: number, h: number, ratio: number, color: string): Op[] {
  return [
    { t: "rect", x, y, w, h, fill: "#FFFFFF14", r: 6 },
    ...(ratio > 0 ? [{ t: "rect", x, y, w: Math.max(14, Math.round(w * Math.min(1, ratio))), h, fill: color, r: 6 } as Op] : []),
  ];
}

interface GameTile {
  name: string;
  slug?: string;
  big: string; // serif result
  sub?: string;
  segments?: { total: number; on: number[]; strong?: number }; // mini visual along the bottom
  tag?: string; // small chip top-right, e.g. "1ST"
  dim?: boolean;
}

/** Top three: one equal-height row, edge-halo gradients, mini visual underneath. */
function topTiles(tiles: GameTile[], y: number, h: number): Op[] {
  const ops: Op[] = [];
  const w = 316;
  tiles.slice(0, 3).forEach((t, i) => {
    const x = 56 + i * (w + 10);
    const icon = t.slug ? GAME_ICON[t.slug] : undefined;
    const fg = icon?.fg ?? INK;
    ops.push({ t: "rect", x, y, w, h, fill: icon?.from ?? "#E6EB5E", halo: icon ? [icon.from, icon.to] : undefined, r: 22 });
    ops.push({ t: "text", x: x + 16, top: y + 16, lh: 28, text: clip(t.name, 17), size: 22, weight: 700, color: fg });
    if (t.tag) {
      const tw = textWidth(t.tag, 12, 1) + 18;
      ops.push({ t: "rect", x: x + w - 16 - tw, y: y + 16, w: tw, h: 24, fill: "#12121233", r: 12 });
      ops.push({ t: "text", x: x + w - 16 - tw, top: y + 20, lh: 16, text: t.tag, size: 12, weight: 800, color: fg, ls: 1, align: "center", w: tw });
    }
    if (!t.tag) ops.push({ t: "text", x: x + w - 16 - 150, top: y + 8, lh: 44, text: t.big, size: 42, weight: 400, color: fg, serif: true, align: "right", w: 150 });
    else ops.push({ t: "text", x: x + 16, top: y + 52, lh: 56, text: t.big, size: 54, weight: 400, color: fg, serif: true });
    if (t.segments) {
      const segW = Math.floor((w - 32 - (t.segments.total - 1) * 4) / t.segments.total);
      for (let k = 0; k < t.segments.total; k++) {
        const on = t.segments.on.includes(k);
        ops.push({
          t: "rect",
          x: x + 16 + k * (segW + 4),
          y: y + h - 44,
          w: segW,
          h: 5,
          fill: k === t.segments.strong ? "#121212" : on ? "#12121266" : "#12121226",
          r: 3,
        });
      }
    }
    if (t.sub) ops.push({ t: "text", x: x + 16, top: y + h - 30, lh: 18, text: clip(t.sub, 30), size: 15, weight: 600, color: fg });
  });
  return ops;
}

/** The rest: a two-column list inside one translucent panel. */
function compactList(rows: GameTile[], y: number, h: number): Op[] {
  if (rows.length === 0) return [];
  const perCol = Math.max(1, Math.ceil(rows.length / 2));
  const pitch = Math.min(52, Math.floor((h - 24) / perCol));
  h = Math.min(h, perCol * pitch + 28);
  const ops: Op[] = [panel(y, h)];
  rows.forEach((r, i) => {
    const col = i < perCol ? 0 : 1;
    const row = i % perCol;
    const x = 74 + col * 486;
    const ry = y + 14 + row * pitch;
    const colW = 452;
    const dim = r.dim ? "#6a665e" : undefined;
    ops.push({ t: "text", x, top: ry + (pitch - 24) / 2, lh: 24, text: clip(r.name, 18), size: 19, weight: 700, color: dim ?? TEXT });
    if (r.sub) {
      const nw = textWidth(clip(r.name, 18), 19) + 12;
      ops.push({ t: "text", x: x + nw, top: ry + (pitch - 18) / 2 + 1, lh: 18, text: clip(r.sub, 24), size: 13, weight: 500, color: dim ?? MUTED });
    }
    ops.push({ t: "text", x: x + colW - 160, top: ry + (pitch - 24) / 2, lh: 24, text: r.big, size: 19, weight: 700, color: dim ?? TEXT, align: "right", w: 160 });
    if (row < perCol - 1 && row < Math.ceil(rows.length / (col ? 1 : 1))) {
      ops.push({ t: "rect", x, y: ry + pitch - 1, w: colW, h: 1, fill: HAIR });
    }
  });
  if (rows.length > 1) ops.push({ t: "rect", x: 538, y: y + 18, w: 1, h: h - 36, fill: HAIR });
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
      top: y + (h - Math.min(34, Math.round(h * 0.75))) / 2,
      lh: Math.min(34, Math.round(h * 0.75)),
      text: r.name,
      size: Math.min(28, Math.floor(h * 0.62)),
      weight: 800,
      color: INK,
    });
    const scoreSize = Math.min(52, Math.floor(h * 0.86));
    ops.push({
      t: "text",
      x: 56 + w - 20 - 120,
      top: y + (h - scoreSize) / 2,
      lh: scoreSize,
      text: String(r.points),
      size: scoreSize,
      weight: 400,
      color: INK,
      serif: true,
      align: "right",
      w: 120,
    });
  });
  return ops;
}


// ---------------------------------------------------------------------------------------------
// League week cards
// ---------------------------------------------------------------------------------------------

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
  const size = nameSize(title, 108, 968);
  return [
    ...frame({ theme: "violet", right: "LEAGUE · THIS WEEK", dateText: week.label.toUpperCase() }),
    { t: "text", x: 56, top: 190, lh: size, text: title, size, weight: 700, color: TEXT, ls: -Math.round(size / 30) },
    { t: "text", x: 58, top: 190 + size + 4, lh: 36, text: sub, size: 28, weight: 500, color: SOFT },
    ...kpiStrip(380, [
      [String(leader?.points ?? 0), "leader points"],
      [`${week.daysPlayed}/7`, "days played"],
      [String(week.gamesCounted), "games counted"],
      [String(week.leadChanges), plural(week.leadChanges, "lead change")],
    ], THEMES.violet.accent),
    label(500, "Standings"),
    ...bars(rows, 536, 76, 640, 64, leader?.points ?? 1),
    ...pills([
      ["Day", `${week.daysElapsed} of 7`],
      ["Final", "Sunday night"],
      ["Games", String(week.gamesCounted)],
    ]),
  ];
}

export function leagueFinalOps(week: LeagueWeek): Op[] {
  const rows = week.standings.filter((r) => r.played || r.points > 0);
  const winner = rows[0];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const title = winner ? `${winner.name} won` : "No winner";
  const size = nameSize(title, 108, 760);
  const ops: Op[] = [
    ...frame({ theme: "violet", right: "LEAGUE · FINAL", dateText: week.label.toUpperCase() }),
    { t: "text", x: 56, top: 190, lh: size, text: title, size, weight: 700, color: TEXT, ls: -Math.round(size / 30) },
    {
      t: "text",
      x: 58,
      top: 190 + size + 4,
      lh: 36,
      text: winner ? `the league with ${winner.points} ${plural(winner.points, "point")}` : "No results this week",
      size: 28,
      weight: 500,
      color: SOFT,
    },
    { t: "icon", x: 880, y: 196, size: 136, color: THEMES.violet.accent, paths: TROPHY },
    ...kpiStrip(380, [
      [String(winner?.points ?? 0), "winning points"],
      [String(week.standings.length), "players"],
      [String(week.gamesCounted), "games counted"],
      [String(week.leadChanges), plural(week.leadChanges, "lead change")],
    ], THEMES.violet.accent),
    label(500, "Podium"),
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
    ops.push(...bars(rest.slice(0, 3), 966, 66, 220, 54, winner?.points ?? 1));
  }
  ops.push(...pills([
    ["Players", String(week.standings.length)],
    ["Games", String(week.gamesCounted)],
    ["Lead changes", String(week.leadChanges)],
  ]));
  return ops;
}

// ---------------------------------------------------------------------------------------------
// Day (whole group)
// ---------------------------------------------------------------------------------------------

export interface GroupDayInput {
  dateText: string; // e.g. "SUNDAY 23 NOV 2026"
  counted: number;
  pending: number;
  pointsShared: number;
  players: Array<{ name: string; color: string; points: number; firstPlaces: number; gamesPlayed: number; played: boolean }>;
  games: Array<{ name: string; slug: string; submitted: number; of: number; counted: boolean; leader: string; result: string }>;
}

function attemptSegments(slug: string, result: string): GameTile["segments"] | undefined {
  if (!["wordle", "flagle", "metrodle"].includes(slug)) return undefined;
  const m = result.match(/(\d)\s*\/\s*6/);
  if (!m) return { total: 6, on: [] };
  const n = Number(m[1]);
  return { total: 6, on: Array.from({ length: n }, (_, i) => i), strong: n - 1 };
}

export function groupDayOps(d: GroupDayInput): Op[] {
  const ordered = [...d.games].sort((a, b) => b.submitted - a.submitted || Number(b.counted) - Number(a.counted));
  const active = d.players.filter((p) => p.played);
  const top = Math.max(1, ...d.players.map((p) => p.points));
  const accent = THEMES.blue.accent;
  const title = `${d.counted} ${plural(d.counted, "game")} counted`;
  const ops: Op[] = [
    ...frame({ theme: "blue", right: "DAY · ALL GAMES", dateText: d.dateText, title, titleSize: 84 }),
    ...kpiStrip(278, [
      [String(active.length), "players active"],
      [String(d.counted), "games counted"],
      [String(d.pending), "still pending"],
      [String(d.pointsShared), "points shared"],
    ], accent),
    label(386, "Points today"),
    panel(414, 346),
  ];
  const rows = d.players.slice(0, 6);
  const pitch = Math.min(56, Math.floor(326 / Math.max(1, rows.length)));
  rows.forEach((p, i) => {
    const y = 426 + i * pitch;
    const dim = !p.played;
    ops.push({ t: "text", x: 74, top: y + (pitch - 20) / 2, lh: 20, text: dim ? "–" : String(i + 1), size: 14, weight: 700, color: MUTED });
    ops.push(...avatar(110, y + (pitch - 40) / 2, 40, p.color, p.name, dim));
    ops.push({ t: "text", x: 166, top: y + 3, lh: 28, text: clip(p.name, 12), size: 24, weight: 700, color: dim ? MUTED : TEXT });
    ops.push({
      t: "text",
      x: 166,
      top: y + 31,
      lh: 16,
      text: dim ? "pending" : `${p.firstPlaces}× 1st · ${p.gamesPlayed} ${plural(p.gamesPlayed, "game")}`,
      size: 13,
      weight: 500,
      color: MUTED,
    });
    ops.push(...trackBar(292, y + (pitch - 22) / 2, 640, 22, dim ? 0 : p.points / top, p.color));
    ops.push({ t: "text", x: 940, top: y + (pitch - 44) / 2, lh: 44, text: dim ? "—" : String(p.points), size: 42, weight: 400, color: dim ? MUTED : TEXT, serif: true, align: "right", w: 64 });
  });
  ops.push(label(786, "Games · most played first"));
  ops.push(
    ...topTiles(
      ordered.slice(0, 3).map((g) => ({
        name: g.name,
        slug: g.slug,
        big: g.result || `${g.submitted}/${g.of}`,
        sub: `${g.leader ? `${g.leader} · ` : ""}${g.submitted} played`,
        segments: attemptSegments(g.slug, g.result) ?? { total: Math.max(1, Math.min(6, g.of)), on: Array.from({ length: Math.min(6, g.submitted) }, (_, i) => i) },
      })),
      814,
      118
    )
  );
  ops.push(
    ...compactList(
      ordered.slice(3, 15).map((g) => ({
        name: g.name,
        sub: g.submitted ? `${g.leader ? g.leader + " · " : ""}${g.submitted} played` : `waiting for ${Math.max(1, Math.ceil(Math.max(1, active.length) / 2))}`,
        big: g.submitted ? g.result || `${g.submitted}/${g.of}` : "—",
        dim: g.submitted === 0 || !g.counted,
      })),
      942,
      256
    )
  );
  const top1 = [...d.players].sort((a, b) => b.points - a.points)[0];
  const quiet = ordered.filter((g) => g.submitted === 0).map((g) => g.name)[0];
  ops.push(
    ...pills([
      ["Most played", ordered[0] ? clip(ordered[0].name, 12) : "–"],
      ["Top scorer", top1 && top1.points > 0 ? `${top1.name} · ${top1.points}` : "–"],
      ["Quiet game", quiet ?? "none"],
    ])
  );
  return ops;
}

// ---------------------------------------------------------------------------------------------
// Player · day
// ---------------------------------------------------------------------------------------------

export interface PlayerDayInput {
  name: string;
  dateText: string;
  rank: number;
  points: number;
  rows: Array<{ name: string; slug: string; placement: number; outOf: number; points: number; counts: boolean; result: string }>;
  gamesTotal: number;
}

export function playerDayOps(d: PlayerDayInput): Op[] {
  const accent = THEMES.pink.accent;
  const wins = d.rows.filter((r) => r.placement === 1).length;
  const ordered = [...d.rows].sort((a, b) => a.placement - b.placement || b.outOf - a.outOf);
  const nsize = nameSize(d.name, 150, 560);
  const ops: Op[] = [
    ...frame({ theme: "pink", right: "PLAYER · DAY", dateText: d.dateText }),
    { t: "text", x: 54, top: 176, lh: nsize, text: d.name, size: nsize, weight: 700, color: TEXT, ls: -Math.round(nsize / 24) },
    { t: "text", x: 560, top: 196, lh: 112, text: `${ordinalOf(d.rank)} · ${d.points}`, size: 100, weight: 400, color: TEXT, serif: true, align: "right", w: 380 },
    { t: "text", x: 950, top: 254, lh: 26, text: plural(d.points, "point"), size: 22, weight: 600, color: SOFT },
    ...kpiStrip(338, [
      [ordinalOf(d.rank), "today's position"],
      [`${d.rows.length} / ${d.gamesTotal}`, "games played"],
      [String(wins), plural(wins, "first place")],
      [String(d.rows.filter((r) => r.counts).length), "counted today"],
    ], accent),
    label(450, "Every game · best first"),
  ];
  ops.push(
    ...topTiles(
      ordered.slice(0, 3).map((r) => ({
        name: r.name,
        slug: r.slug,
        big: r.result || ordinalOf(r.placement),
        tag: ordinalOf(r.placement).toUpperCase(),
        sub: `of ${r.outOf}${r.counts ? ` · +${r.points}` : " · pending"}`,
        segments: attemptSegments(r.slug, r.result),
      })),
      482,
      172
    )
  );
  ops.push(
    ...compactList(
      ordered.slice(3, 15).map((r) => ({
        name: r.name,
        sub: `${ordinalOf(r.placement)} of ${r.outOf}`,
        big: r.result || "—",
        dim: !r.counts,
      })),
      668,
      520
    )
  );
  ops.push(
    ...pills([
      ["Best", ordered[0] ? clip(ordered[0].name, 12) : "–"],
      ["Points", String(d.points)],
      ["Played", `${d.rows.length} of ${d.gamesTotal}`],
    ])
  );
  return ops;
}

// ---------------------------------------------------------------------------------------------
// Player · week / range
// ---------------------------------------------------------------------------------------------

export interface PlayerStatsInput {
  name: string;
  color: string;
  rank: number;
  points: number;
  qualifiedGames: number;
  firstPlaces: number;
  averagePlacement: number | null;
  positionChange: number | null;
  periodLabel: string;
  daily: Array<{ label: string; value: number }>;
  games: Array<{ name: string; color: string; points: number; slug?: string; best?: string; place?: string }>;
}

export function playerStatsOps(p: PlayerStatsInput): Op[] {
  const accent = THEMES.orange.accent;
  const nsize = nameSize(p.name, 170, 560);
  const change = p.positionChange;
  const ops: Op[] = [
    ...frame({ theme: "orange", right: "PLAYER · WRAPPED", dateText: p.periodLabel.toUpperCase() }),
    { t: "text", x: 54, top: 170, lh: nsize, text: p.name, size: nsize, weight: 700, color: TEXT, ls: -Math.round(nsize / 24) },
    { t: "text", x: 540, top: 196, lh: 112, text: `${ordinalOf(p.rank)} · ${p.points}`, size: 100, weight: 400, color: TEXT, serif: true, align: "right", w: 400 },
    { t: "text", x: 950, top: 254, lh: 26, text: plural(p.points, "point"), size: 22, weight: 600, color: SOFT },
    ...kpiStrip(334, [
      [change === null || change === 0 ? "–" : change > 0 ? `+${change}` : String(change), "place vs last period"],
      [String(p.qualifiedGames), "games counted"],
      [String(p.firstPlaces), plural(p.firstPlaces, "first place")],
      [p.averagePlacement ? p.averagePlacement.toFixed(1) : "–", "average place"],
    ], accent),
  ];
  // Points each day
  const daily = p.daily.slice(-10);
  if (daily.length) {
    ops.push(panel(442, 194));
    ops.push({ t: "text", x: 80, top: 462, lh: 20, text: "POINTS EACH DAY", size: 16, weight: 700, color: SOFT, ls: 3 });
    const max = Math.max(1, ...daily.map((d) => d.value));
    const avg = daily.reduce((a, d) => a + d.value, 0) / daily.length;
    const bw = Math.floor((968 - 48 - (daily.length - 1) * 12) / daily.length);
    daily.forEach((d, i) => {
      const bx = 80 + i * (bw + 12);
      const h = Math.max(6, Math.round((d.value / max) * 62));
      const hi = d.value >= avg && d.value > 0;
      ops.push({ t: "rect", x: bx, y: 570 - h, w: bw, h, fill: hi ? "#E6EB5E" : "#FFFFFF26", r: [6, 6, 0, 0] });
      ops.push({ t: "text", x: bx, top: 570 - h - 22, lh: 18, text: String(d.value), size: 15, weight: 700, color: hi ? "#E6EB5E" : SOFT, align: "center", w: bw });
      ops.push({ t: "text", x: bx, top: 580, lh: 18, text: d.label, size: 15, weight: 500, color: SOFT, align: "center", w: bw });
    });
  }
  const gy = daily.length ? 666 : 450;
  ops.push(label(gy, "Best result in each game"));
  const games = p.games.slice(0, 15);
  ops.push(
    ...topTiles(
      games.slice(0, 3).map((g) => ({
        name: g.name,
        slug: g.slug,
        big: g.best || String(g.points),
        tag: g.place ? g.place.toUpperCase() : undefined,
        sub: `${g.points} pts`,
        segments: g.slug && g.best ? attemptSegments(g.slug, g.best) : undefined,
      })),
      gy + 30,
      152
    )
  );
  ops.push(
    ...compactList(
      games.slice(3).map((g) => ({ name: g.name, sub: g.place ?? "", big: g.best || `${g.points} pts` })),
      gy + 194,
      1196 - (gy + 194)
    )
  );
  const best = games[0];
  ops.push(
    ...pills([
      ["Best game", best ? clip(best.name, 12) : "–"],
      ["Points", String(p.points)],
      ["Period", clip(p.periodLabel, 12)],
    ])
  );
  return ops;
}

// ---------------------------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------------------------

export interface GameCardInput {
  name: string;
  slug: string;
  rangeLabel: string;
  kpis: Array<[string, string]>;
  boardLabel: string;
  leaderboard: Array<{ name: string; color: string; value: string; note?: string; ratio: number }>;
  distributionLabel: string;
  distribution: Array<{ label: string; value: number; color?: string }> | null;
  footer: Array<[string, string]>;
}

export function gameCardOps(d: GameCardInput): Op[] {
  const icon = GAME_ICON[d.slug];
  const theme: Accent = "yellow";
  const accent = THEMES[theme].accent;
  const size = nameSize(d.name, 150, 968);
  const ops: Op[] = [
    ...frame({ theme, right: `GAME · ${d.name.toUpperCase()}`, dateText: d.rangeLabel.toUpperCase() }),
    { t: "text", x: 54, top: 190, lh: size, text: d.name, size, weight: 700, color: TEXT, ls: -Math.round(size / 24) },
    ...kpiStrip(376, d.kpis, accent),
    label(506, d.boardLabel),
  ];
  const rows = d.leaderboard.slice(0, 6);
  const pitch = 46;
  ops.push(panel(534, rows.length * pitch + 24));
  rows.forEach((r, i) => {
    const y = 546 + i * pitch;
    ops.push({ t: "text", x: 74, top: y + (pitch - 20) / 2, lh: 20, text: String(i + 1), size: 14, weight: 700, color: MUTED });
    ops.push(...avatar(108, y + 3, 40, r.color, r.name));
    ops.push({ t: "text", x: 162, top: y + (pitch - 28) / 2, lh: 28, text: clip(r.name, 10), size: 22, weight: 700, color: TEXT });
    ops.push(...trackBar(300, y + (pitch - 18) / 2, 450, 18, r.ratio, r.color));
    if (r.note) ops.push({ t: "text", x: 760, top: y + (pitch - 18) / 2, lh: 18, text: r.note, size: 13, weight: 500, color: MUTED, align: "right", w: 140 });
    ops.push({ t: "text", x: 920, top: y + (pitch - 38) / 2, lh: 38, text: r.value, size: 36, weight: 400, color: TEXT, serif: true, align: "right", w: 84 });
  });
  const distTop = 534 + rows.length * pitch + 24 + 30;
  if (d.distribution && d.distribution.length) {
    ops.push(label(distTop, d.distributionLabel));
    const ph = 1196 - (distTop + 30);
    ops.push(panel(distTop + 28, ph));
    const bars2 = d.distribution.slice(0, 11);
    const max = Math.max(1, ...bars2.map((b) => b.value));
    const bw = Math.floor((968 - 48 - (bars2.length - 1) * 12) / bars2.length);
    const area = ph - 90;
    bars2.forEach((b, i) => {
      const h = Math.max(6, Math.round((b.value / max) * area));
      const x = 80 + i * (bw + 12);
      const base = distTop + 28 + ph - 44;
      ops.push({ t: "rect", x, y: base - h, w: bw, h, fill: b.color ?? icon?.from ?? "#FFD93D", r: [8, 8, 0, 0] });
      ops.push({ t: "text", x, top: base - h - 26, lh: 22, text: String(b.value), size: 19, weight: 700, color: TEXT, align: "center", w: bw });
      ops.push({ t: "text", x, top: base + 10, lh: 22, text: b.label, size: 18, weight: 500, color: SOFT, align: "center", w: bw });
    });
  }
  ops.push(...pills(d.footer));
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

function drawMesh(ctx: CanvasRenderingContext2D, op: Extract<Op, { t: "rect" }>) {
  const cols = op.mesh!;
  ctx.save();
  ctx.beginPath();
  ctx.rect(op.x, op.y, op.w, op.h);
  ctx.clip();
  // Nine soft blobs on a 3x3 grid blend into one smooth mesh
  const rad = Math.max(op.w, op.h) * 0.62;
  cols.forEach((c, i) => {
    const cx = op.x + ((i % 3) / 2) * op.w;
    const cy = op.y + (Math.floor(i / 3) / 2) * op.h;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, c);
    g.addColorStop(1, c + "00");
    ctx.fillStyle = g;
    ctx.fillRect(op.x, op.y, op.w, op.h);
  });
  ctx.restore();
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
    if (op.t === "rect" && op.halo) {
      ctx.beginPath();
      if (op.r === undefined) ctx.rect(op.x, op.y, op.w, op.h);
      else ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
      ctx.save();
      ctx.translate(op.x + op.w / 2, op.y + op.h / 2);
      ctx.scale((op.w / 2) * Math.SQRT2, (op.h / 2) * Math.SQRT2);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, op.halo[0]);
      g.addColorStop(0.42, op.halo[0]);
      g.addColorStop(1, op.halo[1]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    } else if (op.t === "rect") {
      if (op.grad) {
        const g = ctx.createLinearGradient(op.x, 0, op.x + op.w, 0);
        g.addColorStop(0, op.grad[0]);
        g.addColorStop(1, op.grad[1]);
        ctx.fillStyle = g;
      } else ctx.fillStyle = op.fill;
      roundedRect(ctx, op);
      if (op.mesh) drawMesh(ctx, op);
      if (op.stroke) {
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (op.r === undefined) ctx.rect(op.x + 0.5, op.y + 0.5, op.w - 1, op.h - 1);
        else ctx.roundRect(op.x + 0.5, op.y + 0.5, op.w - 1, op.h - 1, op.r);
        ctx.stroke();
      }
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
      } else if (op.align === "center") {
        ctx.textAlign = "center";
        ctx.fillText(op.text, op.x + (op.w ?? 0) / 2, op.top + op.lh / 2);
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
