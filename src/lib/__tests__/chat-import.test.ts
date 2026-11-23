import { describe, it, expect } from "vitest";
import { parseChatMessages, parseWhatsAppChat, suggestPlayerId, firstName } from "../chat-import";
import type { Player } from "../types";

const IOS = `[16/11/2026, 12:52:58] Maksim: Metrodle #1632
🟩 🎯
1/6
#metrodle https://metrodle.com/
[16/11/2026, 12:53:10] Maksim: Not my best
[16/11/2026, 12:53:51] Adam Ellison: Wordle 1,984 4/6

⬛⬛⬛⬛⬛
🟩🟩🟩🟩🟩
[16/11/2026, 13:01:07] Adam Ellison: Dictionera · Nov 16, 2026
🟩🟨🟨🟧🟧 2,704 / 5,000
Can you beat 2,704?
[16/11/2026, 13:05:00] Quizbois: Adam Ellison added Peter Sheard
[16/11/2026, 13:06:00] Peter Sheard: www.maptap.gg November 16
98🔥 89🎉 85💫 90👑 75😂
Final score: 852`;

const ANDROID = `17/11/2026, 09:40 - Maksim: Connections
Puzzle #1255
🟪🟪🟪🟪
🟦🟦🟦🟦
🟩🟩🟩🟩
🟨🟨🟨🟨
17/11/2026, 09:41 - Duncan Karas: > _Maksim: nice_
thanks
17/11/2026, 09:42 - Duncan Karas: Strands #991
“x”
🟡🔵🔵🔵
🔵🔵🔵🔵`;

const players: Player[] = [
  { id: "p_maksim", slug: "maksim", name: "Maksim", color: "#fff", avatarInitials: "M", joinedAt: "2026-11-09" },
  { id: "p_adam", slug: "adam", name: "Adam", color: "#fff", avatarInitials: "A", joinedAt: "2026-11-09" },
  { id: "p_duncan", slug: "duncan", name: "Duncan", color: "#fff", avatarInitials: "D", joinedAt: "2026-11-09" },
];

describe("WhatsApp chat import", () => {
  it("reads the iPhone export, keeps multi-line messages together and ignores system lines", () => {
    const { messages, dateOrder } = parseChatMessages(IOS);
    expect(dateOrder).toBe("DMY");
    expect(messages).toHaveLength(6); // including the group's own "added Peter" line
    expect(messages[0]).toMatchObject({ sender: "Maksim", date: "2026-11-16" });
    expect(messages[0].body).toContain("1/6");
    expect(messages[2].sender).toBe("Adam Ellison");
  });

  it("finds results, assigns the send date or the share's own date, and counts unknown games", () => {
    const chat = parseWhatsAppChat(IOS);
    expect(chat.results.map((r) => `${r.sender}:${r.game}:${r.date}`).sort()).toEqual([
      "Adam Ellison:wordle:2026-11-16",
      "Maksim:metrodle:2026-11-16",
      "Peter Sheard:maptap:2026-11-16",
    ]);
    expect(chat.unrecognised).toEqual({ Dictionera: 1 });
    expect(chat.senders.find((s) => s.name === "Maksim")).toMatchObject({ messages: 2, results: 1 });
    expect(chat.senders.map((s) => s.name)).not.toContain("Quizbois"); // people with no results are left out
  });

  it("reads the Android layout and skips quoted text", () => {
    const chat = parseWhatsAppChat(ANDROID);
    expect(chat.results.map((r) => `${r.sender}:${r.game}`)).toEqual(["Maksim:connections", "Duncan Karas:strands"]);
    expect(chat.results[0].date).toBe("2026-11-17");
  });

  it("detects month/day exports when a date makes day-first impossible", () => {
    const { messages, dateOrder } = parseChatMessages(`11/16/2026, 9:40 PM - Maksim: hi\n11/17/2026, 9:41 PM - Adam: yo`);
    expect(dateOrder).toBe("MDY");
    expect(messages.map((m) => m.date)).toEqual(["2026-11-16", "2026-11-17"]);
  });

  it("dates a share by its puzzle number when it was posted after midnight", () => {
    const chat = parseWhatsAppChat(`[15/11/2026, 00:20:00] Maksim: Wordle 1,976 5/6\n⬛⬛⬛⬛⬛\n🟩🟩🟩🟩🟩`);
    // puzzle 1,976 is 16 Nov, one day after it was sent
    expect(chat.results[0].date).toBe("2026-11-16");
  });

  it("matches chat names to players by full name, then first name, and leaves strangers alone", () => {
    expect(suggestPlayerId("Maksim", players)).toBe("p_maksim");
    expect(suggestPlayerId("Duncan Karas", players)).toBe("p_duncan");
    expect(suggestPlayerId("Peter Sheard", players)).toBeNull();
    expect(firstName("Peter Sheard")).toBe("Peter");
  });
});
