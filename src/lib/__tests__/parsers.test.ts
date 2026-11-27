import { describe, it, expect } from "vitest";
import {
  parseHuedle,
  parseWordle,
  parseKrillion,
  parseCatfishing,
  parseMapTap,
  parseFlagle,
  parseNoillirk,
  parsePoople,
  parseWordishingrilliontapdle,
  parseMultiGamePaste,
  parseSingleGameText,
} from "../parsers";

const SAMPLE_MULTI_PASTE = `
🎨 Huedle #318
📅 14 Nov 2026
⭐ 113 / 1000
⏱️ 1:51
🔀 57 moves

https://www.huedle.uk?ref=share

_____

Wordle 1,974 6/6

⬜⬜⬜⬜⬜
⬜⬜⬜⬜🟩
⬜⬜🟩⬜🟨
🟩⬜⬜⬜⬜
🟩🟩🟩⬜🟩
🟩🟩🟩🟩🟩


-------


Krillion #122 🦐
330

🦑🦑🐟🐟🐟🦑🦑

-------

catfishing.net
#874 - 4/10
🐟🐈🐈🐈🐈
🐟🐟🐟🐟🐟

-------

www.maptap.gg November 14
100🎯 99🔥 99🔥 97🔥 100🎯
Final score: 988

--------

#Flagle #1727 (14.11.2026) 2/6
🟩🟩🟩
🟥🟩🟩

https://www.flagle.io/?utm_source=share&utm_medium=native

------

Noillirk 🎈 The Daily Climb · No. 49 · 5,863m

🟥🟨🟦🟨🟥🟦🟥

Climb today's prompts: https://playdaily.org/noillirk

-------

Poople #457 7/5
⬜⬜⬜⬜
⬜⬜⬜⬜
🟫⬜⬜⬜
🟫🟫⬜⬜
🟫🟫⬜⬜
🟫🟫⬜⬜
🟫🟫🟫⬜
🟫🟫🟫🟫

https://poople.io/

-------

WORDISHINGRILLIONTAPDLE #5
2/6 · 10,857 pts ×1.00

🟩⬛🟨🟨🟩⬛⬜⬜⬜⬜
⚪ 🐟1 📍500–1k

🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩
🟣 🎯 📍250–500
`;

describe("Game Share Text Parsers", () => {
  it("parses Huedle accurately (lower moves is better)", () => {
    const res = parseHuedle(`🎨 Huedle #318
📅 14 Nov 2026
⭐ 113 / 1000
⏱️ 1:51
🔀 57 moves

https://www.huedle.uk?ref=share`);

    expect(res).not.toBeNull();
    expect(res?.gameSlug).toBe("huedle");
    expect(res?.puzzleId).toBe("#318");
    expect(res?.extractedDate).toBe("2026-11-14");
    expect(res?.primaryValue).toBe(57);
    expect(res?.secondaryValue).toBe(113);
    expect(res?.tertiaryValue).toBe(111); // 1m 51s
    expect(res?.displayResult).toBe("57 moves");
  });

  it("parses Wordle including 1-6 and X/6", () => {
    const win = parseWordle(`Wordle 1,974 6/6

⬜⬜⬜⬜⬜
⬜⬜⬜⬜🟩
⬜⬜🟩⬜🟨
🟩⬜⬜⬜⬜
🟩🟩🟩⬜🟩
🟩🟩🟩🟩🟩`);
    expect(win?.gameSlug).toBe("wordle");
    expect(win?.puzzleId).toBe("#1974");
    expect(win?.primaryValue).toBe(6);
    expect(win?.displayResult).toBe("6/6");
    expect(win?.failed).toBe(false);

    const fail = parseWordle(`Wordle 1,974 X/6*\n⬜⬜⬜⬜⬜`);
    expect(fail?.primaryValue).toBe(7);
    expect(fail?.failed).toBe(true);
    expect(fail?.displayResult).toBe("X/6*");
  });

  it("parses Krillion score and marine emojis", () => {
    const res = parseKrillion(`Krillion #122 🦐
330

🦑🦑🐟🐟🐟🦑🦑`);
    expect(res?.gameSlug).toBe("krillion");
    expect(res?.puzzleId).toBe("#122");
    expect(res?.primaryValue).toBe(330);
    expect(res?.displayResult).toBe("330");
    expect(res?.metadata.fishCount).toBe(3);
    expect(res?.metadata.squidCount).toBe(4);
  });

  it("parses Catfishing score and 10-question grid", () => {
    const res = parseCatfishing(`catfishing.net
#874 - 4/10
🐟🐈🐈🐈🐈
🐟🐟🐟🐟🐟`);
    expect(res?.gameSlug).toBe("catfishing");
    expect(res?.puzzleId).toBe("#874");
    expect(res?.primaryValue).toBe(4);
    expect(res?.displayResult).toBe("4/10");
    expect(res?.metadata.fishCount).toBe(6);
    expect(res?.metadata.catCount).toBe(4);
  });

  it("parses MapTap final score and round bullseyes", () => {
    const res = parseMapTap(`www.maptap.gg November 14
100🎯 99🔥 99🔥 97🔥 100🎯
Final score: 988`);
    expect(res?.gameSlug).toBe("maptap");
    expect(res?.extractedDate).toBe("2026-11-14");
    expect(res?.primaryValue).toBe(988);
    expect(res?.displayResult).toBe("988");
    expect(res?.metadata.bullseyes).toBe(2);
  });

  it("parses Flagle attempts and date", () => {
    const res = parseFlagle(`#Flagle #1727 (14.11.2026) 2/6
🟩🟩🟩
🟥🟩🟩

https://www.flagle.io/?utm_source=share&utm_medium=native`);
    expect(res?.gameSlug).toBe("flagle");
    expect(res?.puzzleId).toBe("#1727");
    expect(res?.extractedDate).toBe("2026-11-14");
    expect(res?.primaryValue).toBe(2);
    expect(res?.displayResult).toBe("2/6");
  });

  it("parses Noillirk altitude and prompt strip", () => {
    const res = parseNoillirk(`Noillirk 🎈 The Daily Climb · No. 49 · 5,863m

🟥🟨🟦🟨🟥🟦🟥

Climb today's prompts: https://playdaily.org/noillirk`);
    expect(res?.gameSlug).toBe("noillirk");
    expect(res?.puzzleId).toBe("#49");
    expect(res?.primaryValue).toBe(5863);
    expect(res?.displayResult).toBe("5,863");
  });

  it("parses Poople guesses and par", () => {
    const res = parsePoople(`Poople #457 7/5
⬜⬜⬜⬜
🟫🟫🟫🟫

https://poople.io/`);
    expect(res?.gameSlug).toBe("poople");
    expect(res?.puzzleId).toBe("#457");
    expect(res?.primaryValue).toBe(7);
    expect(res?.displayResult).toBe("7/5");
    expect(res?.metadata.par).toBe(5);
    expect(res?.metadata.relativeToPar).toBe(2);
  });

  it("parses Wordishingrilliontapdle points, attempts, multiplier, and tags", () => {
    const res = parseWordishingrilliontapdle(`WORDISHINGRILLIONTAPDLE #5
2/6 · 10,857 pts ×1.00

🟩⬛🟨🟨🟩⬛⬜⬜⬜⬜
⚪ 🐟1 📍500–1k

🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩
🟣 🎯 📍250–500`);
    expect(res?.gameSlug).toBe("wordishingrilliontapdle");
    expect(res?.puzzleId).toBe("#5");
    expect(res?.primaryValue).toBe(10857);
    expect(res?.displayResult).toBe("10,857");
    expect(res?.metadata.attempts).toBe(2);
    expect(res?.metadata.multiplier).toBe(1.0);
    expect(res?.metadata.bullseyes).toBe(1);
    expect(res?.metadata.fishTotal).toBe(1);
  });

  it("splits and parses all 9 games from a single multi-game paste window", () => {
    const multi = parseMultiGamePaste(SAMPLE_MULTI_PASTE);
    expect(multi.unrecognisedBlocks).toHaveLength(0);
    expect(multi.parsed).toHaveLength(9);
    expect(multi.parsed.map((p) => p.gameSlug)).toEqual([
      "huedle",
      "wordle",
      "krillion",
      "catfishing",
      "maptap",
      "flagle",
      "noillirk",
      "poople",
      "wordishingrilliontapdle",
    ]);
  });

  it("splits games even when pasted back-to-back without dashed separators", () => {
    const backToBack = `Wordle 1,974 3/6
🟩🟩🟩🟩🟩
www.maptap.gg November 14
100🎯 99🔥 99🔥 97🔥 100🎯
Final score: 988
WORDISHINGRILLIONTAPDLE #5
2/6 · 10,857 pts ×1.00
🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩`;

    const multi = parseMultiGamePaste(backToBack);
    expect(multi.parsed).toHaveLength(3);
    expect(multi.parsed.map((p) => p.gameSlug)).toEqual([
      "wordle",
      "maptap",
      "wordishingrilliontapdle",
    ]);
  });
});

describe("Wordishingrilliontapdle newer share formats", () => {
  it("parses 'Found it in N/6 · X points (rarity ×Y)'", () => {
    const r = parseWordishingrilliontapdle(`WORDISHINGRILLIONTAPDLE #4
Found it in 3/6 · 8,808 points (rarity ×1.00)

1. 🟨⬛⬛⬛🟨⬛⬛⬛
    ⚪ Common · 🐟 3 shared categories · 📍 1,000–2,000 km
2. 🎯 Found it · 📍 under 250 km`);
    expect(r?.primaryValue).toBe(8808);
    expect(r?.failed).toBe(false);
    expect(r?.metadata.attempts).toBe(3);
    expect(r?.tertiaryValue).toBe(1);
  });

  it("parses a failed attempt in the newer format", () => {
    const r = parseWordishingrilliontapdle(`WORDISHINGRILLIONTAPDLE #2
Didn't find it (X/6) · 6,018 points (rarity ×1.30)

1. ⬛⬛⬛🟨⬛🟨🟨⬛
    🔵 Familiar · 🐟 2 shared categories · 📍 500–1,000 km`);
    expect(r?.primaryValue).toBe(6018);
    expect(r?.failed).toBe(true);
    expect(r?.tertiaryValue).toBe(1.3);
  });
});

describe("MapTap rounds", () => {
  it("reads all five round scores whatever badge they carry", () => {
    const r = parseMapTap(`www.maptap.gg November 14
98🔥 89🎉 85💫 90👑 75😂
Final score: 852`);
    expect((r?.metadata.rounds as Array<{ score: number }>).map((x) => x.score)).toEqual([98, 89, 85, 90, 75]);
    expect(r?.primaryValue).toBe(852);
  });
});

describe("Metrodle, Connections and Strands", () => {
  it("parses Metrodle", () => {
    const r = parseSingleGameText(`Metrodle #1631
🟩 🎯
1/6
#metrodle https://metrodle.com/`);
    expect(r?.gameSlug).toBe("metrodle");
    expect(r?.puzzleId).toBe("#1631");
    expect(r?.primaryValue).toBe(1);
    expect(r?.displayResult).toBe("1/6");
    const slow = parseSingleGameText(`Metrodle #1627
🟩 2 stops away
🟩 1 stop away
🟩 🚇
3/6
#metrodle
https://metrodle.com/`);
    expect(slow?.primaryValue).toBe(3);
  });

  it("parses a perfect Connections game", () => {
    const r = parseSingleGameText(`Connections
Puzzle #1252
🟪🟪🟪🟪
🟦🟦🟦🟦
🟩🟩🟩🟩
🟨🟨🟨🟨`);
    expect(r?.gameSlug).toBe("connections");
    expect(r?.puzzleId).toBe("#1252");
    expect(r?.primaryValue).toBe(0);
    expect(r?.failed).toBe(false);
    expect(r?.displayResult).toBe("Perfect");
  });

  it("counts Connections mistakes and ranks a failed game below any solved one", () => {
    const failed = parseSingleGameText(`Connections
Puzzle #1248
🟩🟩🟩🟩
🟪🟨🟨🟨
🟨🟨🟨🟨
🟪🟪🟦🟪
🟪🟪🟦🟦
🟪🟪🟦🟦`);
    expect(failed?.failed).toBe(true);
    expect(failed?.displayResult).toBe("2/4");
    const solved = parseSingleGameText(`Connections
Puzzle #1250
🟪🟦🟪🟪
🟪🟪🟪🟪
🟦🟦🟦🟦
🟩🟩🟩🟩
🟨🟨🟨🟨`);
    expect(solved?.failed).toBe(false);
    expect(solved?.primaryValue).toBe(1);
    expect(solved?.displayResult).toBe("1 mistake");
  });

  it("parses Strands hints and spangram position", () => {
    const clean = parseSingleGameText(`Strands #986
“Preschool fun”
🟡🔵🔵🔵
🔵🔵🔵🔵`);
    expect(clean?.gameSlug).toBe("strands");
    expect(clean?.primaryValue).toBe(0);
    expect(clean?.displayResult).toBe("No hints");
    expect(clean?.secondaryValue).toBe(0);
    const hinted = parseSingleGameText(`Strands #982
“Influentially online”
🔵🟡💡🔵
🔵🔵💡🔵
🔵`);
    expect(hinted?.primaryValue).toBe(2);
    expect(hinted?.displayResult).toBe("2 hints");
    expect(hinted?.secondaryValue).toBe(1);
  });

  it("splits all three out of one paste", () => {
    const { parsed } = parseMultiGamePaste(`Connections
Puzzle #1252
🟪🟪🟪🟪
🟦🟦🟦🟦
🟩🟩🟩🟩
🟨🟨🟨🟨

Strands #986
“Preschool fun”
🟡🔵🔵🔵
🔵🔵🔵🔵

Metrodle #1631
🟩 🎯
1/6
#metrodle https://metrodle.com/`);
    expect(parsed.map((p) => p.gameSlug).sort()).toEqual(["connections", "metrodle", "strands"]);
  });
});

describe("GeoGuessr, Flagcognito and Flagments", () => {
  it("parses a GeoGuessr daily challenge and scores the total", () => {
    const r = parseSingleGameText(`1. South Korea: 4,957 pts, 13 km, 20 sec, 2 steps
2. Ireland: 4,710 pts, 89 km, 28 sec, 1 step
3. Jordan: 646 pts, 3,054 km, 48 sec, 6 steps
4. Luxembourg: 3,976 pts, 342 km, 24 sec, 1 step
5. United States: 4,419 pts, 184 km, 21 sec, 0 steps
Total: 18,708 pts, 3,682 km, 2 min, 21 sec, 10 steps`);
    expect(r?.gameSlug).toBe("geoguessr");
    expect(r?.primaryValue).toBe(18708);
    expect(r?.displayResult).toBe("18,708");
    expect(r?.secondaryValue).toBe(3682);
    expect(r?.tertiaryValue).toBe(141);
    const meta = r?.metadata as { rounds: Array<{ country: string; points: number; km: number; seconds: number; steps: number }> };
    expect(meta.rounds).toHaveLength(5);
    expect(meta.rounds[2]).toMatchObject({ country: "Jordan", points: 646, km: 3054, seconds: 48, steps: 6 });
    expect(meta.rounds[1].steps).toBe(1);
  });

  it("parses Flagcognito points, taps and date", () => {
    const r = parseSingleGameText(`Flagcognito · Nov 16, 2026
🇩🇿 Algeria: 5 taps
🇴🇲 Oman: 5 taps
🇸🇮 Slovenia: 3 taps
2,000 / 3,000
I beat 87% of players.

Can you beat 2,000?
https://guessdash.com/flagcognito?c=5wwfja`);
    expect(r?.gameSlug).toBe("flagcognito");
    expect(r?.primaryValue).toBe(2000);
    expect(r?.displayResult).toBe("2,000");
    expect(r?.extractedDate).toBe("2026-11-16");
    const meta = r?.metadata as { flags: Array<{ flag: string; country: string; taps: number }>; beatPercent: number };
    expect(meta.flags.map((f) => `${f.country}:${f.taps}`)).toEqual(["Algeria:5", "Oman:5", "Slovenia:3"]);
    expect(meta.flags[0].flag).toBe("🇩🇿");
    expect(meta.beatPercent).toBe(87);
  });

  it("parses Flagments points, peeks and misses", () => {
    const r = parseSingleGameText(`Flagments · Nov 16, 2026
Solved 🟣
900 pts · 2 peeks · 0 misses
I beat 97% of players.

Can you beat 900?
https://guessdash.com/flagments?c=esgx59`);
    expect(r?.gameSlug).toBe("flagments");
    expect(r?.primaryValue).toBe(900);
    expect(r?.displayResult).toBe("900");
    expect(r?.extractedDate).toBe("2026-11-16");
    expect(r?.metadata).toMatchObject({ solved: true, peeks: 2, misses: 0, beatPercent: 97 });
    expect(r?.failed).toBe(false);
  });

  it("splits the three new games out of one paste", () => {
    const { parsed } = parseMultiGamePaste(`1. South Korea: 4,957 pts, 13 km, 20 sec, 2 steps
2. Ireland: 4,710 pts, 89 km, 28 sec, 1 step
3. Jordan: 646 pts, 3,054 km, 48 sec, 6 steps
4. Luxembourg: 3,976 pts, 342 km, 24 sec, 1 step
5. United States: 4,419 pts, 184 km, 21 sec, 0 steps
Total: 18,708 pts, 3,682 km, 2 min, 21 sec, 10 steps

Flagcognito · Nov 16, 2026
🇩🇿 Algeria: 5 taps
🇴🇲 Oman: 5 taps
🇸🇮 Slovenia: 3 taps
2,000 / 3,000
I beat 87% of players.

Flagments · Nov 16, 2026
Solved 🟣
900 pts · 2 peeks · 0 misses
I beat 97% of players.`);
    expect(parsed.map((p) => p.gameSlug).sort()).toEqual(["flagcognito", "flagments", "geoguessr"]);
  });
});

describe("GeoGuessr Daily layout with miles and yards", () => {
  const SHARE = `GeoGuessr Daily · 16/11/2026 · 19,411 🥈
🟪🟪🟪🟪🟪⬛⬛⬛⬛⬛
2,714 pts · 566 miles · 🚶 55 steps
🟨🟨🟨🟨🟨🟨🟨🟨🟨🟨 🎯
5,000 pts · 3 yd · 🚶 6 steps
🟪🟪🟪🟪⬛⬛⬛⬛⬛⬛
2,226 pts · 750 miles · 🚶 58 steps
🟨🟨🟨🟨🟨🟨🟨🟨🟨⬛
4,601 pts · 77 miles · 🚶 48 steps
🟨🟨🟨🟨🟨🟨🟨🟨🟨⬛
4,870 pts · 24 miles · 🚶 54 steps
──────────
Now it's your turn! 👇
www.geoguessr.com/dc/nxjqrf66`;

  it("scores the header total and converts miles and yards to kilometres", () => {
    const r = parseSingleGameText(SHARE);
    expect(r?.gameSlug).toBe("geoguessr");
    expect(r?.primaryValue).toBe(19411);
    expect(r?.displayResult).toBe("19,411");
    expect(r?.extractedDate).toBe("2026-11-16");
    const meta = r?.metadata as { rounds: Array<{ points: number; km: number; steps: number; country: string | null }>; total: { km: number; steps: number } };
    expect(meta.rounds).toHaveLength(5);
    expect(meta.rounds.map((x) => x.points)).toEqual([2714, 5000, 2226, 4601, 4870]);
    expect(meta.rounds[0].km).toBeCloseTo(910.9, 1); // 566 miles
    expect(meta.rounds[1].km).toBeCloseTo(0.00274, 4); // 3 yards, about 2.7 metres
    expect(meta.rounds[3].km).toBeCloseTo(123.9, 1); // 77 miles
    expect(meta.rounds[0].country).toBeNull();
    expect(meta.total.steps).toBe(55 + 6 + 58 + 48 + 54);
  });

  it("is split from other games in one paste", () => {
    const { parsed } = parseMultiGamePaste(`${SHARE}

Flagments · Nov 16, 2026
Solved 🟣
900 pts · 2 peeks · 0 misses`);
    expect(parsed.map((p) => p.gameSlug).sort()).toEqual(["flagments", "geoguessr"]);
  });
});

describe("Flagments that was not solved", () => {
  const FAILED = `Flagments · Nov 23, 2026
Didn't get it after 15 peeks
⬛⬛⬛🟣⬛⬛
⬛🟣⬛🟣🟣⬛
⬛🟣🟣⬛🟣⬛
⬛⬛🟣⬛⬛⬛

Can you beat 0?
https://guessdash.com/flagments?c=q5c2qd`;

  it("records an unsolved game as a failed 0 with its peeks", () => {
    const r = parseSingleGameText(FAILED);
    expect(r?.gameSlug).toBe("flagments");
    expect(r?.failed).toBe(true);
    expect(r?.primaryValue).toBe(0);
    expect(r?.displayResult).toBe("0");
    expect(r?.extractedDate).toBe("2026-11-23");
    expect(r?.metadata).toMatchObject({ solved: false, peeks: 15, misses: null });
  });

  it("still reads solved games and splits both out of one paste", () => {
    const { parsed } = parseMultiGamePaste(`${FAILED}

Flagments · Nov 22, 2026
Solved 🟣
900 pts · 2 peeks · 0 misses`);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((p) => p.primaryValue).sort((a, b) => a - b)).toEqual([0, 900]);
  });
});

describe("Whenography", () => {
  const sample = `Whenography
Nov 23, 2026
Score: 2317 / 5000
🟧 19 yrs off · 🟩 spot on · ⬜ 38 yrs off · 🟧 17 yrs off · 🟨 12 yrs off

Can you beat 2,317?
https://guessdash.com/whenography?c=ui0cxt`;

  it("reads the score, the date and every round", () => {
    const r = parseSingleGameText(sample)!;
    expect(r.gameSlug).toBe("whenography");
    expect(r.primaryValue).toBe(2317);
    expect(r.displayResult).toBe("2,317");
    expect(r.extractedDate).toBe("2026-11-23");
    const meta = r.metadata as { rounds: Array<{ tile: string; yearsOff: number }>; totalYearsOff: number };
    expect(meta.rounds.map((x) => x.yearsOff)).toEqual([19, 0, 38, 17, 12]);
    expect(meta.totalYearsOff).toBe(86);
  });

  it("splits out of a multi-game paste", () => {
    const res = parseMultiGamePaste(`${sample}\n\nMetrodle #1640\n3/6\n#metrodle https://metrodle.com/`);
    expect(res.parsed.map((p) => p.gameSlug).sort()).toEqual(["metrodle", "whenography"]);
  });
});

describe("Flagments newer share format", () => {
  const found = `Flagments · Nov 27, 2026
Found it with 1 peek
⬛⬛⬛⬛⬛⬛
⬛⬛🟣⬛⬛⬛
⬛⬛⬛⬛⬛⬛
⬛⬛⬛⬛⬛⬛
1,000 pts · no misses
Best score of the day so far.`;

  it("reads 'Found it' as solved, with the peeks and no misses", () => {
    const r = parseSingleGameText(found)!;
    expect(r.gameSlug).toBe("flagments");
    expect(r.failed).toBe(false);
    expect(r.primaryValue).toBe(1000);
    expect(r.secondaryValue).toBe(1);
    expect(r.tertiaryValue).toBe(0);
  });

  it("still treats a share with no points as unsolved", () => {
    const r = parseSingleGameText("Flagments · Nov 27, 2026\nDidn't get it after 15 peeks\nCan you beat 0?")!;
    expect(r.failed).toBe(true);
  });
});
