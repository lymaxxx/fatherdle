"use client";

import { useEffect, useState } from "react";
import type { GroupStats } from "@/lib/analytics/group-stats";
import { GAMES } from "@/lib/constants";
import type { GameSlug } from "@/lib/types";
import { ColumnChart, CountUp, GameIcon } from "./ui";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

  const peakWd = stats.resultsByWeekday.indexOf(Math.max(...stats.resultsByWeekday));
  const most = stats.mostPlayed.slice(0, 7);
  const maxGame = Math.max(1, ...most.map((g) => g.count));
  const leads = stats.leadChangesPerWeek.slice(-9);
  const peakLead = leads.reduce((best, w, k) => (w.value > leads[best].value ? k : best), 0);
  const partPct = stats.participationOverall === null ? null : Math.round(stats.participationOverall * 100);
  const qualPills = 50;
  const qualOn = stats.qualificationRate === null ? 0 : Math.round(stats.qualificationRate * qualPills);
  const waffleOn = partPct === null ? 0 : Math.round((partPct / 100) * 60);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_416px] gap-4 md:gap-5">
        {/* Stat deck */}
        <div className="relative bg-lime text-[#121212] rounded-[24px] p-5 md:p-7 min-h-[250px] md:min-h-[424px] overflow-hidden flex flex-col">
          <div
            aria-hidden
            className="absolute -right-10 bottom-6 w-[150px] h-[170px] md:w-[180px] md:h-[200px] rounded-[28px] bg-[#121212]/[0.06] rotate-[-12deg]"
          />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] md:text-[13px] font-bold tracking-[1.6px]">{kicker}</span>
            <div className="flex items-center gap-1.5">
              {cards.map((_, k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={`Card ${k + 1}`}
                  onClick={() => setI(k)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    k === i % n ? "w-6 bg-[#121212]" : "w-2 bg-[#121212]/25"
                  }`}
                />
              ))}
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

        {/* Right of the deck */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 content-start">
          <div className="stat-tile bg-orange text-[#121212] rounded-[22px] p-4 md:p-5 min-h-[118px] md:min-h-[204px] flex flex-col">
            <div className="text-[12px] md:text-[13px] font-semibold md:font-bold md:tracking-[1.4px] md:uppercase">Busiest day</div>
            <div className="stat-num font-serif text-[56px] md:text-[96px] leading-[0.9] mt-2 md:mt-4">
              {stats.busiestWeekday?.label ?? "–"}
            </div>
            <div className="hidden md:block text-[13px] font-semibold mt-auto">
              {stats.busiestWeekday ? `${stats.busiestWeekday.count.toLocaleString("en-GB")} results` : ""}
            </div>
          </div>
          <div className="stat-tile bg-sky text-[#121212] rounded-[22px] p-4 md:p-5 min-h-[118px] md:min-h-[204px] flex flex-col">
            <div className="text-[12px] md:text-[13px] font-semibold md:font-bold md:tracking-[1.4px] md:uppercase">Peak hour</div>
            <div className="stat-num font-serif text-[56px] md:text-[96px] leading-[0.9] mt-2 md:mt-4">{stats.peakHour?.label ?? "–"}</div>
            <div className="hidden md:block text-[13px] font-semibold mt-auto">
              {stats.peakHour ? `${stats.peakHour.count.toLocaleString("en-GB")} results posted then` : ""}
            </div>
          </div>
          <div className="hidden md:block col-span-2 bg-surface rounded-[22px] p-5 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted">Participation</div>
                <div className="text-[13px] text-muted">of possible game-days played</div>
              </div>
              <div className="font-serif text-[64px] leading-none text-teal">{partPct === null ? "–" : `${partPct}%`}</div>
            </div>
            <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[4px]">
              {Array.from({ length: 60 }, (_, k) => (
                <span key={k} className={`aspect-square rounded-[3px] ${k < waffleOn ? "bg-teal" : "bg-surface2"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 md:gap-5">
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
        <div className="bg-orange text-[#121212] rounded-[22px] p-5 md:p-6 flex flex-col gap-5">
          <div className="text-[15px] md:text-[16px] font-semibold opacity-80">Games that qualified</div>
          <div className="grid grid-cols-10 gap-x-1.5 gap-y-1.5 md:mt-4">
            {Array.from({ length: qualPills }, (_, k) => (
              <span key={k} className={`h-[12px] md:h-[16px] rounded-full ${k < qualOn ? "bg-[#121212]" : "bg-[#121212]/15"}`} />
            ))}
          </div>
          <div className="mt-auto">
            <div className="font-serif text-[64px] md:text-[80px] leading-none">
              {stats.qualificationRate === null ? "–" : <><CountUp value={Math.round(stats.qualificationRate * 100)} />%</>}
            </div>
            <div className="text-[13px] opacity-75 mt-1">of games reach half the active players</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 md:gap-5">
        <Panel title="When everyone plays" note="Results by weekday, all players">
          <div className="md:hidden">
            <ColumnChart
              height={170}
              showValues={false}
              radius={6}
              bars={stats.resultsByWeekday.map((v, k) => ({ label: WD[k][0], value: v, color: k === peakWd ? "#E6EB5E" : "#2A2A27" }))}
            />
          </div>
          <div className="hidden md:block">
            <ColumnChart
              height={210}
              gap={12}
              radius={6}
              labelClass="text-[12px] text-muted"
              bars={stats.resultsByWeekday.map((v, k) => ({
                label: WD[k],
                value: v,
                color: k === peakWd ? "#E6EB5E" : "#2A2A27",
                valueClass: k === peakWd ? "text-lime" : "text-muted",
              }))}
            />
          </div>
        </Panel>
        <Panel title="Lead changes" note="Per league week" className="hidden md:block">
          {leads.length === 0 ? (
            <span className="text-muted text-[13px]">No weeks yet</span>
          ) : (
            <ColumnChart
              height={210}
              showValues={false}
              radius={6}
              labelClass="text-[12px] text-muted"
              bars={leads.map((w, k) => ({
                label: w.value,
                value: w.value,
                title: w.label,
                color: k === peakLead && w.value > 0 ? "#FF8A3D" : "#2A2A27",
              }))}
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {(
          [
            ["closest league finish", stats.records.closestFinish, "bg-lime text-[#121212]", ""],
            ["biggest blowout", stats.records.biggestBlowout, "bg-surface2 text-text", "hidden md:flex"],
            ["hardest day", stats.records.hardestDay, "bg-violet text-[#121212]", "hidden md:flex"],
            ["everyone played", stats.records.longestRun, "bg-sky text-[#121212]", ""],
          ] as const
        ).map(([label, rec, colours, vis]) => (
          <div key={label} className={`stat-tile ${colours} ${vis || "flex"} flex-col rounded-[22px] p-4 md:p-5 min-h-[96px] md:min-h-[256px]`}>
            <div className="text-[12px] md:text-[14px] opacity-75">{label}</div>
            <div className="mt-auto">
              <div className="stat-num font-serif text-[36px] md:text-[56px] leading-none mt-2">{rec?.label ?? "–"}</div>
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
        <Panel title="Group records" note={stats.periodLabel}>
          <div className="divide-y divide-line/70">
            {stats.groupRecords.length === 0 && <div className="text-[13px] text-muted">Not enough data yet</div>}
            {stats.groupRecords.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{r.label}</div>
                  <div className="text-[12px] text-muted truncate">{r.who}</div>
                </div>
                <div className="font-serif text-[34px] leading-none">{r.value}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
