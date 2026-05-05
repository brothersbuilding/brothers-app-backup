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
    case "custom":            return custom;
    default:                  return { start: new Date(y, 0, 1), end: now };
  }
}

function getDefaultPreset() {
  const m = new Date().getMonth();
  if (m <= 2) return "q1";
  if (m <= 5) return "q2";
  if (m <= 8) return "q3";
  if (m <= 11) return "q4";
  return "ytd";
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

// Formatting helpers
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
const fmtDelta = (cur, prev) => {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

// ── Stat Card Component ─────────────────────────────────────────────────────
function StatCard({ label, primary, secondary, comparison, comparisonPct, accentColor = "#C9A96E" }) {
  const improving = comparisonPct !== null && comparisonPct !== undefined ? comparisonPct >= 0 : null;
  
  return (
    <div className="bg-white border rounded-lg p-5 shadow-sm" style={{ borderTop: `4px solid ${accentColor}` }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{label}</p>
      <div className="flex items-baseline gap-3 mb-2">
        <p className="text-2xl font-bold text-gray-900">{primary}</p>
        {secondary && <p className="text-lg text-gray-600">{secondary}</p>}
      </div>
      {comparison !== null && comparison !== undefined && (
        <div className="flex items-center gap-1.5 text-xs">
          {improving !== null && (
            improving ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )
          )}
          <span className="text-gray-500">{comparison}</span>
          {comparisonPct !== null && comparisonPct !== undefined && (
            <span className={improving ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
              {comparisonPct >= 0 ? "+" : ""}{comparisonPct.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function FinancialDashboard() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState(getDefaultPreset());
  const [comparison, setComparison] = useState("previous_period");
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

  // ── Ranges ──
  const range = useMemo(() => getRange(preset, customRange), [preset, customRange]);

  // ── Match snapshot for current period ──
  const snapshot = useMemo(() => {
    if (preset === "custom" || preset === "ytd" || preset === "year_to_last_month") {
      // Sum all monthly snapshots in range
      const matching = allSnapshots.filter(s => {
        if (!s.period_start) return false;
        return inRange(s.period_start, range);
      });
      if (matching.length === 0) return null;
      // Aggregate
      return {
        revenue: sumField(matching, "revenue"),
        cogs: sumField(matching, "cogs"),
        gross_profit: sumField(matching, "gross_profit"),
        gross_margin: matching.length > 0 ? matching[0].gross_margin : 0,
        operating_expenses: sumField(matching, "operating_expenses"),
        labor_cost: sumField(matching, "labor_cost"),
        net_profit: sumField(matching, "net_profit"),
        net_margin: matching.length > 0 ? matching[0].net_margin : 0,
      };
    }
    // For specific months/quarters, try exact match first
    let periodStr = "";
    if (preset === "this_month" || preset === "last_month") {
      periodStr = format(range.start, "MMM yyyy");
    } else if (preset === "q1") periodStr = "Q1 2026";
    else if (preset === "q2") periodStr = "Q2 2026";
    else if (preset === "q3") periodStr = "Q3 2026";
    else if (preset === "q4") periodStr = "Q4 2026";

    if (periodStr) {
      const exact = allSnapshots.find(s => s.period === periodStr);
      if (exact) return exact;
      // Fallback: sum constituent months
      const matching = allSnapshots.filter(s => {
        if (!s.period_start) return false;
        return inRange(s.period_start, range);
      });
      if (matching.length === 0) return null;
      return {
        revenue: sumField(matching, "revenue"),
        cogs: sumField(matching, "cogs"),
        gross_profit: sumField(matching, "gross_profit"),
        gross_margin: matching.length > 0 ? matching[0].gross_margin : 0,
        operating_expenses: sumField(matching, "operating_expenses"),
        labor_cost: sumField(matching, "labor_cost"),
        net_profit: sumField(matching, "net_profit"),
        net_margin: matching.length > 0 ? matching[0].net_margin : 0,
      };
    }
    return null;
  }, [allSnapshots, preset, range]);

  // ── Match comparison snapshot ──
  const compSnapshot = useMemo(() => {
    if (!snapshot) return null;
    const compRange = getComparisonRange(range, comparison);
    const matching = allSnapshots.filter(s => {
      if (!s.period_start) return false;
      return inRange(s.period_start, compRange);
    });
    if (matching.length === 0) return null;
    return {
      revenue: sumField(matching, "revenue"),
      cogs: sumField(matching, "cogs"),
      gross_profit: sumField(matching, "gross_profit"),
      gross_margin: matching.length > 0 ? matching[0].gross_margin : 0,
      operating_expenses: sumField(matching, "operating_expenses"),
      labor_cost: sumField(matching, "labor_cost"),
      net_profit: sumField(matching, "net_profit"),
      net_margin: matching.length > 0 ? matching[0].net_margin : 0,
    };
  }, [snapshot, allSnapshots, range, comparison]);

  // ── KPI calculations ──
  const kpi = useMemo(() => {
    if (!snapshot) {
      return {
        revenue: 0, compRevenue: 0,
        cogs: 0, compCogs: 0,
        grossProfit: 0, compGrossProfit: 0,
        grossMargin: 0, compGrossMargin: 0,
        labor: 0, compLabor: 0,
        netProfit: 0, compNetProfit: 0,
        netMargin: 0, compNetMargin: 0,
        laborProfit: 0, compLaborProfit: 0,
        laborMargin: 0, compLaborMargin: 0,
        projectedRevenue: 0,
        ytdBilled: 0,
        backlog: 0,
      };
    }

    const revenue = snapshot.revenue || 0;
    const cogs = snapshot.cogs || 0;
    const labor = snapshot.labor_cost || 0;
    const grossProfit = snapshot.gross_profit || 0;
    const netProfit = snapshot.net_profit || 0;
    const grossMargin = snapshot.gross_margin > 1 ? snapshot.gross_margin : (snapshot.gross_margin || 0) * 100;
    const netMargin = snapshot.net_margin > 1 ? snapshot.net_margin : (snapshot.net_margin || 0) * 100;
    
    const laborProfit = revenue - labor;
    const laborMargin = revenue > 0 ? (laborProfit / revenue) * 100 : 0;

    const compRevenue = compSnapshot?.revenue || 0;
    const compCogs = compSnapshot?.cogs || 0;
    const compLabor = compSnapshot?.labor_cost || 0;
    const compGrossProfit = compSnapshot?.gross_profit || 0;
    const compNetProfit = compSnapshot?.net_profit || 0;
    const compGrossMargin = compSnapshot && compSnapshot.gross_margin > 1 ? compSnapshot.gross_margin : (compSnapshot?.gross_margin || 0) * 100;
    const compNetMargin = compSnapshot && compSnapshot.net_margin > 1 ? compSnapshot.net_margin : (compSnapshot?.net_margin || 0) * 100;
    
    const compLaborProfit = compRevenue - compLabor;
    const compLaborMargin = compRevenue > 0 ? (compLaborProfit / compRevenue) * 100 : 0;

    // Projected revenue: YTD billed + remaining active/reduced_scope contract backlog
    const ytdBilled = invoices.filter(i => i.status === "paid" && inRange(i.date_sent, range)).reduce((s, i) => s + (i.amount || 0), 0);
    const activeContracts = contracts.filter(c => ["on_track", "reduced_scope"].includes(c.forecast_status));
    const backlog = sumField(activeContracts, "remaining_value");
    const projectedRevenue = ytdBilled + backlog;

    return {
      revenue, compRevenue,
      cogs, compCogs,
      grossProfit, compGrossProfit,
      grossMargin, compGrossMargin,
      labor, compLabor,
      netProfit, compNetProfit,
      netMargin, compNetMargin,
      laborProfit, compLaborProfit,
      laborMargin, compLaborMargin,
      projectedRevenue,
      ytdBilled,
      backlog,
    };
  }, [snapshot, compSnapshot, invoices, contracts, range]);

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
          comparison={comparison} setComparison={setComparison}
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
              <StatCard
                label="Revenue"
                primary={fmt(kpi.revenue)}
                comparison={fmt(kpi.compRevenue)}
                comparisonPct={fmtDelta(kpi.revenue, kpi.compRevenue)}
              />
              <StatCard
                label="COGS"
                primary={fmt(kpi.cogs)}
                comparison={fmt(kpi.compCogs)}
                comparisonPct={fmtDelta(kpi.cogs, kpi.compCogs)}
                accentColor="#DC2626"
              />
              <StatCard
                label="Gross Profit / Gross Margin"
                primary={fmt(kpi.grossProfit)}
                secondary={fmtPct(kpi.grossMargin)}
                comparison={`${fmt(kpi.compGrossProfit)} / ${fmtPct(kpi.compGrossMargin)}`}
                comparisonPct={fmtDelta(kpi.grossProfit, kpi.compGrossProfit)}
              />

              <StatCard
                label="Net Profit / Net Margin"
                primary={fmt(kpi.netProfit)}
                secondary={fmtPct(kpi.netMargin)}
                comparison={`${fmt(kpi.compNetProfit)} / ${fmtPct(kpi.compNetMargin)}`}
                comparisonPct={fmtDelta(kpi.netProfit, kpi.compNetProfit)}
              />
              <StatCard
                label="Labor Profit / Labor Margin"
                primary={fmt(kpi.laborProfit)}
                secondary={fmtPct(kpi.laborMargin)}
                comparison={`${fmt(kpi.compLaborProfit)} / ${fmtPct(kpi.compLaborMargin)}`}
                comparisonPct={fmtDelta(kpi.laborProfit, kpi.compLaborProfit)}
                accentColor={kpi.laborMargin > 40 ? "#10b981" : kpi.laborMargin > 25 ? "#f59e0b" : "#ef4444"}
              />
              <StatCard
                label="Projected Year-End Revenue"
                primary={fmt(kpi.projectedRevenue)}
                comparison={`YTD Billed: ${fmt(kpi.ytdBilled)} / Remaining Backlog: ${fmt(kpi.backlog)}`}
              />
            </div>

            {/* Labor P&L Table */}
            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Labor P&L</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b bg-white">
                    <td className="px-5 py-3 text-gray-700">Labor Cost</td>
                    <td className="px-5 py-3 text-right text-gray-900 font-semibold">{fmt(kpi.labor)}</td>
                  </tr>
                  <tr className="border-b bg-gray-50">
                    <td className="px-5 py-3 text-gray-700">Total Revenue</td>
                    <td className="px-5 py-3 text-right text-gray-900 font-semibold">{fmt(kpi.revenue)}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-5 py-3 text-gray-900 font-semibold">Labor as % of Revenue</td>
                    <td className="px-5 py-3 text-right text-gray-900 font-bold">{kpi.revenue > 0 ? fmtPct((kpi.labor / kpi.revenue) * 100) : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
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