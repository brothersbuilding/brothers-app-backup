import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { subMonths, startOfMonth, endOfMonth, format, parseISO, isWithinInterval } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

function inMonth(dateStr, start, end) {
  if (!dateStr) return false;
  try { return isWithinInterval(parseISO(dateStr), { start, end }); } catch { return false; }
}

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try { return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end }); } catch { return false; }
}

export default function LaborPL({ invoices, expenses, range, compRange }) {
  const curLabor = useMemo(() =>
    expenses.filter(e => e.expense_type === "labor" && inRange(e.date, range)).reduce((s, e) => s + (e.amount ?? 0), 0),
    [expenses, range]);

  const compLabor = useMemo(() =>
    expenses.filter(e => e.expense_type === "labor" && inRange(e.date, compRange)).reduce((s, e) => s + (e.amount ?? 0), 0),
    [expenses, compRange]);

  const curRevenue = useMemo(() =>
    invoices.filter(i => i.status === "paid" && inRange(i.date_sent, range)).reduce((s, i) => s + (i.amount ?? 0), 0),
    [invoices, range]);

  const compRevenue = useMemo(() =>
    invoices.filter(i => i.status === "paid" && inRange(i.date_sent, compRange)).reduce((s, i) => s + (i.amount ?? 0), 0),
    [invoices, compRange]);

  const curLaborPct = curRevenue > 0 ? (curLabor / curRevenue) * 100 : 0;
  const compLaborPct = compRevenue > 0 ? (compLabor / compRevenue) * 100 : 0;

  const trendData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const ms = startOfMonth(subMonths(new Date(), 11 - i));
    const me = endOfMonth(ms);
    const rev = invoices.filter(inv => inv.status === "paid" && inMonth(inv.date_sent, ms, me)).reduce((s, inv) => s + (inv.amount ?? 0), 0);
    const lab = expenses.filter(e => e.expense_type === "labor" && inMonth(e.date, ms, me)).reduce((s, e) => s + (e.amount ?? 0), 0);
    return { month: format(ms, "MMM yy"), laborCost: lab, laborPct: rev > 0 ? (lab / rev) * 100 : 0 };
  }), [invoices, expenses]);

  const improving = curLaborPct <= compLaborPct;

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Labor P&L</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Summary cards */}
        <div className="space-y-3">
          {[
            { label: "Labor Cost", cur: fmt(curLabor), comp: fmt(compLabor) },
            { label: "Revenue", cur: fmt(curRevenue), comp: fmt(compRevenue) },
            { label: "Labor % of Revenue", cur: fmtPct(curLaborPct), comp: fmtPct(compLaborPct), highlight: true },
          ].map(({ label, cur, comp, highlight }) => (
            <div key={label} className="bg-card border rounded-xl p-4 shadow-sm">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold ${highlight ? (improving ? "text-green-600" : "text-red-500") : "text-foreground"}`}>{cur}</p>
              <p className="text-xs text-muted-foreground">vs. {comp}</p>
            </div>
          ))}
        </div>

        {/* Trend chart */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">Labor % of Revenue (12 months)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip formatter={v => `${v.toFixed(1)}%`} />
              <Line type="monotone" dataKey="laborPct" stroke="#d97706" strokeWidth={2} dot={false} name="Labor %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly table */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <p className="text-xs font-semibold text-foreground px-4 pt-4 mb-2">Monthly Labor Breakdown</p>
          <div className="overflow-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Month</TableHead>
                  <TableHead className="text-xs text-right">Labor Cost</TableHead>
                  <TableHead className="text-xs text-right">% of Rev</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trendData.map(row => (
                  <TableRow key={row.month} className="hover:bg-muted/20">
                    <TableCell className="text-xs">{row.month}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(row.laborCost)}</TableCell>
                    <TableCell className="text-xs text-right">{fmtPct(row.laborPct)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}