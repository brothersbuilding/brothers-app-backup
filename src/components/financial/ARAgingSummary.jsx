import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { differenceInDays, parseISO, format } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

function ageDays(dueDateStr) {
  if (!dueDateStr) return 0;
  return Math.max(0, differenceInDays(new Date(), parseISO(dueDateStr)));
}

function effectiveBalance(inv) {
  return inv.open_balance != null ? inv.open_balance : (inv.amount ?? 0);
}

const BUCKETS = [
  { key: "0-30", label: "0–30 Days", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  { key: "31-60", label: "31–60 Days", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  { key: "61-90", label: "61–90 Days", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "90+", label: "90+ Days", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
];

function bucket(inv) {
  const d = ageDays(inv.due_date);
  if (d <= 30) return "0-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

export default function ARAgingSummary({ invoices }) {
  const unpaid = useMemo(() => invoices.filter(i => i.status === "unpaid" || i.status === "partial"), [invoices]);

  const bucketTotals = useMemo(() => {
    const totals = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    unpaid.forEach(inv => { totals[bucket(inv)] += effectiveBalance(inv); });
    return totals;
  }, [unpaid]);

  const totalOutstanding = useMemo(() => unpaid.reduce((s, i) => s + effectiveBalance(i), 0), [unpaid]);

  const top5 = useMemo(() =>
    [...unpaid].sort((a, b) => ageDays(b.due_date) - ageDays(a.due_date)).slice(0, 5),
    [unpaid]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">AR Aging Summary</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Buckets */}
        <div className="space-y-3">
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
            <p className="text-2xl font-bold text-foreground">{fmt(totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground">{unpaid.length} invoices</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {BUCKETS.map(b => (
              <div key={b.key} className={`rounded-xl border p-3 shadow-sm ${b.bg} ${b.border}`}>
                <p className="text-xs text-muted-foreground mb-1">{b.label}</p>
                <p className={`text-lg font-bold ${b.color}`}>{fmt(bucketTotals[b.key])}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 most overdue */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <p className="text-xs font-semibold text-foreground px-4 pt-4 pb-2">Top 5 Most Overdue</p>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Invoice #</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs text-right">Balance</TableHead>
                <TableHead className="text-xs text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top5.map(inv => (
                <TableRow key={inv.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs font-mono">{inv.invoice_number || "—"}</TableCell>
                  <TableCell className="text-xs">{inv.customer || "—"}</TableCell>
                  <TableCell className="text-xs text-right font-medium text-red-600">{fmt(effectiveBalance(inv))}</TableCell>
                  <TableCell className="text-xs text-right text-red-600 font-semibold">{ageDays(inv.due_date)}d</TableCell>
                </TableRow>
              ))}
              {top5.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-4">No overdue invoices</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}