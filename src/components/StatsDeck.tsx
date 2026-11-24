"use client";

import { useEffect, useState } from "react";
import type { GroupStats } from "@/lib/analytics/group-stats";
import { CountUp, GameIcon } from "./ui";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded-[24px] p-5 space-y-3 ${className}`}>
      <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">{title}</div>
      {children}
    </div>
  );
}

export function StatsDeck({ stats }: { stats: GroupStats }) {
  const cards: Array<{ kicker: string; big: React.ReactNode; caption: string; split?: boolean }> = [];
  const lead = stats.weeksLed[0];
  if (lead) {
    cards.push({
      kicker: "Led the league most weeks",
      big: <>{lead.name}</>,
      caption: `${lead.weeks} of ${stats.weeksTotal} weeks won`,
      split: true,
    });
  }
  cards.push({ kicker: "Results posted", big: <CountUp value={stats.totalResults} />, caption: `across ${stats.activeDays} days` });
  if (stats.qualificationRate !== null) {
    cards.push({
      kicker: "Games that counted",
      big: <><CountUp value={Math.round(stats.qualificationRate * 100)} />%</>,
      caption: "of game-days reached half the active players",
    });
  }
  if (stats.records.closestFinish) {
    cards.push({ kicker: "Closest finish", big: <>{stats.records.closestFinish.label}</>, caption: stats.records.closestFinish.detail });
  }
  const [i, setI] = useState(0);
  const n = cards.length || 1;
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 6000);
    return () => clearInterval(t);
  }, [n]);
  const card = cards[i % n];
  const next = cards[(i + 1) % n];
  const maxWd = Math.max(1, ...stats.resultsByWeekday);
  const maxGame = Math.max(1, ...stats.mostPlayed.map((g) => g.count));
  const maxLead = Math.max(1, ...stats.leadChangesPerWeek.map((w) => w.value));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6">
        {/* Deck */}
        <div className="relative bg-cream text-[#121212] rounded-[28px] p-7 min-h-[300px] overflow-hidden flex flex-col justify-between">
          {card && (
            <div key={i} className="space-y-3 animate-[deckin_400ms_cubic-bezier(0.22,1,0.36,1)]">
              <div className="text-[12px] font-bold uppercase tracking-[1.5px] opacity-60">{card.kicker}</div>
              <div className="font-serif text-[88px] leading-[88px] tracking-[-2px] break-words">{card.big}</div>
              <div className="text-[15px] font-semibold opacity-70">{card.caption}</div>
              {card.split && stats.weeksLed.length > 0 && (
                <div className="flex h-9 rounded-full overflow-hidden gap-[3px] pt-2">
                  {stats.weeksLed.map((w) => (
                    <div
                      key={w.playerId}
                      title={`${w.name}: ${w.weeks}`}
                      style={{ flex: w.weeks, backgroundColor: w.color }}
                      className="grow-in rounded-full text-[12px] font-bold flex items-center px-3 truncate"
                    >
                      {w.name} {w.weeks}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 pt-5">
            {cards.map((_, k) => (
              <button
                key={k}
                aria-label={`Card ${k + 1}`}
                onClick={() => setI(k)}
                className={`h-2 rounded-full transition-all ${k === i % n ? "w-6 bg-[#121212]" : "w-2 bg-[#121212]/25"}`}
              />
            ))}
          </div>
          {next && n > 1 && (
            <button
              onClick={() => setI((i + 1) % n)}
              className="absolute -right-28 top-8 bottom-8 w-40 rounded-[24px] bg-[#121212]/10 p-4 text-left hidden md:block hover:-translate-x-2 transition-transform"
              aria-label="Next card"
            >
              <span className="sr-only">{next.kicker}</span>
            </button>
          )}
        </div>

        {/* Right of deck */}
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-tile bg-surface rounded-[20px] p-5">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">Busiest weekday</div>
            <div className="stat-num font-serif text-[56px] leading-none mt-3">{stats.busiestWeekday?.label ?? "–"}</div>
            <div className="text-[12px] text-muted mt-1">{stats.busiestWeekday ? `${stats.busiestWeekday.count} results` : ""}</div>
          </div>
          <div className="stat-tile bg-surface rounded-[20px] p-5">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">Peak hour</div>
            <div className="stat-num font-serif text-[56px] leading-none mt-3">{stats.peakHour?.label ?? "–"}</div>
            <div className="text-[12px] text-muted mt-1">{stats.peakHour ? `${stats.peakHour.count} results` : ""}</div>
          </div>
          <div className="col-span-2 bg-surface rounded-[20px] p-5 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">Participation</div>
            <div className="space-y-2">
              {stats.participation.map((p) => (
                <div key={p.playerId} className="flex items-center gap-3 text-[12px]">
                  <span className="w-16 truncate font-semibold">{p.name}</span>
                  <div className="flex-1 flex gap-[3px]">
                    {Array.from({ length: Math.min(stats.activeDays, 21) }, (_, k) => (
                      <span
                        key={k}
                        style={{ backgroundColor: k < Math.round(p.rate * Math.min(stats.activeDays, 21)) ? p.color : "#2A2A27" }}
                        className="h-3 flex-1 rounded-[3px]"
                      />
                    ))}
                  </div>
                  <span className="w-10 text-right text-muted tabular-nums">{Math.round(p.rate * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Most played games">
          <div className="space-y-2">
            {stats.mostPlayed.slice(0, 6).map((g) => (
              <div key={g.slug} className="flex items-center gap-2.5">
                <GameIcon slug={g.slug} size={24} />
                <div className="flex-1 h-5 bg-surface2 rounded-full overflow-hidden">
                  <div style={{ width: `${(g.count / maxGame) * 100}%` }} className="h-full bg-lime rounded-full grow-in" />
                </div>
                <span className="w-8 text-right text-[12px] tabular-nums text-muted">{g.count}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Results by weekday">
          <div className="flex items-end gap-2 h-[150px] pt-4">
            {stats.resultsByWeekday.map((v, k) => (
              <div key={k} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                <span className="text-[11px] text-muted tabular-nums">{v}</span>
                <div
                  style={{ height: `${Math.max(4, (v / maxWd) * 100)}%` }}
                  className="chart-bar w-full rounded-t-[8px] bg-lime/90"
                />
                <span className="text-[11px] text-muted">{WD[k]}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Lead changes per week">
          <div className="flex items-end gap-2 h-[150px] pt-4">
            {stats.leadChangesPerWeek.length === 0 && <span className="text-muted text-[13px]">No weeks yet</span>}
            {stats.leadChangesPerWeek.slice(-8).map((w, k) => (
              <div key={k} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                <span className="text-[11px] text-muted tabular-nums">{w.value}</span>
                <div style={{ height: `${Math.max(4, (w.value / maxLead) * 100)}%` }} className="chart-bar w-full rounded-t-[8px] bg-orange" />
                <span className="text-[10px] text-muted truncate max-w-full">{w.label.split("–")[0]}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(
          [
            ["Closest finish", stats.records.closestFinish],
            ["Biggest blowout", stats.records.biggestBlowout],
            ["Hardest day", stats.records.hardestDay],
            ["Longest everyone-played run", stats.records.longestRun],
          ] as const
        ).map(([label, rec]) => (
          <div key={label} className="stat-tile bg-surface rounded-[18px] p-5">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">{label}</div>
            <div className="stat-num font-serif text-[40px] leading-none mt-3">{rec?.label ?? "–"}</div>
            <div className="text-[12px] text-muted mt-1.5">{rec?.detail ?? "Not enough data yet"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
