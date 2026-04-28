import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, subYears, parseISO, isWithinInterval, differenceInDays, format } from "date-fns";
import { RefreshCw, CheckCircle2, AlertCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import FilterBar from "@/components/financial/FilterBar";
import GoalsSection from "@/components/financial/GoalsSection";
import KPICards from "@/components/financial/KPICards";
import ChartsRow from "@/components/financial/ChartsRow";
import PLTable from "@/components/financial/PLTable";
import LaborPL from "@/components/financial/LaborPL";
import ExpectedRevenue from "@/components/financial/ExpectedRevenue";
import BudgetVsActual from "@/components/financial/BudgetVsActual";
import RevenueByCustomer from "@/components/financial/RevenueByCustomer";
import RevenueByProject from "@/components/financial/RevenueByProject";
import ARAgingSummary from "@/components/financial/ARAgingSummary";
import BalanceSheetSnapshot from "@/components/financial/BalanceSheetSnapshot";
import ExportShareModal from "@/components/financial/ExportShareModal";
import DataImportSection from "@/components/financial/DataImportSection";
import ContractBacklogTable from "@/components/financial/ContractBacklogTable";
import MonthlyRevenueForecast from "@/components/financial/MonthlyRevenueForecast";

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
  const { data: invoices = [] } = useQuery({
    queryKey: ["fin-invoices"],
    queryFn: () => base44.entities.Invoice.list("-updated_date", 2000),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["fin-expenses"],
    queryFn: () => base44.entities.Expense.list("-date", 2000),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["fin-payments"],
    queryFn: () => base44.entities.Payment.list("-date", 2000),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["fin-employees"],
    queryFn: () => base44.entities.Employee.list(),
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["fin-contracts"],
    queryFn: () => base44.entities.Contract.list(),
  });
  const { data: snapshot } = useQuery({
    queryKey: ["fin-snapshot", preset],
    queryFn: async () => {
      const range = getRange(preset, customRange);
      // Determine period string from range
      const startMonth = range.start.getMonth();
      const year = range.start.getFullYear();
      let periodStr = '';
      if (startMonth === 0 && range.end.getMonth() === 2) periodStr = `Q1 ${year}`;
      else if (startMonth === 3 && range.end.getMonth() === 5) periodStr = `Q2 ${year}`;
      else if (startMonth === 6 && range.end.getMonth() === 8) periodStr = `Q3 ${year}`;
      else if (startMonth === 9 && range.end.getMonth() === 11) periodStr = `Q4 ${year}`;
      
      if (periodStr) {
        const snapshots = await base44.entities.FinancialSnapshot.filter({ period: periodStr });
        return snapshots.length > 0 ? snapshots[0] : null;
      }
      return null;
    },
  });
  const headcount = employees.length;

  // ── Ranges ──
  const range = useMemo(() => getRange(preset, customRange), [preset, customRange]);
  const compRange = useMemo(() => getComparisonRange(range, comparison), [range, comparison]);

  // ── Current period data ──
  const paidInvoices = useMemo(() => invoices.filter(i => i.status === "paid"), [invoices]);
  const curRevInvoices = useMemo(() => filterByRange(paidInvoices, "date_sent", range), [paidInvoices, range]);
  const compRevInvoices = useMemo(() => filterByRange(paidInvoices, "date_sent", compRange), [paidInvoices, compRange]);

  const curExpenses = useMemo(() => filterByRange(expenses, "date", range), [expenses, range]);
  const compExpenses = useMemo(() => filterByRange(expenses, "date", compRange), [expenses, compRange]);

  // ── KPI calculations ──
  const kpi = useMemo(() => {
    // Use FinancialSnapshot if available for this period
    if (snapshot) {
      const revenue = snapshot.revenue || 0;
      const cogs = snapshot.cogs || 0;
      const labor = snapshot.labor_cost || 0;
      const opex = snapshot.operating_expenses || 0;
      const grossProfit = snapshot.gross_profit || 0;
      const netProfit = snapshot.net_profit || 0;
      const grossMargin = snapshot.gross_margin || 0;
      const netMargin = snapshot.net_margin || 0;
      
      // For comparison, use previous period live calculations
      const compRevenue = sumField(compRevInvoices, "amount");
      const compCogs = sumField(compExpenses.filter(e => e.expense_type === "cogs"), "amount");
      const compLabor = sumField(compExpenses.filter(e => e.expense_type === "labor"), "amount");
      const compOpex = sumField(compExpenses.filter(e => ["operating", "overhead"].includes(e.expense_type)), "amount");
      const compGrossProfit = compRevenue - compCogs;
      const compNetProfit = compRevenue - compCogs - compLabor - compOpex;
      const compGrossMargin = compRevenue > 0 ? (compGrossProfit / compRevenue) * 100 : 0;
      const compNetMargin = compRevenue > 0 ? (compNetProfit / compRevenue) * 100 : 0;
      const compRevPerHead = headcount > 0 ? compRevenue / headcount : 0;
      
      const daysElapsed = Math.max(1, differenceInDays(new Date(), startOfYear(new Date())));
      const ytdRevenue = sumField(filterByRange(paidInvoices, "date_sent", { start: startOfYear(new Date()), end: new Date() }), "amount");
      const projectedYearEnd = (ytdRevenue / daysElapsed) * 365;

      return {
        revenue, compRevenue,
        cogs, compCogs,
        grossProfit, compGrossProfit,
        grossMargin, compGrossMargin,
        labor, compLabor,
        opex, compOpex,
        netProfit, compNetProfit,
        netMargin, compNetMargin,
        revPerHead: headcount > 0 ? revenue / headcount : 0,
        compRevPerHead,
        projectedYearEnd,
        totalExpenses: cogs + labor + opex,
        compTotalExpenses: compCogs + compLabor + compOpex,
      };
    }

    // Calculate live from invoices and expenses
    const revenue = sumField(curRevInvoices, "amount");
    const compRevenue = sumField(compRevInvoices, "amount");

    const cogs = sumField(curExpenses.filter(e => e.expense_type === "cogs"), "amount");
    const compCogs = sumField(compExpenses.filter(e => e.expense_type === "cogs"), "amount");

    const labor = sumField(curExpenses.filter(e => e.expense_type === "labor"), "amount");
    const compLabor = sumField(compExpenses.filter(e => e.expense_type === "labor"), "amount");

    const opex = sumField(curExpenses.filter(e => ["operating", "overhead"].includes(e.expense_type)), "amount");
    const compOpex = sumField(compExpenses.filter(e => ["operating", "overhead"].includes(e.expense_type)), "amount");

    const grossProfit = revenue - cogs;
    const compGrossProfit = compRevenue - compCogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const compGrossMargin = compRevenue > 0 ? (compGrossProfit / compRevenue) * 100 : 0;

    const totalExpenses = cogs + labor + opex;
    const compTotalExpenses = compCogs + compLabor + compOpex;
    const netProfit = revenue - totalExpenses;
    const compNetProfit = compRevenue - compTotalExpenses;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const compNetMargin = compRevenue > 0 ? (compNetProfit / compRevenue) * 100 : 0;

    const revPerHead = headcount > 0 ? revenue / headcount : 0;
    const compRevPerHead = headcount > 0 ? compRevenue / headcount : 0;

    const daysElapsed = Math.max(1, differenceInDays(new Date(), startOfYear(new Date())));
    const ytdRevenue = sumField(filterByRange(paidInvoices, "date_sent", { start: startOfYear(new Date()), end: new Date() }), "amount");
    
    // Use sum of projected_revenue_this_year from active on_track and reduced_scope contracts + YTD invoiced
    const activeContracts = contracts.filter(c => c.status === 'active' && ['on_track', 'reduced_scope'].includes(c.forecast_status));
    const totalPaid = sumField(filterByRange(paidInvoices, "date_sent", { start: startOfYear(new Date()), end: new Date() }), "amount");
    const projectedYearEnd = totalPaid + (activeContracts.reduce((s, c) => s + (c.projected_revenue_this_year ?? 0), 0) || (ytdRevenue / daysElapsed) * 365);

    return {
      revenue, compRevenue,
      cogs, compCogs,
      grossProfit, compGrossProfit,
      grossMargin, compGrossMargin,
      labor, compLabor,
      opex, compOpex,
      netProfit, compNetProfit,
      netMargin, compNetMargin,
      revPerHead, compRevPerHead,
      projectedYearEnd,
      totalExpenses, compTotalExpenses,
    };
  }, [snapshot, curRevInvoices, compRevInvoices, curExpenses, compExpenses, headcount, paidInvoices, contracts]);


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
        <GoalsSection invoices={invoices} expenses={expenses} />

        <KPICards kpi={kpi} comparison={comparison} headcount={headcount} />

        <ChartsRow invoices={paidInvoices} expenses={expenses} />

        <PLTable kpi={kpi} curExpenses={curExpenses} compExpenses={compExpenses} range={range} compRange={compRange} />

        <LaborPL invoices={paidInvoices} expenses={expenses} range={range} compRange={compRange} />

        <ContractBacklogTable />

        <MonthlyRevenueForecast />

        <ExpectedRevenue invoices={invoices} />

        <BudgetVsActual range={range} />

        <RevenueByCustomer invoices={paidInvoices} range={range} />

        <RevenueByProject invoices={paidInvoices} range={range} />

        <ARAgingSummary invoices={invoices} />

        <BalanceSheetSnapshot />

        <DataImportSection onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["fin-expenses"] });
          queryClient.invalidateQueries({ queryKey: ["fin-payments"] });
        }} />
      </div>

      <ExportShareModal open={exportModalOpen} onOpenChange={setExportModalOpen} />
    </div>
  );
}