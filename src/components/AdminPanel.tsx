"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChatImport } from "@/components/ChatImport";

interface AdminPlayer {
  id: string;
  slug: string;
  name: string;
  color: string;
  avatarInitials: string;
  joinedAt: string;
  submissions: number;
}

const COLORS = [
  "#E6EB5E",
  "#FF8A3D",
  "#E3CDBE",
  "#6FA8DC",
  "#8A8C45",
  "#F2A7C3",
  "#5CC8B0",
  "#B79CF5",
  "#B8794F",
];

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export function AdminPanel({
  onChanged,
  onAuthChange,
}: {
  onChanged: () => void;
  onAuthChange: (authed: boolean) => void;
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [password, setPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback(
    (json: { authed?: boolean; players?: AdminPlayer[] }) => {
      if (json.authed === false) {
        setAuthed(false);
        onAuthChange(false);
        return;
      }
      if (json.players) {
        setAuthed(true);
        onAuthChange(true);
        setPlayers(json.players);
        setNames(Object.fromEntries(json.players.map((p) => [p.id, p.name])));
      }
    },
    [onAuthChange]
  );

  useEffect(() => {
    fetch("/api/admin")
      .then((r) => r.json())
      .then(apply)
      .catch(() => setAuthed(false));
  }, [apply]);

  const run = async (body: Record<string, unknown>, success: string | ((j: any) => string)) => {
    setBusy(true);
    setMessage(null);
    try {
      const json = await call(body);
      apply(json);
      setMessage({ kind: "ok", text: typeof success === "function" ? success(json) : success });
      onChanged();
      return true;
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      apply(await call({ action: "login", password }));
      setPassword("");
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Login failed." });
    } finally {
      setBusy(false);
    }
  };

  if (authed === null) {
    return <div className="text-muted text-sm py-10">Loading…</div>;
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto py-10 space-y-5">
        <h1 className="text-[40px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">Admin</h1>
        <form onSubmit={login} className="space-y-3">
          <label className="block text-xs font-bold text-muted uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-base font-bold text-text focus:outline-none focus:border-lime"
          />
          {message && <p className="text-sm text-orange">{message.text}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full h-12 rounded-full bg-lime text-[#121212] text-[15px] font-extrabold disabled:opacity-50"
          >
            Log in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[40px] md:text-[56px] font-bold tracking-[-1.5px] leading-none">
          Admin
        </h1>
        <button
          type="button"
          onClick={async () => {
            await call({ action: "logout" });
            apply({ authed: false });
          }}
          className="px-4 py-2 rounded-full border border-line text-xs font-bold hover:bg-surface"
        >
          Log out
        </button>
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

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run({ action: "add", name: newName }, `Added ${newName.trim()}.`)) setNewName("");
        }}
        className="bg-surface border border-line/50 rounded-[22px] p-5 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
            Add a player
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="First name"
            maxLength={24}
            className="w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-base font-bold text-text focus:outline-none focus:border-lime"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="h-12 px-6 rounded-full bg-lime text-[#121212] text-[14px] font-extrabold disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ChatImport
        players={players}
        onImported={() => {
          fetch("/api/admin")
            .then((r) => r.json())
            .then(apply)
            .catch(() => undefined);
          onChanged();
        }}
      />

      <div className="bg-surface border border-line/50 rounded-[22px] divide-y divide-line/50">
        {players.map((p) => {
          const others = players.filter((o) => o.id !== p.id);
          const target = mergeTarget[p.id] ?? others[0]?.id ?? "";
          const nameChanged = (names[p.id] ?? p.name).trim() !== p.name;
          return (
            <div key={p.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span style={{ backgroundColor: p.color }} className="w-3 h-3 rounded-full shrink-0" />
                <input
                  value={names[p.id] ?? p.name}
                  onChange={(e) => setNames((n) => ({ ...n, [p.id]: e.target.value }))}
                  maxLength={24}
                  aria-label={`Name for ${p.name}`}
                  className="bg-surface2 border border-line rounded-xl px-3 py-2 text-base font-bold text-text w-[180px] focus:outline-none focus:border-lime"
                />
                <button
                  type="button"
                  disabled={busy || !nameChanged}
                  onClick={() =>
                    run(
                      { action: "update", playerId: p.id, name: names[p.id] },
                      `Renamed ${p.name} to ${(names[p.id] || "").trim()}.`
                    )
                  }
                  className="px-4 py-2 rounded-full bg-lime text-[#121212] text-xs font-extrabold disabled:opacity-40"
                >
                  Save name
                </button>
                <span className="text-xs text-muted ml-auto">
                  {p.submissions} result{p.submissions === 1 ? "" : "s"} · joined {p.joinedAt}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    disabled={busy}
                    onClick={() =>
                      run({ action: "update", playerId: p.id, color: c }, `Changed ${p.name}'s colour.`)
                    }
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full ${
                      c.toLowerCase() === p.color.toLowerCase()
                        ? "ring-2 ring-text ring-offset-2 ring-offset-surface"
                        : ""
                    }`}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {others.length > 0 && (
                  <>
                    <span className="text-xs text-muted">Merge into</span>
                    <select
                      value={target}
                      onChange={(e) => setMergeTarget((m) => ({ ...m, [p.id]: e.target.value }))}
                      className="bg-surface2 border border-line rounded-xl px-3 py-2 text-sm font-bold text-text"
                    >
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy || !target}
                      onClick={() => {
                        const t = players.find((o) => o.id === target);
                        if (
                          !t ||
                          !window.confirm(
                            `Merge ${p.name} into ${t.name}? ${p.name}'s ${p.submissions} result(s) move to ${t.name} and ${p.name} is deleted. If both have the same game on the same day, ${t.name}'s result is kept.`
                          )
                        )
                          return;
                        run(
                          { action: "merge", sourceId: p.id, targetId: target },
                          (j) =>
                            `Merged ${p.name} into ${t.name}: ${j.moved} moved, ${j.dropped} duplicate${
                              j.dropped === 1 ? "" : "s"
                            } dropped.`
                        );
                      }}
                      className="px-4 py-2 rounded-full border border-line text-xs font-bold hover:bg-surface2"
                    >
                      Merge
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Remove ${p.name}? This permanently deletes ${p.name} and their ${p.submissions} result(s).`
                      )
                    )
                      return;
                    run(
                      { action: "remove", playerId: p.id },
                      (j) => `Removed ${p.name} and ${j.removedSubmissions} result(s).`
                    );
                  }}
                  className="ml-auto px-4 py-2 rounded-full border border-orange/60 text-orange text-xs font-bold hover:bg-orange/10"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        {players.length === 0 && <div className="p-5 text-sm text-muted">No players yet.</div>}
      </div>
    </div>
  );
}
