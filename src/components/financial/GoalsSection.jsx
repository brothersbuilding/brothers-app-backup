import React, { useMemo } from "react";
import { differenceInDays, startOfYear } from "date-fns";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

function ProgressBar({ percent, status }) {
  let color = "bg-green-500";
  if (status === "yellow") color = "bg-yellow-500";
  else if (status === "red") color = "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden min-w-[80px]">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className="text-xs text-white/70 w-8 text-right">{percent.toFixed(0)}%</span>
    </div>
  );
}

function GoalCard({ label, targetLabel, targetValue, actualLabel, actualValue, projectedLabel, projectedValue, progressPercent, status }) {
  return (
    <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
      <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">{label}</p>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/70">{targetLabel}</span>
          <span className="text-sm font-bold text-white">{targetValue}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/70">{actualLabel}</span>
          <span className="text-sm text-white">{actualValue}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/70">{projectedLabel}</span>
          <span className="text-sm font-semibold text-white">{projectedValue}</span>
        </div>
      </div>
      {progressPercent !== null && (
        <ProgressBar percent={progressPercent} status={status} />
      )}
    </div>
  );
}

export default function GoalsSection({ invoices, expenses }) {
  const now = new Date();
  const yearStart = startOfYear(now);
  const daysElapsed = Math.max(1, differenceInDays(now, yearStart));

  const metrics = useMemo(() => {
    // Revenue YTD (paid invoices)
    const revenueYtd = invoices
      .filter((inv) => inv.status === "paid" && inv.date_sent && inv.date_sent >= yearStart.toISOString().split("T")[0])
      .reduce((s, inv) => s + (inv.amount ?? 0), 0);

    // Expenses YTD
    const expensesYtd = expenses
      .filter((exp) => exp.date && exp.date >= yearStart.toISOString().split("T")[0])
      .reduce((s, exp) => s + (exp.amount ?? 0), 0);

    // Projections
    const projectedYearEndRevenue = (revenueYtd / daysElapsed) * 365;
    const projectedYearEndExpenses = (expensesYtd / daysElapsed) * 365;

    // Net income
    const actualNetIncomeYtd = revenueYtd - expensesYtd;
    const projectedNetIncome = projectedYearEndRevenue - projectedYearEndExpenses;

    // Goal metrics
    const netIncomeGoal = 1000000;
    const revenueGoal = 3329315;

    // Net income progress
    const netIncomeProgress = (projectedNetIncome / netIncomeGoal) * 100;
    let netIncomeStatus = "red";
    if (projectedNetIncome >= 800000) netIncomeStatus = "green";
    else if (projectedNetIncome >= 500000) netIncomeStatus = "yellow";

    // Revenue progress
    const revenueProgress = (projectedYearEndRevenue / revenueGoal) * 100;

    // Gap
    const netIncomeGap = Math.max(0, netIncomeGoal - projectedNetIncome);
    const goalAchieved = projectedNetIncome >= netIncomeGoal;

    return {
      revenueYtd,
      projectedYearEndRevenue,
      actualNetIncomeYtd,
      projectedNetIncome,
      netIncomeProgress,
      netIncomeStatus,
      revenueProgress,
      netIncomeGap,
      goalAchieved,
    };
  }, [invoices, expenses, daysElapsed, yearStart]);

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-6 mb-6 rounded-xl shadow-lg border border-slate-700">
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-wider uppercase font-barlow text-white">2026 Goals</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GoalCard
          label="Net Income Goal"
          targetLabel="Target"
          targetValue="$1,000,000"
          actualLabel="Actual YTD"
          actualValue={fmt(metrics.actualNetIncomeYtd)}
          projectedLabel="Projected"
          projectedValue={fmt(metrics.projectedNetIncome)}
          progressPercent={metrics.netIncomeProgress}
          status={metrics.netIncomeStatus}
        />

        <GoalCard
          label="Revenue Goal"
          targetLabel="Target"
          targetValue="$3,329,315"
          actualLabel="Actual YTD"
          actualValue={fmt(metrics.revenueYtd)}
          projectedLabel="Projected"
          projectedValue={fmt(metrics.projectedYearEndRevenue)}
          progressPercent={metrics.revenueProgress}
          status="green"
        />

        <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">Net Income Gap</p>
            {metrics.goalAchieved ? (
              <div className="space-y-2">
                <p className="text-sm text-white/70">Status</p>
                <p className="text-2xl font-bold text-green-400">Goal Achieved 🎉</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-white/70">Amount Needed</p>
                <p className="text-2xl font-bold text-red-400">{fmt(metrics.netIncomeGap)}</p>
                <p className="text-xs text-white/70">to hit $1M goal</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}