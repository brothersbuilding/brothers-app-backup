import React, { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { subMonths, startOfMonth, endOfMonth, format, parseISO, isWithinInterval } from "date-fns";

function inMonth(dateStr, start, end) {
  if (!dateStr) return false;
  try { return isWithinInterval(parseISO(dateStr), { start, end }); } catch { return false; }
}

function buildMonthlyData(invoices, expenses) {
  return Array.from({ length: 12 }, (_, i) => {
    const monthStart = startOfMonth(subMonths(new Date(), 11 - i));
    const monthEnd = endOfMonth(monthStart);
    const label = format(monthStart, "MMM yy");

    const revenue = invoices
      .filter(inv => inv.status === "paid" && inMonth(inv.date_sent, monthStart, monthEnd))
      .reduce((s, inv) => s + (inv.amount ?? 0), 0);

    const totalExpenses = expenses
      .filter(e => inMonth(e.date, monthStart, monthEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const cogs = expenses
      .filter(e => e.expense_type === "cogs" && inMonth(e.date, monthStart, monthEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const labor = expenses
      .filter(e => e.expense_type === "labor" && inMonth(e.date, monthStart, monthEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const laborPct = revenue > 0 ? (labor / revenue) * 100 : 0;

    return { label, revenue, totalExpenses, grossMargin, laborPct };
  });
}

const fmt = (n) => `$${Math.round(n / 1000)}k`;

export default function ChartsRow({ invoices, expenses }) {
  const data = useMemo(() => buildMonthlyData(invoices, expenses), [invoices, expenses]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trends (Last 12 Months)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue vs Expenses */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">Revenue vs Expenses</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="revenue" fill="#16a34a" name="Revenue" radius={[2, 2, 0, 0]} />
              <Bar dataKey="totalExpenses" fill="#ef4444" name="Expenses" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gross Margin % */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">Gross Margin %</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
              <Line type="monotone" dataKey="grossMargin" stroke="#2563eb" strokeWidth={2} dot={false} name="Gross Margin %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Labor Cost % */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">Labor Cost % of Revenue</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
              <Line type="monotone" dataKey="laborPct" stroke="#d97706" strokeWidth={2} dot={false} name="Labor %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}