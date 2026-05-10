import React, { useState, useMemo } from "react";
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
      <p className="text-[10px] text-muted-foreground leading-tight">Active projects · {kpi.currentYear}</p>
      {isLoading ? (
        <div className="h-7 w-28 bg-muted animate-pulse rounded mt-1" />
      ) : (
        <div className="mt-1 space-y-1">
          <span className="text-2xl font-bold font-barlow text-foreground">{fmtDollar(kpi.projectedRevenueCurrentYear)}</span>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Billed: <span className="font-mono text-foreground">{fmtDollar(kpi.billedCurrentYear)}</span></div>
            <div>Remaining: <span className="font-mono font-semibold" style={{ color: kpi.remainingCurrentYear >= 0 ? "#15803d" : "#dc2626" }}>{fmtDollar(kpi.remainingCurrentYear)}</span></div>
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

export default function PLKPICards({ refreshKey }) {
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
    const currentYear = new Date().getFullYear();
    const projectedRevenueCurrentYear = projectedRevenues
      .filter((p) => p.year === currentYear && p.status === "active")
      .reduce((s, p) => s + (p.projected_total || 0), 0);
    const billedCurrentYear = projectBillings
      .filter((b) => b.year === currentYear)
      .reduce((s, b) => s + (b.amount_billed || 0), 0);
    const remainingCurrentYear = projectedRevenueCurrentYear - billedCurrentYear;
    return { projectedRevenueCurrentYear, billedCurrentYear, remainingCurrentYear, currentYear };
  }, [projectedRevenues, projectBillings]);

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <SnapshotRow label="Direct Labor" value={lt["Total for Direct Labor"] ?? null} />
                <SnapshotRow label="Net" value={scopedMonthKeys.length > 0 ? laborNet : null} bold thick color="auto" />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}