import React, { useMemo } from "react";
import { differenceInDays, startOfYear } from "date-fns";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

function ProgressBar({ percent, color }) {
  const bg = color === "green" ? "bg-green-400" : color === "yellow" ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-white/60 mb-1">
        <span>Progress to goal</span>
        <span>{Math.min(percent, 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${bg} transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function GoalCard({ label, goal, actual, projected, progressPercent, color, isPercent }) {
  const display = isPercent ? fmtPct : fmt;
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">{label}</p>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Goal</span>
          <span className="font-bold text-white">{display(goal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">YTD Actual</span>
          <span className="text-white">{display(actual)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Projected Year-End</span>
          <span className={`font-semibold ${color === "green" ? "text-green-400" : color === "yellow" ? "text-yellow-400" : "text-red-400"}`}>
            {display(projected)}
          </span>
        </div>
      </div>
      <ProgressBar percent={progressPercent} color={color} />
    </div>
  );
}

export default function GoalsSection({ allSnapshots = [], contracts = [] }) {
  const now = new Date();
  const yearStart = startOfYear(now);
  const daysElapsed = Math.max(1, differenceInDays(now, yearStart));
  const daysInYear = 365;

  const metrics = useMemo(() => {
    // Sum all 2026 monthly snapshots for YTD actuals
    const ytdSnaps = allSnapshots.filter(s =>
      s.period_type === "monthly" &&
      s.period_start &&
      s.period_start >= "2026-01-01" &&
      s.period_start <= now.toISOString().split("T")[0]
    );

    const ytdRevenue = ytdSnaps.reduce((s, r) => s + (r.revenue ?? 0), 0);
    const ytdGrossProfit = ytdSnaps.reduce((s, r) => s + (r.gross_profit ?? 0), 0);
    const ytdNetProfit = ytdSnaps.reduce((s, r) => s + (r.net_profit ?? 0), 0);
    const ytdGrossMargin = ytdRevenue > 0 ? (ytdGrossProfit / ytdRevenue) * 100 : 0;
    const ytdNetMargin = ytdRevenue > 0 ? (ytdNetProfit / ytdRevenue) * 100 : 0;

    // Projected year-end using run rate from uploaded data
    // Revenue projection: YTD actual + remaining contract backlog
    const activeContracts = contracts.filter(c =>
      c.status === "active" && c.forecast_status !== "lost"
    );
    const remainingBacklog = activeContracts.reduce((s, c) => {
      const val = c.adjusted_value || c.contract_value || 0;
      const invoiced = c.total_invoiced || 0;
      return s + Math.max(0, val - invoiced);
    }, 0);
    const projRevenue = ytdRevenue + remainingBacklog;

    // For margin projections, use the YTD margin rates applied to projected revenue
    // This assumes the margin rates hold for the rest of the year
    const projGrossMargin = ytdGrossMargin; // best estimate = current YTD rate
    const projNetMargin = ytdNetMargin;
    const projNetProfit = projRevenue * (ytdNetMargin / 100);
    const projGrossProfit = projRevenue * (ytdGrossMargin / 100);

    // Goals
    const NET_PROFIT_GOAL = 1000000;
    const GROSS_MARGIN_GOAL = 30; // 30%
    const NET_MARGIN_GOAL = 15;   // 15%

    // Progress %
    const netProfitProgress = (projNetProfit / NET_PROFIT_GOAL) * 100;
    const grossMarginProgress = (projGrossMargin / GROSS_MARGIN_GOAL) * 100;
    const netMarginProgress = (projNetMargin / NET_MARGIN_GOAL) * 100;

    // Status colors
    const getColor = (progress) => progress >= 90 ? "green" : progress >= 60 ? "yellow" : "red";

    // Gap to net profit goal
    const netProfitGap = Math.max(0, NET_PROFIT_GOAL - projNetProfit);
    const goalAchieved = projNetProfit >= NET_PROFIT_GOAL;

    return {
      ytdRevenue, ytdGrossProfit, ytdNetProfit,
      ytdGrossMargin, ytdNetMargin,
      projRevenue, projGrossMargin, projNetMargin, projNetProfit,
      netProfitProgress, grossMarginProgress, netMarginProgress,
      netProfitColor: getColor(netProfitProgress),
      grossMarginColor: getColor(grossMarginProgress),
      netMarginColor: getColor(netMarginProgress),
      netProfitGap, goalAchieved,
      NET_PROFIT_GOAL, GROSS_MARGIN_GOAL, NET_MARGIN_GOAL,
    };
  }, [allSnapshots, contracts, now]);

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-6 rounded-xl shadow-lg border border-slate-700">
      <h2 className="text-lg font-bold tracking-wider uppercase font-barlow text-white mb-4">2026 Goals</h2>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <GoalCard
          label="Net Profit"
          goal={metrics.NET_PROFIT_GOAL}
          actual={metrics.ytdNetProfit}
          projected={metrics.projNetProfit}
          progressPercent={metrics.netProfitProgress}
          color={metrics.netProfitColor}
          isPercent={false}
        />
        <GoalCard
          label="Gross Margin %"
          goal={metrics.GROSS_MARGIN_GOAL}
          actual={metrics.ytdGrossMargin}
          projected={metrics.projGrossMargin}
          progressPercent={metrics.grossMarginProgress}
          color={metrics.grossMarginColor}
          isPercent={true}
        />
        <GoalCard
          label="Net Margin %"
          goal={metrics.NET_MARGIN_GOAL}
          actual={metrics.ytdNetMargin}
          projected={metrics.projNetMargin}
          progressPercent={metrics.netMarginProgress}
          color={metrics.netMarginColor}
          isPercent={true}
        />
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 flex flex-col justify-between">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Net Profit Gap</p>
          {metrics.goalAchieved ? (
            <div>
              <p className="text-2xl font-bold text-green-400">Goal Achieved 🎉</p>
              <p className="text-xs text-white/60 mt-1">Projected to hit $1M net profit</p>
            </div>
          ) : (
            <div>
              <p className="text-2xl font-bold text-red-400">{fmt(metrics.netProfitGap)}</p>
              <p className="text-xs text-white/60 mt-1">needed to hit $1M goal</p>
              <p className="text-xs text-white/60 mt-2">Projected year-end: <span className="text-white font-medium">{fmt(metrics.projNetProfit)}</span></p>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-xs text-white/60">Revenue backlog included in projection</p>
          </div>
        </div>
      </div>
    </div>
  );
}