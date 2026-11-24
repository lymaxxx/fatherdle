import type { Submission } from "../types";

export interface GameStatsBar {
  label: string;
  value: number;
  color?: string;
}

export interface GameStatsPanel {
  results: number;
  kpis: Array<{ label: string; value: string; sub?: string }>;
  distributions: Array<{ title: string; note?: string; kind?: "rows"; bars: GameStatsBar[] }>;
  tiles: Array<{ label: string; value: string; sub?: string }>;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (n: number, d = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(d));
const rows = (raw: string) => raw.split("\n").map((l) => l.trim()).filter(Boolean);

function histogram(values: number[], labels: string[], min: number): Array<{ label: string; value: number }> {
  return labels.map((label, i) => ({ label, value: values.filter((v) => v === min + i).length }));
}

const short = (n: number) => (Math.abs(n) >= 10000 ? `${Math.round(n / 100) / 10}k` : String(n));

function bucketed(values: number[], edges: number[], unit = ""): Array<{ label: string; value: number }> {
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    return {
      // lower bound of each bucket keeps labels short enough for phones
      label: i === edges.length - 2 ? `${short(lo)}+${unit}` : `${short(lo)}${unit}`,
      value: values.filter((v) => v >= lo && (i === edges.length - 2 || v < hi)).length,
    };
  });
}

function attemptsPanel(subs: Submission[], extra: GameStatsPanel["tiles"] = []): Omit<GameStatsPanel, "results"> {
  const solved = subs.filter((s) => !s.failed);
  const dist = histogram(solved.map((s) => s.primaryValue), ["1", "2", "3", "4", "5", "6"], 1);
  dist.push({ label: "Fail", value: subs.filter((s) => s.failed).length });
  return {
    kpis: [
      { label: "avg guesses", value: solved.length ? fmt(avg(solved.map((s) => s.primaryValue))) : "–" },
      { label: "one-shot solves", value: String(solved.filter((s) => s.primaryValue === 1).length) },
      { label: "failed", value: subs.length ? `${Math.round((subs.filter((s) => s.failed).length / subs.length) * 100)}%` : "–" },
    ],
    distributions: [{ title: "Guess distribution", bars: dist }],
    tiles: extra,
  };
}

function scorePanel(subs: Submission[], edges: number[], unit: string, scoreLabel: string, higherBetter = true, extra: GameStatsPanel["tiles"] = []): Omit<GameStatsPanel, "results"> {
  const v = subs.filter((s) => !s.failed).map((s) => s.primaryValue);
  const best = v.length ? (higherBetter ? Math.max(...v) : Math.min(...v)) : null;
  return {
    kpis: [
      { label: `avg ${scoreLabel}`, value: v.length ? Math.round(avg(v)).toLocaleString("en-GB") : "–" },
      { label: `best ${scoreLabel}`, value: best === null ? "–" : best.toLocaleString("en-GB") },
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
  const panels = buildPanels(slug, subs);
  if (panels.kpis.length < 3) {
    panels.kpis.push({ label: "players", value: String(new Set(subs.map((s) => s.playerId)).size) });
  }
  return { results: subs.length, ...panels };
}

function buildPanels(slug: string, subs: Submission[]): Omit<GameStatsPanel, "results"> {
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
          { label: "avg score", value: nums.length ? fmt(avg(nums)) : "–" },
          { label: "perfect tens", value: String(tens) },
            ],
        distributions: [{ title: "Score out of 10", bars: histogram(nums, Array.from({ length: 11 }, (_, i) => String(i)), 0) }],
        tiles: [],
      };
    }
    case "poople": {
      return {
        kpis: [
          { label: "avg rank", value: nums.length ? fmt(avg(nums)) : "–" },
          { label: "best rank", value: nums.length ? String(Math.min(...nums)) : "–" },
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
      const COL: Record<string, string> = { Purple: "#BA81C5", Blue: "#B0C4EF", Green: "#A0C35A", Yellow: "#F9DF6D" };
      const lastEntries = ["Purple", "Blue", "Green", "Yellow"]
        .map((c) => ({ label: c, value: lastColour.get(c) || 0, color: COL[c] }))
        .sort((a, b) => b.value - a.value);
      const solvedSubs = subs.filter((x) => !x.failed);
      return {
        kpis: [
          { label: "perfect, 0 mistakes", value: subs.length ? `${Math.round((perfect / subs.length) * 100)}%` : "–" },
          { label: "avg mistakes", value: solvedSubs.length ? fmt(avg(solvedSubs.map((x) => x.primaryValue))) : "–" },
          { label: "failed (<4 groups)", value: subs.length ? `${Math.round((subs.filter((x) => x.failed).length / subs.length) * 100)}%` : "–" },
        ],
        distributions: [
          {
            title: "Mistakes",
            note: `${subs.length} results · fewer is better`,
            bars: [
              ...histogram(subs.filter((x) => !x.failed).map((x) => Math.min(3, Math.round(x.primaryValue))), ["0", "1", "2", "3"], 0),
              { label: "Fail", value: subs.filter((x) => x.failed).length },
            ],
          },
          { title: "Which group falls last", note: "How often each colour is solved 4th", kind: "rows", bars: lastEntries },
        ],
        tiles: [
          { label: "Longest perfect streak", value: `${bestRun} ${bestRun === 1 ? "day" : "days"}`, sub: "in this range" },
          { label: "Purple-first solves", value: String(purpleFirst), sub: "purple found first" },
          { label: "Failed puzzles", value: String(subs.filter((x) => x.failed).length), sub: "fewer than four groups" },
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
          { label: "avg hints", value: hints.length ? fmt(avg(hints)) : "–" },
          { label: "no-hint days", value: String(hints.filter((h) => h === 0).length) },
            ],
        distributions: [{ title: "Hints used", bars: histogram(hints, ["0", "1", "2", "3", "4+"].slice(0, 5), 0) }],
        tiles: [{ label: "Spangram first", value: String(spanFirst), sub: "found before the other words" }],
      };
    }
    case "geoguessr":
      return scorePanel(subs, evenEdges(nums), "", "total", true);
    case "flagcognito":
      return scorePanel(subs, evenEdges(nums), "", "points", true);
    case "whenography": {
      const rounds = subs.flatMap((x) => {
        try {
          return ((JSON.parse(x.metadataJson)?.rounds ?? []) as Array<{ yearsOff: number }>).map((r) => r.yearsOff);
        } catch {
          return [];
        }
      });
      return scorePanel(subs, [0, 1500, 2000, 2500, 3000, 3500, 4000, 5001], "", "score", true, [
        { label: "Spot-on rounds", value: String(rounds.filter((r) => r === 0).length), sub: `of ${rounds.length} photos` },
        { label: "Average miss", value: rounds.length ? `${fmt(avg(rounds))} yrs` : "–", sub: "per photo" },
        { label: "Biggest miss", value: rounds.length ? `${Math.max(...rounds)} yrs` : "–" },
      ]);
    }
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
