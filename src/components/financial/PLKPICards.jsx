import React, { useState, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CURRENT_YEAR = new Date().getFullYear();

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonthKey(k) {
  const [y, m] = k.split("-");
  return `${MONTH_NAMES[parseInt(m)]} ${y}`;
}

function parseMonthlyAmounts(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}

function monthToQuarter(monthKey) {
  const m = parseInt(monthKey.split("-")[1]);
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

function fmtDollar(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const formatted = abs >= 1000000
    ? "$" + (abs / 1000000).toFixed(2) + "M"
    : abs >= 1000
    ? "$" + Math.round(abs).toLocaleString("en-US")
    : "$" + abs.toFixed(2);
  return n < 0 ? "-" + formatted : formatted;
}

function fmtPct(n) {
  if (n == null) return null;
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function getPeriodLabel(viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear) {
  if (viewMode === "month" && effectiveMonth) {
    const [y, m] = effectiveMonth.split("-");
    return `${MONTH_NAMES[parseInt(m)]} ${y}`;
  }
  if (viewMode === "quarter") return `${effectiveQuarter} ${effectiveQuarterYear}`;
  if (viewMode === "year") return `FY ${effectiveYear}`;
  return "";
}

function SnapshotRow({ label, value, bold, thick, color }) {
  const textColor = color === "auto"
    ? (value > 0 ? "#15803d" : value < 0 ? "#dc2626" : undefined)
    : undefined;
  return (
    <div className={`flex justify-between items-center py-2 ${thick ? "border-t-2 border-border mt-1 pt-3" : bold ? "border-t border-border" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-base" : "text-sm"}`} style={{ color: textColor }}>
        {value == null ? "—" : fmtDollar(value)}
      </span>
    </div>
  );
}

function ProjectedRevenueKPICard({ kpi, isLoading }) {
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col gap-1 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projected Revenue</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{CURRENT_YEAR}</p>
      {isLoading ? (
        <div className="h-7 w-28 bg-muted animate-pulse rounded mt-1" />
      ) : (
        <div className="mt-1 space-y-1">
          <span className="text-2xl font-bold font-barlow text-foreground">{fmtDollar(kpi.totalProjectedRevenue)}</span>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Actual YTD: <span className="font-mono text-foreground">{fmtDollar(kpi.plRevenueYTD)}</span></div>
            <div>Remaining: <span className="font-mono font-semibold" style={{ color: kpi.remainingProjected > 0 ? "#15803d" : undefined }}>{fmtDollar(kpi.remainingProjected)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, subtitle, value, pct, isLoading }) {
  const isNegative = typeof value === "number" && value < 0;
  const valueColor = pct != null
    ? (isNegative ? "text-red-600" : "text-green-700")
    : "text-foreground";

  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col gap-1 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>}
      {isLoading ? (
        <div className="h-7 w-28 bg-muted animate-pulse rounded mt-1" />
      ) : (
        <div className="flex items-baseline gap-2 mt-1 flex-wrap">
          <span className={`text-2xl font-bold font-barlow ${valueColor}`}>
            {typeof value === "number" ? fmtDollar(value) : "—"}
          </span>
          {pct != null && typeof value === "number" && (
            <span className={`text-sm font-semibold ${isNegative ? "text-red-500" : "text-green-600"}`}>
              {fmtPct(pct)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function PLKPICards({ refreshKey, onPeriodChange }) {
  const [viewMode, setViewMode] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedQuarterYear, setSelectedQuarterYear] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");

  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ["pl-entries", refreshKey],
    queryFn: () => base44.entities.PLEntry.list("sort_order", 5000),
  });

  const { data: projectedRevenues = [] } = useQuery({
    queryKey: ["projected-revenue"],
    queryFn: () => base44.entities.ProjectedRevenue.list("-year", 500),
  });

  const { data: projectBillings = [] } = useQuery({
    queryKey: ["project-billing"],
    queryFn: () => base44.entities.ProjectBilling.list("month_key", 2000),
  });

  const { availableMonths, availableYears, quartersByYear, allMonthKeys } = useMemo(() => {
    const months = new Set();
    const years = new Set();
    const qByYear = {};
    allEntries.forEach((e) => {
      const keys = (e.month_keys || e.month_key || "").split(",").filter(Boolean);
      keys.forEach((k) => {
        months.add(k);
        const y = k.split("-")[0];
        years.add(y);
        const q = monthToQuarter(k);
        if (!qByYear[y]) qByYear[y] = new Set();
        qByYear[y].add(q);
      });
    });
    const sortedMonths = [...months].sort().reverse();
    return {
      availableMonths: sortedMonths,
      availableYears: [...years].sort().reverse(),
      quartersByYear: Object.fromEntries(
        Object.entries(qByYear).map(([y, qs]) => [y, [...qs].sort()])
      ),
      allMonthKeys: [...months].sort(),
    };
  }, [allEntries]);

  const effectiveMonth = selectedMonth || availableMonths[0] || "";
  const effectiveYear = selectedYear || availableYears[0] || "";
  const quarterYears = Object.keys(quartersByYear).sort().reverse();
  const effectiveQuarterYear = selectedQuarterYear || quarterYears[0] || "";
  const quartersForYear = quartersByYear[effectiveQuarterYear] || [];
  const effectiveQuarter = (quartersForYear.includes(selectedQuarter) ? selectedQuarter : null) || quartersForYear[quartersForYear.length - 1] || "";

  useEffect(() => {
    if (!onPeriodChange) return;
    onPeriodChange(getPeriodLabel(viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear));
  }, [viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear]);

  const scopedMonthKeys = useMemo(() => {
    if (viewMode === "month") return effectiveMonth ? [effectiveMonth] : [];
    if (viewMode === "quarter") {
      return allMonthKeys.filter((k) => {
        const y = k.split("-")[0];
        return y === effectiveQuarterYear && monthToQuarter(k) === effectiveQuarter;
      });
    }
    if (viewMode === "year") {
      return allMonthKeys.filter((k) => k.split("-")[0] === effectiveYear);
    }
    return [];
  }, [viewMode, effectiveMonth, effectiveYear, effectiveQuarterYear, effectiveQuarter, allMonthKeys]);

  const labelTotals = useMemo(() => {
    const totals = {};
    if (scopedMonthKeys.length === 0) return totals;
    allEntries.forEach((e) => {
      const amounts = parseMonthlyAmounts(e.monthly_amounts);
      scopedMonthKeys.forEach((k) => {
        const v = amounts[k];
        if (v != null) {
          totals[e.label] = (totals[e.label] ?? 0) + v;
        }
      });
    });
    return totals;
  }, [allEntries, scopedMonthKeys]);

  const projectedKpi = useMemo(() => {
    const yearStr = String(CURRENT_YEAR);

    // Step 1: actual revenue YTD from PLEntry (label = "Total for Income")
    let plRevenueYTD = 0;
    allEntries
      .filter(e => e.label === "Total for Income")
      .forEach(e => {
        const amounts = parseMonthlyAmounts(e.monthly_amounts);
        Object.entries(amounts).forEach(([k, v]) => {
          if (k.startsWith(yearStr + "-") && v != null) plRevenueYTD += v;
        });
      });

    // Step 2: currentYearRemaining per active project (matches ProjectedRevenueSection logic)
    const today = new Date();
    const currentYear = today.getFullYear();
    const yearStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearEnd = new Date(currentYear, 11, 31);

    let remainingProjected = 0;
    projectedRevenues
      .filter(p => p.status === "active")
      .forEach(p => {
        const total_billed = projectBillings
          .filter(b => b.project_id === p.id)
          .reduce((sum, b) => sum + (b.amount_billed || 0), 0);
        const remaining = (p.projected_total || 0) - total_billed;

        const endDate = p.end_date ? new Date(p.end_date) : yearEnd;

        // All remaining months from today to project end
        const allRemainingMonths = [];
        const cursor = new Date(yearStart);
        while (cursor <= endDate) {
          allRemainingMonths.push(cursor.getMonth() + 1);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        const monthlyProjected = allRemainingMonths.length > 0 ? remaining / allRemainingMonths.length : 0;

        // Months remaining in current year only
        const monthsInCurrentYear = [];
        const c2 = new Date(yearStart);
        while (c2 <= yearEnd && c2 <= endDate) {
          monthsInCurrentYear.push(c2.getMonth() + 1);
          c2.setMonth(c2.getMonth() + 1);
        }

        const currentYearRemaining = monthlyProjected * monthsInCurrentYear.length;
        if (currentYearRemaining > 0) remainingProjected += currentYearRemaining;
      });

    // Step 3: totals
    const totalProjectedRevenue = plRevenueYTD + remainingProjected;
    return { totalProjectedRevenue, plRevenueYTD, remainingProjected };
  }, [allEntries, projectedRevenues, projectBillings]);

  const kpis = useMemo(() => {
    const revenue = labelTotals["Total for Income"] ?? 0;
    const grossProfit = labelTotals["Gross Profit"] ?? 0;
    const grossMarginPct = revenue !== 0 ? (grossProfit / revenue) * 100 : null;
    const netIncome = labelTotals["Net Income"] ?? 0;
    const netMarginPct = revenue !== 0 ? (netIncome / revenue) * 100 : null;
    const laborRevenue = labelTotals["Total for Labor"] ?? 0;
    const laborCost = labelTotals["Total for Direct Labor"] ?? 0;
    const laborNetMargin = laborRevenue - laborCost;
    const laborNetMarginPct = laborRevenue !== 0 ? (laborNetMargin / laborRevenue) * 100 : null;
    return { revenue, grossProfit, grossMarginPct, netIncome, netMarginPct, laborNetMargin, laborNetMarginPct };
  }, [labelTotals]);

  const MONTH_NAMES_SHORT = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const trendData = useMemo(() => {
    const periods = [];

    if (viewMode === "month" && effectiveMonth) {
      const [y, m] = effectiveMonth.split("-").map(Number);
      for (let i = 3; i >= 0; i--) {
        let pm = m - i, py = y;
        while (pm <= 0) { pm += 12; py--; }
        const key = `${py}-${String(pm).padStart(2, "0")}`;
        periods.push({ label: `${MONTH_NAMES_SHORT[pm]} ${String(py).slice(2)}`, scopeKeys: [key] });
      }
    } else if (viewMode === "quarter" && effectiveQuarter && effectiveQuarterYear) {
      const qNum = parseInt(effectiveQuarter.replace("Q", ""));
      const yr = parseInt(effectiveQuarterYear);
      const qMonths = { 1: ["01","02","03"], 2: ["04","05","06"], 3: ["07","08","09"], 4: ["10","11","12"] };
      for (let i = 3; i >= 0; i--) {
        let pq = qNum - i, py = yr;
        while (pq <= 0) { pq += 4; py--; }
        const keys = qMonths[pq].map(m => `${py}-${m}`).filter(k => allMonthKeys.includes(k));
        periods.push({ label: `Q${pq} ${String(py).slice(2)}`, scopeKeys: keys });
      }
    } else if (viewMode === "year" && effectiveYear) {
      const yr = parseInt(effectiveYear);
      for (let i = 3; i >= 0; i--) {
        const py = yr - i;
        const keys = allMonthKeys.filter(k => k.startsWith(String(py)));
        periods.push({ label: String(py), scopeKeys: keys });
      }
    }

    return periods.map(({ label, scopeKeys }) => {
      if (!scopeKeys.length) return { label, revenue: null, grossMarginPct: null, netMarginPct: null };
      const totalsMap = {};
      allEntries.forEach(e => {
        const amounts = parseMonthlyAmounts(e.monthly_amounts);
        scopeKeys.forEach(k => {
          const v = amounts[k];
          if (v != null) totalsMap[e.label] = (totalsMap[e.label] ?? 0) + v;
        });
      });
      const revenue = totalsMap["Total for Income"] ?? null;
      const grossProfit = totalsMap["Gross Profit"] ?? null;
      const netIncome = totalsMap["Net Income"] ?? null;
      const grossMarginPct = revenue != null && revenue !== 0 ? (grossProfit / revenue) * 100 : null;
      const netMarginPct = revenue != null && revenue !== 0 ? (netIncome / revenue) * 100 : null;
      return { label, revenue, grossMarginPct, netMarginPct };
    });
  }, [viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear, allMonthKeys, allEntries]);

  function fmtYAxisDollar(v) {
    if (v == null) return "";
    const abs = Math.abs(v);
    if (abs >= 1000000) return (v < 0 ? "-" : "") + "$" + (abs / 1000000).toFixed(1) + "M";
    if (abs >= 1000) return (v < 0 ? "-" : "") + "$" + Math.round(abs / 1000) + "k";
    return "$" + v;
  }

  function fmtYAxisPct(v) { return v != null ? v.toFixed(1) + "%" : ""; }

  function TrendChart({ title, dataKey, color, yFormatter, domain, tooltipFormatter, labelFormatter }) {
    const hasData = trendData.some(d => d[dataKey] != null);
    return (
      <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground italic">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={yFormatter} tick={{ fontSize: 10 }} domain={domain} width={52} />
              <Tooltip formatter={(value) => value != null ? tooltipFormatter(value) : "—"} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color }}
                connectNulls={false}
              >
                <LabelList
                  dataKey={dataKey}
                  position="top"
                  formatter={labelFormatter}
                  style={{ fontSize: "10px", fontWeight: 600, fill: color }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {["month", "quarter", "year"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 font-medium capitalize transition-colors ${
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {viewMode === "month" && (
          <Select value={effectiveMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableMonths.map((k) => (
                <SelectItem key={k} value={k}>{fmtMonthKey(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {viewMode === "quarter" && (
          <>
            <Select value={effectiveQuarterYear} onValueChange={(v) => { setSelectedQuarterYear(v); setSelectedQuarter(""); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {quarterYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={effectiveQuarter} onValueChange={setSelectedQuarter}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {quartersForYear.map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {viewMode === "year" && (
          <Select value={effectiveYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* KPI Cards */}
      <div id="pdf-kpi-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Revenue" value={kpis.revenue} pct={null} isLoading={isLoading} />
        <KPICard label="Gross Margin" value={kpis.grossProfit} pct={kpis.grossMarginPct} isLoading={isLoading} />
        <KPICard label="Net Margin" value={kpis.netIncome} pct={kpis.netMarginPct} isLoading={isLoading} />
        <KPICard label="Labor Net Margin" subtitle="Labor Income vs Direct Labor Cost" value={kpis.laborNetMargin} pct={kpis.laborNetMarginPct} isLoading={isLoading} />
        <ProjectedRevenueKPICard kpi={projectedKpi} isLoading={isLoading} />
      </div>

      {/* Snapshot Tables */}
      {(() => {
        const periodLabel = getPeriodLabel(viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear);
        const lt = labelTotals;
        const laborNet = (lt["Total for Labor"] ?? 0) - (lt["Total for Direct Labor"] ?? 0);
        return (
          <div id="pdf-snapshot-tables" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* P&L Snapshot */}
            <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">P&L Snapshot</p>
              {periodLabel && <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>}
              <div className="mt-3">
                <SnapshotRow label="Revenue" value={lt["Total for Income"] ?? null} />
                <SnapshotRow label="Cost of Goods" value={lt["Total for Cost of Goods Sold"] ?? null} />
                <SnapshotRow label="Gross Profit" value={lt["Gross Profit"] ?? null} bold color="auto" />
                <SnapshotRow label="Expenses" value={lt["Total for Expenses"] ?? null} />
                <SnapshotRow label="Net Income" value={lt["Net Income"] ?? null} bold thick color="auto" />
              </div>
            </div>

            {/* Labor P&L Snapshot */}
            <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Labor P&L</p>
              {periodLabel && <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>}
              <div className="mt-3">
                <SnapshotRow label="Labor Income" value={lt["Total for Labor"] ?? null} />
                <SnapshotRow label="Labor Costs" value={lt["Total for Direct Labor"] ?? null} />
                <SnapshotRow label="Net" value={scopedMonthKeys.length > 0 ? laborNet : null} bold thick color="auto" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Trend Charts */}
      <div id="pdf-trend-charts" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrendChart
          title="Revenue Trend"
          dataKey="revenue"
          color="#2563eb"
          yFormatter={fmtYAxisDollar}
          domain={[(dataMin) => Math.floor(dataMin * 0.9), (dataMax) => Math.ceil(dataMax * 1.1)]}
          tooltipFormatter={(v) => fmtYAxisDollar(v)}
          labelFormatter={(v) => v == null ? "" : v >= 1000000 ? "$" + (v/1000000).toFixed(2) + "M" : v >= 1000 ? "$" + Math.round(v/1000) + "k" : "$" + Math.round(v)}
        />
        <TrendChart
          title="Gross Margin Trend"
          dataKey="grossMarginPct"
          color="#16a34a"
          yFormatter={fmtYAxisPct}
          domain={[(dataMin) => Math.floor(dataMin * 0.9), (dataMax) => Math.ceil(dataMax * 1.1)]}
          tooltipFormatter={(v) => v.toFixed(1) + "%"}
          labelFormatter={(v) => v == null ? "" : v.toFixed(1) + "%"}
        />
        <TrendChart
          title="Net Margin Trend"
          dataKey="netMarginPct"
          color="#ca8a04"
          yFormatter={fmtYAxisPct}
          domain={[(dataMin) => dataMin < 0 ? Math.floor(dataMin * 1.1) : Math.floor(dataMin * 0.9), (dataMax) => Math.ceil(dataMax * 1.1)]}
          tooltipFormatter={(v) => v.toFixed(1) + "%"}
          labelFormatter={(v) => v == null ? "" : v.toFixed(1) + "%"}
        />
      </div>
    </div>
  );
}