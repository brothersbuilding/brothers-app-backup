import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, subYears, parseISO, isWithinInterval, differenceInDays, format } from "date-fns";
import { RefreshCw, CheckCircle2, AlertCircle, Share2, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

import FilterBar from "@/components/financial/FilterBar";
import ExportShareModal from "@/components/financial/ExportShareModal";
import DataImportSection from "@/components/financial/DataImportSection";
import ContractBacklogTable from "@/components/financial/ContractBacklogTable";
import ProfitLossSection from "@/components/financial/ProfitLossSection";
import GoalsSection from "@/components/financial/GoalsSection";

// ── Date range helpers ────────────────────────────────────────────────────────
function getRange(preset, custom) {
  const now = new Date();
  const y = now.getFullYear();
  switch (preset) {
    case "this_month":        return { start: startOfMonth(now), end: now };
    case "last_month":        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    case "q1":                return { start: new Date(y, 0, 1), end: new Date(y, 2, 31) };
    case "q2":                return { start: new Date(y, 3, 1), end: new Date(y, 5, 30) };
    case "q3":                return { start: new Date(y, 6, 1), end: new Date(y, 8, 30) };
    case "q4":                return { start: new Date(y, 9, 1), end: new Date(y, 11, 31) };
    case "year_to_last_month": return { start: new Date(y, 0, 1), end: endOfMonth(subMonths(now, 1)) };
    case "ytd":               return { start: new Date(y, 0, 1), end: now };
    case "year_2025":         return { start: new Date(2025, 0, 1), end: new Date(2025, 11, 31) };
    case "year_2024":         return { start: new Date(2024, 0, 1), end: new Date(2024, 11, 31) };
    case "year_2023":         return { start: new Date(2023, 0, 1), end: new Date(2023, 11, 31) };
    case "year_2022":         return { start: new Date(2022, 0, 1), end: new Date(2022, 11, 31) };
    case "year_2021":         return { start: new Date(2021, 0, 1), end: new Date(2021, 11, 31) };
    case "year_2020":         return { start: new Date(2020, 0, 1), end: new Date(2020, 11, 31) };
    case "year_2019":         return { start: new Date(2019, 0, 1), end: new Date(2019, 11, 31) };
    case "custom":            return custom;
    default:                  return { start: new Date(y, 0, 1), end: now };
  }
}

function getDefaultPreset() {
  return "q1"; // Most recent complete period
}

function getComparisonRange(range, comparison) {
  const len = differenceInDays(range.end, range.start);
  switch (comparison) {
    case "previous_period": {
      const start = new Date(range.start);
      start.setDate(start.getDate() - len - 1);
      const end = new Date(range.start);
      end.setDate(end.getDate() - 1);
      return { start, end };
    }
    case "previous_quarter": {
      const pqs = new Date(range.start);
      pqs.setMonth(pqs.getMonth() - 3);
      const pqe = new Date(range.end);
      pqe.setMonth(pqe.getMonth() - 3);
      return { start: pqs, end: pqe };
    }
    case "previous_year":
      return { start: subYears(range.start, 1), end: subYears(range.end, 1) };
    default:
      return { start: subYears(range.start, 1), end: subYears(range.end, 1) };
  }
}

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try {
    return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end });
  } catch { return false; }
}

function sumField(records, field) {
  return records.reduce((s, r) => s + (r[field] ?? 0), 0);
}

function sumSnapshots(snapshots) {
  const revenue = snapshots.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const cogs = snapshots.reduce((s, r) => s + (r.cogs ?? 0), 0);
  const gross_profit = snapshots.reduce((s, r) => s + (r.gross_profit ?? 0), 0);
  const operating_expenses = snapshots.reduce((s, r) => s + (r.operating_expenses ?? 0), 0);
  const net_profit = snapshots.reduce((s, r) => s + (r.net_profit ?? 0), 0);
  const labor_cost = snapshots.reduce((s, r) => s + (r.labor_cost ?? 0), 0);
  const labor_revenue = snapshots.reduce((s, r) => s + (r.labor_revenue ?? 0), 0);
  const direct_labor_cost = snapshots.reduce((s, r) => s + (r.direct_labor_cost ?? 0), 0);
  const gross_margin = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
  const net_margin = revenue > 0 ? (net_profit / revenue) * 100 : 0;
  return { revenue, cogs, gross_profit, gross_margin, operating_expenses, net_profit, net_margin, labor_cost, labor_revenue, direct_labor_cost };
}

// Formatting helpers
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
const fmtDelta = (cur, prev) => {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

// ── Stat Card Component ─────────────────────────────────────────────────────
function StatCard({ label, primary, secondary, accentColor = "#C9A96E" }) {
  return (
    <div className="bg-white border rounded-lg p-5 shadow-sm" style={{ borderTop: `4px solid ${accentColor}` }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{label}</p>
      <div className="flex items-baseline gap-3">
        <p className="text-2xl font-bold text-gray-900">{primary}</p>
        {secondary && <p className="text-lg text-gray-600">{secondary}</p>}
      </div>
    </div>
  );
}

export default function FinancialDashboard() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState(getDefaultPreset());
  const [customRange, setCustomRange] = useState({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // ── Data fetching ──
  const { data: contracts = [] } = useQuery({
    queryKey: ["fin-contracts"],
    queryFn: () => base44.entities.Contract.list(),
  });

  const { data: allSnapshots = [] } = useQuery({
    queryKey: ["fin-all-snapshots"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-period_start", 500),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["fin-invoices"],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const { data: historicalExpenses = [] } = useQuery({
    queryKey: ["historical-expenses"],
    queryFn: () => base44.entities.HistoricalExpense.list("-date", 500),
  });

  const { data: backlogData } = useQuery({
    queryKey: ["contract-backlog"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getContractBacklog", {});
      return res.data;
    },
  });

  // ── Ranges ──
  const range = useMemo(() => getRange(preset, customRange), [preset, customRange]);

  // ── Match snapshot for current period ──
  const snapshot = useMemo(() => {
    if (!allSnapshots.length) return null;
    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    function sumSnaps(snaps) {
      const revenue = snaps.reduce((s,r) => s+(r.revenue??0), 0);
      const cogs = snaps.reduce((s,r) => s+(r.cogs??0), 0);
      const gross_profit = snaps.reduce((s,r) => s+(r.gross_profit??0), 0);
      const operating_expenses = snaps.reduce((s,r) => s+(r.operating_expenses??0), 0);
      const net_profit = snaps.reduce((s,r) => s+(r.net_profit??0), 0);
      const labor_cost = snaps.reduce((s,r) => s+(r.labor_cost??0), 0);
      const labor_revenue = snaps.reduce((s,r) => s+(r.labor_revenue??0), 0);
      const direct_labor_cost = snaps.reduce((s,r) => s+(r.direct_labor_cost??0), 0);
      return {
        revenue, cogs, gross_profit,
        gross_margin: revenue > 0 ? (gross_profit/revenue)*100 : 0,
        operating_expenses, net_profit,
        net_margin: revenue > 0 ? (net_profit/revenue)*100 : 0,
        labor_cost, labor_revenue, direct_labor_cost
      };
    }

    // Quarterly presets — find quarterly record or sum 3 monthly records
    if (["q1","q2","q3","q4"].includes(preset)) {
      const year = new Date().getFullYear();
      const qLabel = { q1:"Q1", q2:"Q2", q3:"Q3", q4:"Q4" }[preset];
      const quarterly = allSnapshots.find(s => s.period === `${qLabel} ${year}`);
      if (quarterly) return quarterly;
      const monthIdxs = { q1:[0,1,2], q2:[3,4,5], q3:[6,7,8], q4:[9,10,11] }[preset];
      const monthly = allSnapshots.filter(s =>
        s.period_type === "monthly" &&
        monthIdxs.some(m => s.period === `${MONTH_NAMES[m]} ${year}`)
      );
      return monthly.length ? sumSnaps(monthly) : null;
    }

    // Full year presets — sum all monthly records for that year
    if (preset.startsWith("year_")) {
      const yr = preset.replace("year_", "");
      const monthly = allSnapshots.filter(s =>
        s.period_type === "monthly" && s.period_start && s.period_start.startsWith(`${yr}-`)
      );
      return monthly.length ? sumSnaps(monthly) : null;
    }

    // YTD and year_to_last_month — sum monthly records from Jan 1 current year
    if (preset === "ytd" || preset === "year_to_last_month") {
      const yr = new Date().getFullYear();
      const endDate = preset === "ytd" ? new Date() : endOfMonth(subMonths(new Date(), 1));
      const endStr = endDate.toISOString().split("T")[0];
      const monthly = allSnapshots.filter(s =>
        s.period_type === "monthly" &&
        s.period_start &&
        s.period_start >= `${yr}-01-01` &&
        s.period_start <= endStr
      );
      return monthly.length ? sumSnaps(monthly) : null;
    }

    // last_month / this_month — find single monthly record
    if (preset === "last_month" || preset === "this_month") {
      const d = preset === "last_month" ? subMonths(new Date(), 1) : new Date();
      const periodStr = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      return allSnapshots.find(s => s.period === periodStr) || null;
    }

    // Custom — sum monthly records within the custom date range
    if (preset === "custom") {
      const startStr = customRange.start.toISOString().split("T")[0];
      const endStr = customRange.end.toISOString().split("T")[0];
      const monthly = allSnapshots.filter(s =>
        s.period_type === "monthly" &&
        s.period_start && s.period_start >= startStr && s.period_start <= endStr
      );
      return monthly.length ? sumSnaps(monthly) : null;
    }

    return null;
  }, [allSnapshots, preset, customRange]);



  // ── Labor data from FinancialSnapshot ──
  const laborData = useMemo(() => {
    if (!snapshot) return { laborRevenue: 0, laborCost: 0 };
    
    const laborRevenue = snapshot.labor_revenue || 0;
    const laborCost = snapshot.direct_labor_cost || 0;
    
    return {
      laborRevenue,
      laborCost,
    };
  }, [snapshot]);

  // ── KPI calculations ──
  const kpi = useMemo(() => {
    if (!snapshot) {
      return {
        revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0,
        netProfit: 0, netMargin: 0,
        laborProfit: 0, laborMargin: 0,
        projectedRevenue: 0, ytdBilled: 0, remainingBacklog: 0, isCurrentYear: false, isHistoricalYear: false,
      };
    }

    const currentYear = new Date().getFullYear();
    const isHistoricalYear = preset.startsWith("year_") || 
      (preset === "custom" && customRange.start.getFullYear() < currentYear);

    const revenue = snapshot.revenue || 0;
    const cogs = snapshot.cogs || 0;
    const grossProfit = snapshot.gross_profit || 0;
    const netProfit = snapshot.net_profit || 0;
    const grossMargin = snapshot.gross_margin > 1 ? snapshot.gross_margin : (snapshot.gross_margin || 0) * 100;
    const netMargin = snapshot.net_margin > 1 ? snapshot.net_margin : (snapshot.net_margin || 0) * 100;
    
    // Labor Profit from snapshot data
    const laborProfit = laborData.laborRevenue - laborData.laborCost;
    const laborMargin = laborData.laborRevenue > 0 ? (laborProfit / laborData.laborRevenue) * 100 : 0;

    // Check if selected period is in current year (exclude full-year historical presets)
    const isCurrentYear = range.start.getFullYear() === currentYear && !isHistoricalYear;

    // Projected revenue: only for current year
    let projectedYearEnd = 0;
    let ytdBilled = 0;
    let remainingBacklog = 0;
    if (isCurrentYear) {
      ytdBilled = invoices.filter(i => i.status === "paid" && inRange(i.date_sent, range)).reduce((s, i) => s + (i.amount || 0), 0);
      remainingBacklog = contracts
        .filter(c => c.status === "active" && c.forecast_status !== "lost")
        .reduce((sum, c) => {
          const contractVal = c.adjusted_value || c.contract_value || 0;
          const invoiced = c.total_invoiced || 0;
          const remaining = Math.max(0, contractVal - invoiced);
          return sum + remaining;
        }, 0);
      projectedYearEnd = ytdBilled + remainingBacklog;
    }

    return {
      revenue, cogs, grossProfit, grossMargin,
      netProfit, netMargin,
      laborProfit, laborMargin,
      projectedRevenue: isHistoricalYear ? null : projectedYearEnd, 
      ytdBilled, remainingBacklog, isCurrentYear, isHistoricalYear,
    };
  }, [snapshot, invoices, contracts, range, laborData, preset, customRange]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("qbSync", {});
      queryClient.invalidateQueries({ queryKey: ["fin-all-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["fin-invoices"] });
      setSyncResult({ status: "success", message: res.data?.message ?? "Sync complete." });
      setLastSynced(new Date());
    } catch (e) {
      setSyncResult({ status: "error", message: e?.message ?? "Sync failed." });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div>
          <h1 className="text-2xl font-bold tracking-wider uppercase font-barlow text-foreground">Financial Dashboard</h1>
          {lastSynced && (
            <p className="text-xs text-muted-foreground mt-0.5">Last synced: {format(lastSynced, "MMM d, yyyy h:mm a")}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {syncResult && (
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border ${syncResult.status === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {syncResult.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {syncResult.message}
            </div>
          )}
          <Link to="/pl-verification">
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              P&L Verification
            </Button>
          </Link>
          <Button onClick={() => setExportModalOpen(true)} variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" />
            Export & Share
          </Button>
          <Button onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync with QuickBooks"}
          </Button>
        </div>
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-20 bg-card border-b shadow-sm px-6 py-3">
        <FilterBar
          preset={preset} setPreset={setPreset}
          customRange={customRange} setCustomRange={setCustomRange}
          range={range}
        />
      </div>

      <div className="px-6 py-6 space-y-8">
        {!snapshot && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-sm text-yellow-800 font-medium">No data uploaded for this period</p>
            <p className="text-xs text-yellow-700 mt-1">Upload a P&L CSV to see financial metrics</p>
          </div>
        )}

        {snapshot && (
          <>
            {/* KPI Stat Cards - 3 column grid */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Revenue" primary={fmt(kpi.revenue)} />
              <StatCard label="COGS" primary={fmt(kpi.cogs)} accentColor="#DC2626" />
              <StatCard label="Gross Profit / Gross Margin" primary={fmt(kpi.grossProfit)} secondary={fmtPct(kpi.grossMargin)} />
              <StatCard label="Net Profit / Net Margin" primary={fmt(kpi.netProfit)} secondary={fmtPct(kpi.netMargin)} />
              <StatCard
                label="Labor Profit / Labor Margin"
                primary={fmt(kpi.laborProfit)}
                secondary={fmtPct(kpi.laborMargin)}
                accentColor={kpi.laborMargin > 30 ? "#10b981" : kpi.laborMargin > 15 ? "#f59e0b" : "#ef4444"}
              />
              <div className="bg-white border rounded-lg p-5 shadow-sm" style={{ borderTop: `4px solid #C9A96E` }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Projected Year-End Revenue</p>
                {kpi.isHistoricalYear ? (
                  <>
                    <p className="text-2xl font-bold text-gray-400 mb-2">—</p>
                    <p className="text-xs text-gray-500">Historical Period</p>
                  </>
                ) : kpi.isCurrentYear ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900 mb-2">{fmt(kpi.projectedRevenue)}</p>
                    <div className="space-y-0.5 text-xs text-gray-600">
                      <p>YTD Billed  {fmt(kpi.ytdBilled)}</p>
                      <p>Backlog       {fmt(kpi.remainingBacklog)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-400 mb-2">N/A</p>
                    <p className="text-xs text-gray-500">Projections only available for current year</p>
                  </>
                )}
              </div>
            </div>

            {/* Profit & Loss Section */}
            <ProfitLossSection preset={preset} range={range} snapshots={allSnapshots} />

            {/* Labor P&L Table */}
            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Labor P&L</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b bg-white">
                    <td className="px-5 py-3 text-gray-700">Labor Revenue</td>
                    <td className="px-5 py-3 text-right text-gray-900 font-semibold">{fmt(laborData.laborRevenue)}</td>
                  </tr>
                  <tr className="border-b bg-gray-50">
                    <td className="px-5 py-3 text-gray-700">Direct Labor Cost</td>
                    <td className="px-5 py-3 text-right text-gray-900 font-semibold">{fmt(laborData.laborCost)}</td>
                  </tr>
                  <tr className="border-b bg-white">
                    <td className="px-5 py-3 text-gray-900 font-semibold">Labor Profit</td>
                    <td className="px-5 py-3 text-right text-gray-900 font-bold">{fmt(kpi.laborProfit)}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-5 py-3 text-gray-900 font-semibold">Labor Margin %</td>
                    <td className="px-5 py-3 text-right text-gray-900 font-bold">{fmtPct(kpi.laborMargin)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {!preset.startsWith("year_") && (
          <GoalsSection allSnapshots={allSnapshots} contracts={backlogData?.contracts ?? contracts} />
        )}

        <ContractBacklogTable />

        <DataImportSection onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["fin-all-snapshots"] });
        }} />
      </div>

      <ExportShareModal open={exportModalOpen} onOpenChange={setExportModalOpen} currentPreset={preset} currentRange={range} />
    </div>
  );
}