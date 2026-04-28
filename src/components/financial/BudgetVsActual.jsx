import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { differenceInDays, startOfYear, isWithinInterval, parseISO } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try {
    return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end });
  } catch {
    return false;
  }
}

function ProgressBar({ percent }) {
  let color = "bg-green-500";
  if (percent >= 90) color = "bg-red-500";
  else if (percent >= 70) color = "bg-yellow-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden min-w-[80px]">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{percent.toFixed(0)}%</span>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className={`${color} rounded-xl p-4 shadow-sm`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function BudgetVsActual({ range }) {
  const [sortKey, setSortKey] = useState("variance_pct");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedRows, setExpandedRows] = useState(new Set());

  const { data: budgetLines = [] } = useQuery({
    queryKey: ["budget-lines"],
    queryFn: () => base44.entities.BudgetLine.filter({ year: 2026 }),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["fin-expenses"],
    queryFn: () => base44.entities.Expense.list("-date", 2000),
  });

  const now = new Date();
  const yearStart = startOfYear(now);
  const daysElapsed = Math.max(1, differenceInDays(now, yearStart));

  const budgetData = useMemo(() => {
    const totalBudget = budgetLines.reduce((s, b) => s + (b.budget_amount ?? 0), 0);

    // Actual YTD per category
    const expByCategory = {};
    expenses.forEach((exp) => {
      if (exp.date && inRange(exp.date, { start: yearStart, end: now })) {
        const cat = (exp.category || "Unbudgeted").toLowerCase().trim();
        expByCategory[cat] = (expByCategory[cat] ?? 0) + (exp.amount ?? 0);
      }
    });

    // Actual YTD per category per month
    const expByMonthAndCategory = {};
    expenses.forEach((exp) => {
      if (exp.date && inRange(exp.date, { start: yearStart, end: now })) {
        const cat = (exp.category || "Unbudgeted").toLowerCase().trim();
        const month = new Date(exp.date).getMonth() + 1;
        const key = `${cat}|${month}`;
        expByMonthAndCategory[key] = (expByMonthAndCategory[key] ?? 0) + (exp.amount ?? 0);
      }
    });

    // Build rows for matched budgets
    const rows = budgetLines.map((budget) => {
      const cat = (budget.category ?? "").toLowerCase().trim();
      const actualYtd = expByCategory[cat] ?? 0;
      const variance = budget.budget_amount - actualYtd;
      const variancePct = budget.budget_amount > 0 ? (variance / budget.budget_amount) * 100 : 0;
      const projectedYearEnd = (actualYtd / daysElapsed) * 365;
      const monthlyBudget = budget.budget_amount / 12;
      const percentUsed = budget.budget_amount > 0 ? (actualYtd / budget.budget_amount) * 100 : 0;

      // Monthly breakdown
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const key = `${cat}|${month}`;
        return { month, actual: expByMonthAndCategory[key] ?? 0 };
      });

      return {
        id: budget.id,
        category: budget.category,
        annualBudget: budget.budget_amount,
        monthlyBudget,
        actualYtd,
        variance,
        variancePct,
        projectedYearEnd,
        percentUsed,
        monthlyData,
      };
    });

    // Unbudgeted expenses
    const unbudgetedCats = new Set(Object.keys(expByCategory));
    budgetLines.forEach((b) => unbudgetedCats.delete((b.category ?? "").toLowerCase().trim()));

    let unbudgetedActual = 0;
    unbudgetedCats.forEach((cat) => {
      unbudgetedActual += expByCategory[cat] ?? 0;
    });

    if (unbudgetedCats.size > 0 || unbudgetedActual > 0) {
      rows.push({
        id: "unbudgeted",
        category: "Unbudgeted Expenses",
        annualBudget: 0,
        monthlyBudget: 0,
        actualYtd: unbudgetedActual,
        variance: -unbudgetedActual,
        variancePct: -Infinity,
        projectedYearEnd: (unbudgetedActual / daysElapsed) * 365,
        percentUsed: Infinity,
        monthlyData: Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          let actual = 0;
          unbudgetedCats.forEach((cat) => {
            const key = `${cat}|${month}`;
            actual += expByMonthAndCategory[key] ?? 0;
          });
          return { month, actual };
        }),
      });
    }

    const actualYtdTotal = Object.values(expByCategory).reduce((s, v) => s + v, 0);

    return {
      totalBudget,
      actualYtdTotal,
      varianceTotal: totalBudget - actualYtdTotal,
      projectedYearEndTotal: (actualYtdTotal / daysElapsed) * 365,
      rows,
    };
  }, [budgetLines, expenses, daysElapsed, yearStart, now]);

  const sorted = useMemo(() => {
    return [...budgetData.rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [budgetData.rows, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortHead({ label, k }) {
    const active = sortKey === k;
    return (
      <TableHead
        className="cursor-pointer select-none hover:text-foreground whitespace-nowrap"
        onClick={() => handleSort(k)}
      >
        {label}
        {active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </TableHead>
    );
  }

  function toggleExpanded(id) {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Budget vs Actual</h2>
        <p className="text-xs text-muted-foreground ml-auto">
          Actual expenses will populate once QuickBooks sync is complete. Budget figures are based on 2026 annual budget.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Total 2026 Budget"
          value={fmt(budgetData.totalBudget)}
          color="bg-card border shadow-sm rounded-xl"
        />
        <SummaryCard
          label="Actual Spend YTD"
          value={fmt(budgetData.actualYtdTotal)}
          color="bg-card border shadow-sm rounded-xl"
        />
        <SummaryCard
          label="Variance $"
          value={fmt(budgetData.varianceTotal)}
          sub={budgetData.varianceTotal >= 0 ? "Under Budget" : "Over Budget"}
          color={`${budgetData.varianceTotal >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} rounded-xl shadow-sm`}
        />
        <SummaryCard
          label="Projected Year-End Spend"
          value={fmt(budgetData.projectedYearEndTotal)}
          color="bg-card border shadow-sm rounded-xl"
        />
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10" />
                <SortHead label="Category" k="category" />
                <SortHead label="Annual Budget" k="annualBudget" />
                <SortHead label="Monthly Budget" k="monthlyBudget" />
                <SortHead label="Actual YTD" k="actualYtd" />
                <SortHead label="Variance $" k="variance" />
                <SortHead label="Variance %" k="variancePct" />
                <SortHead label="Projected Year-End" k="projectedYearEnd" />
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow className={row.category === "Unbudgeted Expenses" ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-muted/50"}>
                    <TableCell className="w-10 text-center">
                      {row.monthlyData.some((m) => m.actual > 0) && (
                        <button onClick={() => toggleExpanded(row.id)} className="p-1 hover:bg-muted rounded">
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${expandedRows.has(row.id) ? "rotate-180" : ""}`}
                          />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{row.category}</TableCell>
                    <TableCell className="text-sm text-right">{fmt(row.annualBudget)}</TableCell>
                    <TableCell className="text-sm text-right">{fmt(row.monthlyBudget)}</TableCell>
                    <TableCell className="text-sm text-right">{fmt(row.actualYtd)}</TableCell>
                    <TableCell className={`text-sm text-right font-semibold ${row.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(row.variance)}
                    </TableCell>
                    <TableCell className={`text-sm text-right font-semibold ${row.variancePct >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmtPct(row.variancePct)}
                    </TableCell>
                    <TableCell className="text-sm text-right">{fmt(row.projectedYearEnd)}</TableCell>
                    <TableCell>
                      <ProgressBar percent={row.percentUsed} />
                    </TableCell>
                  </TableRow>

                  {/* Monthly Breakdown */}
                  {expandedRows.has(row.id) && (
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={9} className="p-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Monthly Breakdown: {row.category}</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left px-2 py-1">Month</th>
                                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
                                    (m) => (
                                      <th key={m} className="text-right px-2 py-1">
                                        {m}
                                      </th>
                                    )
                                  )}
                                  <th className="text-right px-2 py-1">Running Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b hover:bg-muted/30">
                                  <td className="text-left px-2 py-1 font-semibold">Budget</td>
                                  {Array.from({ length: 12 }).map((_, i) => (
                                    <td key={i} className="text-right px-2 py-1">
                                      {fmt(row.monthlyBudget)}
                                    </td>
                                  ))}
                                  <td className="text-right px-2 py-1 font-semibold">{fmt(row.annualBudget)}</td>
                                </tr>
                                <tr className="hover:bg-muted/30">
                                  <td className="text-left px-2 py-1 font-semibold">Actual</td>
                                  {row.monthlyData.map((m, i) => {
                                    const running = row.monthlyData.slice(0, i + 1).reduce((s, x) => s + x.actual, 0);
                                    return (
                                      <td key={i} className="text-right px-2 py-1">
                                        {fmt(m.actual)}
                                      </td>
                                    );
                                  })}
                                  <td className="text-right px-2 py-1 font-semibold">{fmt(row.actualYtd)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}