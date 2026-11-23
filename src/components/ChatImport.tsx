"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GAMES } from "@/lib/constants";
import {
  ChatResult,
  ParsedChat,
  firstName,
  parseWhatsAppChat,
  suggestPlayerId,
} from "@/lib/chat-import";

interface PlayerLite {
  id: string;
  name: string;
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export function ChatImport({
  players,
  onImported,
}: {
  players: PlayerLite[];
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedChat | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // sender -> player id | "new" | "skip"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const loadExisting = useCallback(async () => {
    try {
      const res = await fetch("/api/admin?keys=1");
      const json = await res.json();
      setExisting(new Set<string>(json.resultKeys ?? []));
    } catch {
      setExisting(new Set());
    }
  }, []);

  useEffect(() => {
    if (open) loadExisting();
  }, [open, loadExisting]);

  const readChat = (text: string) => {
    setMessage(null);
    const chat = parseWhatsAppChat(text);
    if (chat.messages.length === 0) {
      setParsed(null);
      setMessage({
        kind: "error",
        text: "Couldn't find any chat messages. Paste the text from the exported chat (the _chat.txt file).",
      });
      return;
    }
    const next: Record<string, string> = {};
    for (const s of chat.senders) {
      next[s.name] = suggestPlayerId(s.name, players as never) ?? (s.results > 0 ? "new" : "skip");
    }
    setMapping(next);
    const dates = chat.results.map((r) => r.date).sort();
    setFrom(dates[0] ?? "");
    setTo(dates[dates.length - 1] ?? "");
    setParsed(chat);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.zip$/i.test(file.name)) {
      setMessage({ kind: "error", text: "That's a zip. Open it and use the _chat.txt inside." });
      return;
    }
    const text = await file.text();
    setRaw(text);
    readChat(text);
  };

  /** Results in the chosen dates for people who aren't skipped; a later duplicate replaces an earlier one. */
  const plan = useMemo(() => {
    if (!parsed) return null;
    const byKey = new Map<string, { ref: string; label: string; r: ChatResult }>();
    for (const r of parsed.results) {
      if (from && r.date < from) continue;
      if (to && r.date > to) continue;
      const target = mapping[r.sender] ?? "skip";
      if (target === "skip") continue;
      const ref = target === "new" ? `new:${firstName(r.sender)}` : target;
      byKey.set(`${ref}|${r.game}|${r.date}`, { ref, label: ref, r });
    }
    const items = [...byKey.values()];
    const isExisting = (i: { ref: string; r: ChatResult }) => existing.has(`${i.ref}|${i.r.game}|${i.r.date}`);
    const already = items.filter(isExisting).length;
    const perGame: Record<string, number> = {};
    for (const i of items) perGame[i.r.game] = (perGame[i.r.game] ?? 0) + 1;
    const people = new Set(items.map((i) => i.ref)).size;
    const days = new Set(items.map((i) => i.r.date)).size;
    return { items, already, fresh: items.length - already, perGame, people, days };
  }, [parsed, mapping, from, to, existing]);

  const runImport = async () => {
    if (!plan || plan.items.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const out = await post({
        action: "import-results",
        overwrite,
        entries: plan.items.map((i) => ({ player: i.ref, date: i.r.date, text: i.r.text })),
      });
      const bits = [
        `Added ${out.added}`,
        out.replaced ? `replaced ${out.replaced}` : "",
        out.skippedExisting ? `skipped ${out.skippedExisting} already there` : "",
        out.unreadable ? `${out.unreadable} unreadable` : "",
        out.createdPlayers?.length ? `new players: ${out.createdPlayers.join(", ")}` : "",
      ].filter(Boolean);
      setMessage({ kind: "ok", text: `${bits.join(" · ")}.` });
      await loadExisting();
      onImported();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Import failed." });
    } finally {
      setBusy(false);
    }
  };

  const unrecognised = parsed ? Object.entries(parsed.unrecognised).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="bg-surface border border-line/50 rounded-[22px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span>
          <span className="block text-[17px] font-extrabold">Import a WhatsApp chat</span>
          <span className="block text-[13px] text-muted">
            Paste the exported chat and every result is assigned to the right player and day.
          </span>
        </span>
        <span className="text-muted text-xl">{open ? "–" : "+"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-line/50 pt-4">
          <div className="space-y-2">
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              placeholder="Paste the whole exported chat here…"
              className="w-full bg-bg border border-line rounded-2xl p-3 text-[13px] font-mono text-text placeholder:text-muted/60 focus:outline-none focus:border-lime resize-y"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!raw.trim()}
                onClick={() => readChat(raw)}
                className="px-5 py-2.5 rounded-full bg-lime text-[#121212] text-[13px] font-extrabold disabled:opacity-40"
              >
                Read chat
              </button>
              <label className="px-4 py-2.5 rounded-full border border-line text-[13px] font-bold cursor-pointer hover:bg-surface2">
                Choose .txt file
                <input
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              <span className="text-[12px] text-muted">
                In WhatsApp: group → Export chat → Without media.
              </span>
            </div>
          </div>

          {message && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                message.kind === "ok" ? "bg-lime/15 text-lime" : "bg-orange/15 text-orange"
              }`}
            >
              {message.text}
            </div>
          )}

          {parsed && plan && (
            <>
              <div className="text-[13px] text-muted">
                Read {parsed.messages.length.toLocaleString()} messages and found{" "}
                <strong className="text-text">{parsed.results.length}</strong> results
                {parsed.results.length > 0 && ` (dates read as ${parsed.dateOrder === "DMY" ? "day/month" : "month/day"})`}.
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Who is who</div>
                {parsed.senders.map((s) => (
                  <div key={s.name} className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[150px] flex-1">
                      <span className="font-bold text-[14px]">{s.name}</span>
                      <span className="text-[12px] text-muted"> · {s.results} results</span>
                    </div>
                    <select
                      value={mapping[s.name] ?? "skip"}
                      onChange={(e) => setMapping((m) => ({ ...m, [s.name]: e.target.value }))}
                      className="bg-surface2 border border-line rounded-xl px-3 py-2 text-sm font-bold text-text min-w-[170px]"
                    >
                      <option value="skip">Skip</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="new">New player “{firstName(s.name)}”</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-md">
                <div className="min-w-0">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="block w-full min-w-0 bg-surface2 border border-line rounded-xl px-3 py-2 text-sm font-bold text-text"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="block w-full min-w-0 bg-surface2 border border-line rounded-xl px-3 py-2 text-sm font-bold text-text"
                  />
                </div>
              </div>

              <div className="bg-bg/60 border border-line/60 rounded-2xl p-4 space-y-3">
                <div className="text-[14px]">
                  <strong>{plan.items.length}</strong> results from <strong>{plan.people}</strong> players across{" "}
                  <strong>{plan.days}</strong> days:{" "}
                  <span className="text-lime font-bold">{plan.fresh} new</span>
                  {plan.already > 0 && (
                    <>
                      , <span className="text-muted">{plan.already} already in the league</span>{" "}
                      {overwrite ? "(will be replaced)" : "(will be skipped)"}
                    </>
                  )}
                  .
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(plan.perGame)
                    .sort((a, b) => b[1] - a[1])
                    .map(([slug, n]) => (
                      <span
                        key={slug}
                        style={{ backgroundColor: GAMES[slug as keyof typeof GAMES]?.color ?? "#2A2A27" }}
                        className="px-2.5 py-1 rounded-full text-[12px] font-bold text-[#121212]"
                      >
                        {GAMES[slug as keyof typeof GAMES]?.name ?? slug} {n}
                      </span>
                    ))}
                </div>
                {unrecognised.length > 0 && (
                  <div className="text-[12px] text-orange">
                    Not imported, games Fatherdle doesn&apos;t know:{" "}
                    {unrecognised.map(([name, n]) => `${name} ×${n}`).join(", ")}.
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                Replace results that are already in the league
              </label>

              <button
                type="button"
                disabled={busy || plan.items.length === 0}
                onClick={runImport}
                className="h-12 px-7 rounded-full bg-lime text-[#121212] text-[14px] font-extrabold disabled:opacity-40"
              >
                {busy ? "Importing…" : `Import ${overwrite ? plan.items.length : plan.fresh} results`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
