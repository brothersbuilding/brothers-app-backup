import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, subYears, parseISO, isWithinInterval, differenceInDays, format } from "date-fns";
import { RefreshCw, CheckCircle2, AlertCircle, Share2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

import FilterBar from "@/components/financial/FilterBar";
import GoalsSection from "@/components/financial/GoalsSection";
import KPICards from "@/components/financial/KPICards";
import ChartsRow from "@/components/financial/ChartsRow";
import PLTable from "@/components/financial/PLTable";
import LaborPL from "@/components/financial/LaborPL";
import BudgetVsActual from "@/components/financial/BudgetVsActual";
import RevenueByCustomer from "@/components/financial/RevenueByCustomer";
import RevenueByProject from "@/components/financial/RevenueByProject";
import ARAgingSummary from "@/components/financial/ARAgingSummary";
import BalanceSheetSnapshot from "@/components/financial/BalanceSheetSnapshot";
import ExportShareModal from "@/components/financial/ExportShareModal";
import DataImportSection from "@/components/financial/DataImportSection";
import ContractBacklogTable from "@/components/financial/ContractBacklogTable";
import HistoricalPL from "@/components/financial/HistoricalPL";

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

// Determine default preset: current quarter if within one, else YTD
function getDefaultPreset() {
  const m = new Date().getMonth(); // 0-indexed
  if (m <= 2) return "q1";
  if (m <= 5) return "q2";
  if (m <= 8) return "q3";
  if (m <= 11) return "q4";
  return "ytd";
}

function getComparisonRange(range, comparison) {
  const len = differenceInDays(range.end, range.start);
  switch (comparison) {
    case "previous_period":
      return { start: subDays(range.start, len + 1), end: subDays(range.start, 1) };
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
      return { start: subDays(range.start, len + 1), end: subDays(range.start, 1) };
  }
}

function subDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try {
    return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end });
  } catch { return false; }
}

// ── Aggregate helpers ─────────────────────────────────────────────────────────
function sumField(records, field) {
  return records.reduce((s, r) => s + (r[field] ?? 0), 0);
}

function filterByRange(records, dateField, range) {
  return records.filter(r => inRange(r[dateField], range));
}

export default function FinancialDashboard() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState(getDefaultPreset);
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
    queryFn: () => base44.entities.FinancialSnapshot.list("-period_start", 200),
  });
  const { data: snapshot } = useQuery({
    queryKey: ["fin-snapshot", preset],
    queryFn: async () => {
      const range = getRange(preset, customRange);
      const startMonth = range.start.getMonth();
      const year = range.start.getFullYear();
      let periodStr = '';
      if (startMonth === 0 && range.end.getMonth() === 2) periodStr = `Q1 ${year}`;
      else if (startMonth === 3 && range.end.getMonth() === 5) periodStr = `Q2 ${year}`;
      else if (startMonth === 6 && range.end.getMonth() === 8) periodStr = `Q3 ${year}`;
      else if (startMonth === 9 && range.end.getMonth() === 11) periodStr = `Q4 ${year}`;
      else if (preset === 'ytd' || preset === 'year_to_last_month') periodStr = `Full Year ${year}`;

      if (periodStr) {
        const snapshots = await base44.entities.FinancialSnapshot.filter({ period: periodStr });
        return snapshots.length > 0 ? snapshots[0] : null;
      }
      return null;
    },
  });



  // ── Ranges ──
  const range = useMemo(() => getRange(preset, customRange), [preset, customRange]);

  // ── KPI calculations ──
  const kpi = useMemo(() => {
    if (!snapshot) {
      // No data uploaded for this period
      return {
        revenue: 0, compRevenue: 0,
        cogs: 0, compCogs: 0,
        grossProfit: 0, compGrossProfit: 0,
        grossMargin: 0, compGrossMargin: 0,
        labor: 0, compLabor: 0,
        opex: 0, compOpex: 0,
        netProfit: 0, compNetProfit: 0,
        netMargin: 0, compNetMargin: 0,
        revPerHead: 0, compRevPerHead: 0,
        totalExpenses: 0, compTotalExpenses: 0,
      };
    }

    // Use uploaded snapshot data
    const revenue = snapshot.revenue || 0;
    const cogs = snapshot.cogs || 0;
    const labor = snapshot.labor_cost || 0;
    const opex = snapshot.operating_expenses || 0;
    const grossProfit = snapshot.gross_profit || 0;
    const netProfit = snapshot.net_profit || 0;
    const grossMargin = snapshot.gross_margin || 0;
    const netMargin = snapshot.net_margin || 0;
    
    // Find comparison period snapshot
    const compSnapshot = allSnapshots.find(s => {
      const compRange = getComparisonRange(range, comparison);
      if (!s.period_start) return false;
      const snapDate = parseISO(s.period_start);
      return isWithinInterval(snapDate, { start: compRange.start, end: compRange.end });
    });

    const compRevenue = compSnapshot?.revenue || 0;
    const compCogs = compSnapshot?.cogs || 0;
    const compLabor = compSnapshot?.labor_cost || 0;
    const compOpex = compSnapshot?.operating_expenses || 0;
    const compGrossProfit = compSnapshot?.gross_profit || 0;
    const compNetProfit = compSnapshot?.net_profit || 0;
    const compGrossMargin = compSnapshot?.gross_margin || 0;
    const compNetMargin = compSnapshot?.net_margin || 0;

    const totalExpenses = cogs + labor + opex;
    const compTotalExpenses = compCogs + compLabor + compOpex;

    return {
      revenue, compRevenue,
      cogs, compCogs,
      grossProfit, compGrossProfit,
      grossMargin, compGrossMargin,
      labor, compLabor,
      opex, compOpex,
      netProfit, compNetProfit,
      netMargin, compNetMargin,
      revPerHead: 0,
      compRevPerHead: 0,
      totalExpenses, compTotalExpenses,
    };
  }, [snapshot, allSnapshots, range, comparison]);


  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("qbSync", {});
      queryClient.invalidateQueries({ queryKey: ["fin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["fin-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["fin-payments"] });
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
        <KPICards kpi={kpi} comparison={comparison} />

        <ChartsRow snapshots={allSnapshots} preset={preset} />

        <PLTable kpi={kpi} />

        <HistoricalPL />

        <ContractBacklogTable />

        <DataImportSection onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["fin-all-snapshots"] });
          queryClient.invalidateQueries({ queryKey: ["fin-snapshot"] });
        }} />
      </div>

      <ExportShareModal open={exportModalOpen} onOpenChange={setExportModalOpen} currentPreset={preset} currentRange={range} />
    </div>
  );
}