"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ClipboardPaste, CheckCircle2, AlertCircle, X } from "lucide-react";
import { parseMultiGamePaste } from "@/lib/parsers";
import { GAMES } from "@/lib/constants";
import { Player } from "@/lib/types";

export function PasteResultModal({
  isOpen,
  onClose,
  players,
  activePlayerId,
  defaultDate,
  onSubmitted,
}: {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  activePlayerId: string;
  defaultDate: string;
  onSubmitted: () => void;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(activePlayerId);
  const [leagueDate, setLeagueDate] = useState(defaultDate);
  const [rawText, setRawText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Re-sync whenever the modal opens so it reflects the current identity and date.
  useEffect(() => {
    if (isOpen) {
      setSelectedPlayerId(activePlayerId || players[0]?.id || "");
      setLeagueDate(defaultDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activePlayerId, defaultDate]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const preview = useMemo(() => parseMultiGamePaste(rawText), [rawText]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview.parsed.length === 0) {
      setErrorMsg("Paste at least one recognisable game share text.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/league", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "paste",
          playerId: selectedPlayerId,
          leagueDate,
          rawPaste: rawText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to save results.");
      } else {
        setSuccessMsg(
          `Saved ${data.savedCount} ${data.savedCount === 1 ? "result" : "results"}.`
        );
        onSubmitted();
        setTimeout(() => {
          setSuccessMsg(null);
          setRawText("");
          onClose();
        }, 700);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pasteFromClipboard = async () => {
    setErrorMsg(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setErrorMsg("The clipboard is empty. Copy a result first.");
        return;
      }
      // Several games can be pasted one after another
      setRawText((prev) => (prev.trim() ? `${prev.trim()}\n\n${text.trim()}` : text.trim()));
    } catch {
      setErrorMsg("Couldn't read the clipboard. Tap and hold in the box below and choose Paste.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-line rounded-[24px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line/60">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-lime" />
            <h2 className="text-[19px] font-extrabold tracking-tight text-text">
              Paste results
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Multi-game textarea */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-[12px] font-bold text-text">Share text</label>
              <div className="flex items-center gap-2">
                {rawText && (
                  <button
                    type="button"
                    onClick={() => setRawText("")}
                    className="text-[12px] font-bold text-muted hover:text-text px-2 py-1"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={pasteFromClipboard}
                  className="inline-flex items-center gap-1.5 rounded-full bg-lime text-[#121212] px-4 py-2 text-[13px] font-extrabold"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Paste</span>
                </button>
              </div>
            </div>
            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Paste your copied share text from Wordle, MapTap, Krillion, Noillirk, Huedle, Flagle, Catfishing, Poople, Wordishingrilliontapdle, Metrodle, Connections, or Strands...\n\nYou can paste several games in this box at once — Fatherdle splits and identifies them automatically.`}
              className="w-full bg-bg border border-line rounded-2xl p-4 text-[13px] font-mono text-text placeholder:text-muted/60 focus:outline-none focus:border-lime resize-y"
            />
          </div>

          {/* Player & Date selector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Player
              </label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-surface2 border border-line rounded-xl px-3.5 py-2.5 text-sm font-bold text-text focus:outline-none focus:border-lime"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Date (London)
              </label>
              <input
                type="date"
                value={leagueDate}
                max={defaultDate}
                onChange={(e) => setLeagueDate(e.target.value)}
                className="block w-full min-w-0 max-w-full bg-surface2 border border-line rounded-xl px-3.5 py-2.5 text-sm font-bold text-text focus:outline-none focus:border-lime"
              />
            </div>
          </div>

          {/* Live Detection Preview */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Detected games ({preview.parsed.length})
              </span>
              {preview.unrecognisedBlocks.length > 0 && (
                <span className="text-[11px] text-orange font-semibold">
                  {preview.unrecognisedBlocks.length} unrecognised block(s)
                </span>
              )}
            </div>

            {preview.parsed.length === 0 ? (
              <div className="bg-bg/60 border border-line/50 rounded-xl p-4 text-[12px] text-muted">
                Supports: <strong className="text-text">Wordle</strong>,{" "}
                <strong className="text-text">MapTap</strong>,{" "}
                <strong className="text-text">Krillion</strong>,{" "}
                <strong className="text-text">Noillirk</strong>,{" "}
                <strong className="text-text">Huedle</strong>,{" "}
                <strong className="text-text">Flagle</strong>,{" "}
                <strong className="text-text">Catfishing</strong>,{" "}
                <strong className="text-text">Poople</strong>,{" "}
                <strong className="text-text">Wordishingrilliontapdle</strong>,{" "}
                <strong className="text-text">Metrodle</strong>,{" "}
                <strong className="text-text">Connections</strong>, and{" "}
                <strong className="text-text">Strands</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {preview.parsed.map((item, idx) => {
                  const g = GAMES[item.gameSlug];
                  return (
                    <div
                      key={`${item.gameSlug}_${idx}`}
                      className="bg-surface2 border border-line/70 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-6 rounded-full shrink-0"
                          style={{ backgroundColor: g.color }}
                        />
                        <div className="truncate">
                          <div className="text-[13px] font-bold text-text flex items-center gap-1.5">
                            <span>{g.name}</span>
                            {item.puzzleId && (
                              <span className="text-[11px] font-medium text-muted">
                                {item.puzzleId}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted">
                            {g.rankingDirection === "lower"
                              ? "Lower is better"
                              : "Higher is better"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-serif text-[22px] leading-none text-lime">
                          {item.displayResult}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="bg-orange/15 border border-orange text-orange rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-lime/15 border border-lime text-lime rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-surface border-t border-line/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full border border-line text-sm font-bold text-text hover:bg-surface2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || preview.parsed.length === 0}
              className="px-6 py-2.5 rounded-full bg-lime text-[#121212] text-sm font-bold flex items-center gap-2 hover:brightness-95 disabled:opacity-40 transition-all"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? "Saving..."
                  : `Submit ${preview.parsed.length || ""} ${
                      preview.parsed.length === 1 ? "result" : "results"
                    }`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
