import type { Submission } from "../types";

export interface GameStatsPanel {
  kpis: Array<{ label: string; value: string; sub?: string }>;
  distributions: Array<{ title: string; bars: Array<{ label: string; value: number }> }>;
  tiles: Array<{ label: string; value: string; sub?: string }>;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (n: number, d = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(d));
const rows = (raw: string) => raw.split("\n").map((l) => l.trim()).filter(Boolean);

function histogram(values: number[], labels: string[], min: number): Array<{ label: string; value: number }> {
  return labels.map((label, i) => ({ label, value: values.filter((v) => v === min + i).length }));
}

function bucketed(values: number[], edges: number[], unit = ""): Array<{ label: string; value: number }> {
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    return {
      label: i === edges.length - 2 ? `${lo}+${unit}` : `${lo}–${hi - 1}${unit}`,
      value: values.filter((v) => v >= lo && (i === edges.length - 2 || v < hi)).length,
    };
  });
}

function attemptsPanel(subs: Submission[], extra: GameStatsPanel["tiles"] = []): GameStatsPanel {
  const solved = subs.filter((s) => !s.failed);
  const dist = histogram(solved.map((s) => s.primaryValue), ["1", "2", "3", "4", "5", "6"], 1);
  dist.push({ label: "X", value: subs.filter((s) => s.failed).length });
  return {
    kpis: [
      { label: "Average guesses", value: solved.length ? fmt(avg(solved.map((s) => s.primaryValue))) : "–" },
      { label: "One-shot solves", value: String(solved.filter((s) => s.primaryValue === 1).length) },
      { label: "Fail rate", value: subs.length ? `${Math.round((subs.filter((s) => s.failed).length / subs.length) * 100)}%` : "–" },
    ],
    distributions: [{ title: "Guess distribution", bars: dist }],
    tiles: extra,
  };
}

function scorePanel(subs: Submission[], edges: number[], unit: string, scoreLabel: string, higherBetter = true, extra: GameStatsPanel["tiles"] = []): GameStatsPanel {
  const v = subs.filter((s) => !s.failed).map((s) => s.primaryValue);
  const best = v.length ? (higherBetter ? Math.max(...v) : Math.min(...v)) : null;
  return {
    kpis: [
      { label: `Average ${scoreLabel}`, value: v.length ? Math.round(avg(v)).toLocaleString("en-GB") : "–" },
      { label: `Best ${scoreLabel}`, value: best === null ? "–" : best.toLocaleString("en-GB") },
      { label: "Results", value: String(subs.length) },
    ],
    distributions: [{ title: `${scoreLabel[0].toUpperCase()}${scoreLabel.slice(1)} spread`, bars: bucketed(v, edges, unit) }],
    tiles: extra,
  };
}

function evenEdges(values: number[], n = 6): number[] {
  if (values.length === 0) return [0, 1];
  const lo = Math.floor(Math.min(...values));
  const hi = Math.ceil(Math.max(...values)) + 1;
  const step = Math.max(1, Math.ceil((hi - lo) / n));
  const edges: number[] = [];
  for (let x = lo; x < hi + step; x += step) edges.push(x);
  return edges.slice(0, n + 1);
}

const COLOURS: Record<string, string> = { "🟨": "Yellow", "🟩": "Green", "🟦": "Blue", "🟪": "Purple" };

export function buildGameStats(slug: string, subs: Submission[]): GameStatsPanel {
  const nums = subs.filter((s) => !s.failed).map((s) => s.primaryValue);
  switch (slug) {
    case "wordle": {
      const hard = subs.filter((s) => /\d\/6\*/.test(s.rawText)).length;
      const greensFirst = subs
        .map((s) => rows(s.rawText).find((l) => /^[⬛⬜🟨🟩]+$/u.test(l)))
        .filter((l): l is string => !!l)
        .map((l) => [...l].filter((c) => c === "🟩").length);
      return attemptsPanel(subs, [
        { label: "Hard mode", value: subs.length ? `${Math.round((hard / subs.length) * 100)}%` : "–", sub: `${hard} of ${subs.length} results` },
        { label: "Greens on guess one", value: greensFirst.length ? fmt(avg(greensFirst)) : "–", sub: "average" },
      ]);
    }
    case "flagle":
    case "metrodle":
      return attemptsPanel(subs);
    case "maptap": {
      const rounds = subs.flatMap((s) =>
        s.rawText.split(/\s+/).map((t) => t.match(/^(\d{1,3})[^\d\s]+$/u)).filter((m): m is RegExpMatchArray => !!m && +m[1] <= 100).map((m) => +m[1])
      );
      return scorePanel(subs, [0, 700, 750, 800, 850, 900, 951], "", "score", true, [
        { label: "Best round", value: rounds.length ? String(Math.max(...rounds)) : "–", sub: "single round" },
        { label: "Average round", value: rounds.length ? fmt(avg(rounds)) : "–" },
      ]);
    }
    case "krillion": {
      const over = nums.filter((n) => n > 400).length;
      return scorePanel(subs, evenEdges(nums), "", "score", true, [{ label: "Days over 400", value: String(over), sub: `of ${nums.length} results` }]);
    }
    case "noillirk":
      return scorePanel(subs, evenEdges(nums), "", "distance", true, [
        { label: "Longest throw", value: nums.length ? Math.max(...nums).toLocaleString("en-GB") : "–" },
      ]);
    case "huedle":
      return scorePanel(subs, evenEdges(nums), "", "moves", false);
    case "catfishing": {
      const tens = nums.filter((n) => n >= 10).length;
      return {
        kpis: [
          { label: "Average score", value: nums.length ? fmt(avg(nums)) : "–" },
          { label: "Perfect tens", value: String(tens) },
          { label: "Results", value: String(subs.length) },
        ],
        distributions: [{ title: "Score out of 10", bars: histogram(nums, Array.from({ length: 11 }, (_, i) => String(i)), 0) }],
        tiles: [],
      };
    }
    case "poople": {
      return {
        kpis: [
          { label: "Average rank", value: nums.length ? fmt(avg(nums)) : "–" },
          { label: "Best rank", value: nums.length ? String(Math.min(...nums)) : "–" },
          { label: "Results", value: String(subs.length) },
        ],
        distributions: [{ title: "Rank ladder", bars: bucketed(nums, evenEdges(nums)) }],
        tiles: [],
      };
    }
    case "wordishingrilliontapdle":
      return scorePanel(subs, evenEdges(nums), "", "points", true);
    case "connections": {
      const mistakes = subs.map((s) => Math.min(4, Math.max(0, Math.round(s.primaryValue))));
      const lastColour = new Map<string, number>();
      let purpleFirst = 0;
      let perfect = 0;
      let bestRun = 0;
      let run = 0;
      for (const s of [...subs].sort((a, b) => a.leagueDate.localeCompare(b.leagueDate))) {
        const grid = rows(s.rawText).filter((l) => /^[🟨🟩🟦🟪]{4}$/u.test(l));
        const solvedRows = grid.filter((l) => new Set([...l]).size === 1);
        if (solvedRows.length) {
          const last = COLOURS[[...solvedRows[solvedRows.length - 1]][0]];
          if (!s.failed && last) lastColour.set(last, (lastColour.get(last) || 0) + 1);
          if (new Set([...solvedRows[0]]).size === 1 && solvedRows[0].startsWith("🟪")) purpleFirst++;
        }
        const ok = !s.failed && s.primaryValue === 0;
        if (ok) perfect++;
        run = ok ? run + 1 : 0;
        bestRun = Math.max(bestRun, run);
      }
      const lastEntries = ["Yellow", "Green", "Blue", "Purple"].map((c) => ({ label: c, value: lastColour.get(c) || 0 }));
      return {
        kpis: [
          { label: "Perfect games", value: String(perfect), sub: `of ${subs.length}` },
          { label: "Average mistakes", value: subs.length ? fmt(avg(mistakes)) : "–" },
          { label: "Failed", value: String(subs.filter((s) => s.failed).length) },
        ],
        distributions: [
          { title: "Mistakes", bars: histogram(mistakes, ["0", "1", "2", "3", "4"], 0) },
          { title: "Colour solved last", bars: lastEntries },
        ],
        tiles: [
          { label: "Purple-first club", value: String(purpleFirst), sub: "solved purple first" },
          { label: "Perfect streak", value: String(bestRun), sub: "longest, in this range" },
        ],
      };
    }
    case "strands": {
      const hints = subs.map((s) => Math.max(0, Math.round(s.primaryValue)));
      const spanFirst = subs.filter((s) => {
        const first = [...(rows(s.rawText).find((l) => /^[🟡🔵💡]+$/u.test(l)) ?? "")][0];
        return first === "🟡";
      }).length;
      return {
        kpis: [
          { label: "Average hints", value: hints.length ? fmt(avg(hints)) : "–" },
          { label: "No-hint days", value: String(hints.filter((h) => h === 0).length) },
          { label: "Results", value: String(subs.length) },
        ],
        distributions: [{ title: "Hints used", bars: histogram(hints, ["0", "1", "2", "3", "4+"].slice(0, 5), 0) }],
        tiles: [{ label: "Spangram first", value: String(spanFirst), sub: "found before the other words" }],
      };
    }
    case "geoguessr":
      return scorePanel(subs, evenEdges(nums), "", "total", true);
    case "flagcognito":
      return scorePanel(subs, evenEdges(nums), "", "points", true);
    case "flagments": {
      const unsolved = subs.filter((s) => s.failed).length;
      return scorePanel(subs, evenEdges(nums), "", "points", true, [
        { label: "Unsolved rate", value: subs.length ? `${Math.round((unsolved / subs.length) * 100)}%` : "–", sub: `${unsolved} of ${subs.length}` },
      ]);
    }
    default:
      return scorePanel(subs, evenEdges(nums), "", "score", true);
  }
}
