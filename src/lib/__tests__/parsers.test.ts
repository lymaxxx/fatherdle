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
    expect(r?.metadata.rounds.map((x: { score: number }) => x.score)).toEqual([98, 89, 85, 90, 75]);
    expect(r?.primaryValue).toBe(852);
  });
});
