"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GroupStats } from "@/lib/analytics/group-stats";
import { GAMES } from "@/lib/constants";
import type { GameSlug } from "@/lib/types";
import { CountUp, GameIcon } from "./ui";


function Panel({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface rounded-[22px] p-5 md:p-6 space-y-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[18px] md:text-[19px] font-bold">{title}</h3>
        {note && <span className="text-[12px] text-muted text-right">{note}</span>}
      </div>
      {children}
    </div>
  );
}

type Card = {
  lead: string;
  big: React.ReactNode;
  rest?: string;
  sub?: string;
  split?: boolean;
};

/** Statistics is group only (HANDOVER §4): a rotating stat deck, then group panels. */
export function StatsDeck({ stats }: { stats: GroupStats }) {
  const kicker = `THE GROUP · ${stats.periodLabel.toUpperCase()}`;
  const cards: Card[] = [];
  const lead = stats.weeksLed[0];
  if (lead) {
    const next = stats.weeksLed[1];
    cards.push({
      lead: `${lead.name} has led the league for`,
      big: <CountUp value={lead.weeks} />,
      rest: `of ${stats.weeksTotal} ${stats.weeksTotal === 1 ? "week" : "weeks"}`,
      sub: next ? `${next.name} is next with ${next.weeks}.` : "Nobody else has won a week yet.",
      split: true,
    });
  }
  cards.push({
    lead: "Results posted",
    big: <CountUp value={stats.totalResults} />,
    rest: "results",
    sub: `across ${stats.activeDays} ${stats.activeDays === 1 ? "day" : "days"} of play.`,
  });
  if (stats.qualificationRate !== null) {
    cards.push({
      lead: "Games that counted",
      big: (
        <>
          <CountUp value={Math.round(stats.qualificationRate * 100)} />%
        </>
      ),
      rest: "qualified",
      sub: `${stats.qualifiedGameDays} of ${stats.gameDays} game-days reached half the active players.`,
    });
  }
  if (stats.records.closestFinish) {
    cards.push({
      lead: "Closest league finish",
      big: stats.records.closestFinish.label.replace(" pts", ""),
      rest: "points",
      sub: stats.records.closestFinish.detail,
    });
  }

  const [i, setI] = useState(0);
  const n = cards.length;
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 7000);
    return () => clearInterval(t);
  }, [n]);
  const card = cards[i % n];

  const most = stats.mostPlayed.slice(0, 7);
  const maxGame = Math.max(1, ...most.map((g) => g.count));
  const cleanOn = stats.cleanSolves ? Math.round((stats.cleanSolves.pct / 100) * 90) : 0;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_416px] gap-4 md:gap-5">
        {/* Stat deck */}
        <div className="relative bg-lime text-[#121212] rounded-[24px] p-5 md:p-7 min-h-[250px] md:min-h-[424px] overflow-hidden flex flex-col">
          <div
            aria-hidden
            className="absolute -right-10 bottom-6 w-[150px] h-[170px] md:w-[180px] md:h-[200px] rounded-[28px] bg-[#121212]/[0.06] rotate-[-12deg]"
          />
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-[11px] md:text-[13px] font-bold tracking-[1.6px]">
              {kicker} · CARD {(i % n) + 1} OF {n}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous card" onClick={() => setI((v) => (v - 1 + n) % n)} className="tap w-7 h-7 rounded-full bg-[#121212]/15 flex items-center justify-center">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {cards.map((_, k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={`Card ${k + 1}`}
                    onClick={() => setI(k)}
                    className={`h-2 rounded-full transition-all duration-300 ${k === i % n ? "w-6 bg-[#121212]" : "w-2 bg-[#121212]/25"}`}
                  />
                ))}
              </div>
              <button type="button" aria-label="Next card" onClick={() => setI((v) => (v + 1) % n)} className="tap w-7 h-7 rounded-full bg-[#121212] text-lime flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          {card && (
            <div key={i} className="relative flex-1 flex flex-col animate-[deckin_420ms_cubic-bezier(0.22,1,0.36,1)]">
              <div className="text-[16px] md:text-[22px] font-semibold mt-4 md:mt-14 opacity-80">{card.lead}</div>
              <div className="flex items-end gap-3 md:gap-4 mt-1 md:mt-3">
                <span className="font-serif text-[88px] md:text-[136px] leading-[0.85] tracking-[-3px]">{card.big}</span>
                <div className="pb-2 md:pb-4 min-w-0">
                  {card.rest && <div className="text-[22px] md:text-[32px] font-bold tracking-[-0.5px] leading-tight">{card.rest}</div>}
                  {card.sub && <div className="text-[12px] md:text-[14px] opacity-70 mt-0.5">{card.sub}</div>}
                </div>
              </div>
              {card.split && (
                <div className="grid grid-cols-3 gap-2 md:gap-3 mt-4 md:mt-6">
                  {(
                    [
                      ["LONGEST RUN", stats.highlights.longestRun],
                      ["LEAD CHANGES", stats.highlights.leadChanges],
                      ["AVG MARGIN", stats.highlights.avgMargin],
                    ] as const
                  ).map(([lab, h]) => (
                    <div key={lab} className="rounded-[12px] bg-[#121212]/10 px-3 py-2.5">
                      <div className="text-[9px] md:text-[10px] font-bold tracking-[1.4px] opacity-60">{lab}</div>
                      <div className="text-[16px] md:text-[20px] font-bold leading-tight mt-0.5">{h?.label ?? "–"}</div>
                      <div className="hidden md:block text-[11px] opacity-60 truncate">{h?.detail ?? ""}</div>
                    </div>
                  ))}
                </div>
              )}
              {card.split && stats.weeksLed.length > 0 && (
                <div className="mt-auto pt-5">
                  <div className="hidden md:block text-[11px] font-bold tracking-[1.6px] mb-2">WEEKS WON</div>
                  <div className="flex h-8 gap-[4px]">
                    {stats.weeksLed.map((w, k) => (
                      <div
                        key={w.playerId}
                        title={`${w.name}: ${w.weeks}`}
                        style={{
                          flex: w.weeks,
                          backgroundColor: k === 0 ? "#121212" : w.color,
                          color: k === 0 ? "#E6EB5E" : "#121212",
                        }}
                        className="grow-in rounded-[8px] text-[12px] md:text-[13px] font-bold flex items-center justify-center px-2 min-w-[28px] truncate"
                      >
                        {w.weeks >= 3 || k === 0 ? w.name : w.weeks}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right of the deck: stats that work even on Today or early in the week */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 content-start">
          <div className="stat-tile bg-orange text-[#121212] rounded-[22px] p-4 md:p-5 min-h-[118px] md:min-h-[204px] flex flex-col">
            <div className="text-[12px] md:text-[13px] font-semibold md:font-bold md:tracking-[1.4px] md:uppercase">Tightest win</div>
            <div className="stat-num font-serif text-[48px] md:text-[84px] leading-[0.9] mt-2 md:mt-4 break-words">{stats.tightestWin?.value ?? "–"}</div>
            <div className="text-[12px] md:text-[13px] font-semibold mt-auto pt-2">{stats.tightestWin?.caption ?? "Needs a few results"}</div>
          </div>
          <div className="stat-tile bg-sky text-[#121212] rounded-[22px] p-4 md:p-5 min-h-[118px] md:min-h-[204px] flex flex-col">
            <div className="text-[12px] md:text-[13px] font-semibold md:font-bold md:tracking-[1.4px] md:uppercase">Upset share</div>
            <div className="stat-num font-serif text-[56px] md:text-[96px] leading-[0.9] mt-2 md:mt-4">
              {stats.upsetShare ? `${stats.upsetShare.pct}%` : "–"}
            </div>
            <div className="text-[12px] md:text-[13px] font-semibold mt-auto pt-2">{stats.upsetShare?.caption ?? "won by non-leader"}</div>
          </div>
          <div className="hidden md:block col-span-2 bg-surface rounded-[22px] p-5 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted">Clean solves</div>
                <div className="text-[13px] text-muted">zero-mistake or 1-guess hits</div>
              </div>
              <div className="font-serif text-[64px] leading-none text-teal">{stats.cleanSolves ? `${stats.cleanSolves.pct}%` : "–"}</div>
            </div>
            <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[4px]">
              {Array.from({ length: 90 }, (_, k) => (
                <span key={k} className={`aspect-square rounded-[2px] ${k < cleanOn ? "bg-teal" : "bg-surface2"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 md:gap-5">
        <Panel title="Most played" note={`Results posted per game · ${stats.periodLabel.toLowerCase()}`}>
          <div className="space-y-3">
            {most.map((g) => (
              <div key={g.slug} className="flex items-center gap-3">
                <GameIcon slug={g.slug} size={22} />
                <span className="w-[86px] md:w-[110px] text-[13px] md:text-[14px] truncate">{g.name}</span>
                <div className="flex-1 h-5 md:h-6 bg-surface2 rounded-[6px] overflow-hidden">
                  <div
                    style={{ width: `${(g.count / maxGame) * 100}%`, backgroundColor: GAMES[g.slug as GameSlug]?.color ?? "#E6EB5E" }}
                    className="h-full rounded-[6px] grow-in"
                  />
                </div>
                <span className="w-9 text-right text-[13px] font-bold tabular-nums">{g.count}</span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="bg-orange text-[#121212] rounded-[22px] p-5 md:p-6 flex flex-col gap-5 min-h-[260px]">
          <div className="text-[15px] md:text-[16px] font-semibold opacity-80">Clean sweeps &amp; aces</div>
          <div className="space-y-2.5 md:mt-4">
            {stats.sweeps.lines.length === 0 && <div className="text-[13px] opacity-70">No clean solves yet</div>}
            {stats.sweeps.lines.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-3 text-[13px] md:text-[14px]">
                <span className="font-semibold">{l.label}</span>
                <span className="whitespace-nowrap font-semibold">
                  {l.who} · {l.pct}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-auto">
            <div className="font-serif text-[56px] md:text-[72px] leading-none">
              <CountUp value={stats.sweeps.flawless} />
            </div>
            <div className="text-[13px] opacity-75 mt-1">flawless solves across all players</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 md:gap-5">
        <Panel title="Who plays when" note="Median submission time · 6am to midnight">
          <div className="space-y-3.5">
            {stats.whenPlays.length === 0 && <div className="text-[13px] text-muted">Not enough results yet</div>}
            {stats.whenPlays.map((p) => {
              const pos = (h: number) => `${Math.max(0, Math.min(100, ((h - 6) / 18) * 100))}%`;
              const t = (h: number) => {
                const hh = Math.floor(h) % 24;
                const mm = Math.round((h - Math.floor(h)) * 60);
                const ap = hh >= 12 ? "pm" : "am";
                return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${ap}`;
              };
              const left = Math.max(0, (Math.max(6, p.lo) - 6) / 18) * 100;
              const width = Math.max(3, ((Math.min(24, p.hi) - Math.max(6, p.lo)) / 18) * 100);
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-12 md:w-14 text-[13px] md:text-[14px] font-semibold truncate">{p.name}</span>
                  <div className="relative flex-1 h-[6px] rounded-full bg-surface2">
                    <span style={{ left: `${left}%`, width: `${width}%`, backgroundColor: p.color }} className="absolute top-0 h-full rounded-full opacity-45" />
                    <span style={{ left: pos(p.median), backgroundColor: p.color }} className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full" />
                  </div>
                  <span className="w-[62px] text-right text-[12px] md:text-[13px] font-bold tabular-nums">{t(p.median)}</span>
                  <span className="hidden md:inline w-[96px] text-[12px] text-muted">{p.tag}</span>
                </div>
              );
            })}
            <div className="flex justify-between text-[10px] md:text-[11px] text-muted pt-1 md:pr-[168px] md:pl-[68px]">
              {["6am", "9am", "12pm", "3pm", "6pm", "9pm", "12am"].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Most consistent" note="Narrowest score spread">
          <div className="space-y-3.5">
            {stats.consistent.length === 0 && <div className="text-[13px] text-muted">Needs a few more days of play</div>}
            {stats.consistent.map((p) => {
              const maxSpread = Math.max(1, ...stats.consistent.map((x) => x.spread));
              const w = 30 + (p.spread / maxSpread) * 55;
              const l = 50 - w / 2;
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-12 md:w-14 text-[13px] md:text-[14px] font-semibold truncate">{p.name}</span>
                  <div className="relative flex-1 h-[6px] rounded-full bg-surface2">
                    <span style={{ left: `${l}%`, width: `${w}%`, backgroundColor: p.color }} className="absolute top-0 h-full rounded-full" />
                  </div>
                  <span className="w-10 text-right text-[12px] text-muted tabular-nums">±{p.spread}%</span>
                </div>
              );
            })}
          </div>
          <div className="text-[12px] text-muted pt-1">{stats.consistentNote}</div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {(
          [
            ["closest league finish", stats.records.closestFinish, "bg-lime text-[#121212]", ""],
            ["most tied at 1st", stats.moreRecords.mostTied, "bg-surface2 text-text", "hidden md:flex"],
            ["biggest upset", stats.moreRecords.biggestUpset, "bg-violet text-[#121212]", "hidden md:flex"],
            ["everyone finished", stats.records.longestRun, "bg-sky text-[#121212]", ""],
          ] as const
        ).map(([label, rec, colours, vis]) => (
          <div key={label} className={`${colours} ${vis || "flex"} flex-col rounded-[22px] p-4 md:p-5 min-h-[96px] md:min-h-[168px]`}>
            <div className="text-[12px] md:text-[14px] opacity-75">{label}</div>
            <div className="mt-auto">
              <div className="font-serif text-[34px] md:text-[44px] leading-none mt-2 break-words">{rec?.label ?? "–"}</div>
              <div className="hidden md:block text-[12px] opacity-75 mt-2">{rec?.detail ?? "Not enough data yet"}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 md:gap-5">
        <Panel title="Who shows up" note="Share of days with a result">
          <div className="space-y-3">
            {stats.participation.map((p) => {
              const cells = 16;
              const on = Math.round(p.rate * cells);
              return (
                <div key={p.playerId} className="flex items-center gap-3">
                  <span
                    style={{ backgroundColor: p.color }}
                    className="w-6 h-6 md:w-7 md:h-7 rounded-full text-[#121212] text-[11px] md:text-[12px] font-bold flex items-center justify-center shrink-0"
                  >
                    {p.initials}
                  </span>
                  <span className="w-14 md:w-20 text-[13px] md:text-[14px] truncate">{p.name}</span>
                  <div className="flex-1 grid gap-[3px] md:gap-[5px]" style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}>
                    {Array.from({ length: cells }, (_, k) => (
                      <span
                        key={k}
                        style={k < on ? { backgroundColor: p.color } : undefined}
                        className={`h-[10px] md:h-[14px] rounded-[3px] ${k < on ? "" : "bg-surface2"}`}
                      />
                    ))}
                  </div>
                  <span className="w-10 text-right text-[12px] md:text-[13px] font-bold tabular-nums">{Math.round(p.rate * 100)}%</span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Closest rivalries" note="Head-to-head days">
          <div className="space-y-5">
            {stats.rivalries.length === 0 && <div className="text-[13px] text-muted">Needs a few more shared days</div>}
            {stats.rivalries.map((r) => {
              const total = Math.max(1, r.a + r.b);
              return (
                <div key={r.aName + r.bName + r.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px] font-semibold">
                    <span>
                      {r.aName} {r.a}
                    </span>
                    <span className="text-[11px] text-muted font-normal">{r.label}</span>
                    <span>
                      {r.b} {r.bName}
                    </span>
                  </div>
                  <div className="flex h-[6px] gap-[3px]">
                    <span style={{ flex: total ? r.a / total : 1, backgroundColor: r.aColor }} className="rounded-full" />
                    <span style={{ flex: total ? r.b / total : 1, backgroundColor: r.bColor }} className="rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
