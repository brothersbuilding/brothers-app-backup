import React, { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { subMonths, subQuarters, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, format, parseISO, isWithinInterval } from "date-fns";

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  try { return isWithinInterval(parseISO(dateStr), { start, end }); } catch { return false; }
}

function buildMonthlyData(invoices, expenses) {
  return Array.from({ length: 12 }, (_, i) => {
    const monthStart = startOfMonth(subMonths(new Date(), 11 - i));
    const monthEnd = endOfMonth(monthStart);
    const label = format(monthStart, "MMM yy");

    const revenue = invoices
      .filter(inv => inv.status === "paid" && inRange(inv.date_sent, monthStart, monthEnd))
      .reduce((s, inv) => s + (inv.amount ?? 0), 0);

    const cogs = expenses
      .filter(e => e.expense_type === "cogs" && inRange(e.date, monthStart, monthEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const labor = expenses
      .filter(e => e.expense_type === "labor" && inRange(e.date, monthStart, monthEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const opex = expenses
      .filter(e => ["operating", "overhead"].includes(e.expense_type) && inRange(e.date, monthStart, monthEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(1)) : null;
    const netProfit = revenue - cogs - labor - opex;
    const netMargin = revenue > 0 ? parseFloat(((netProfit / revenue) * 100).toFixed(1)) : null;

    return { label, revenue, grossMargin, netMargin };
  });
}

function buildQuarterlyData(invoices, expenses) {
  return Array.from({ length: 5 }, (_, i) => {
    const qStart = startOfQuarter(subQuarters(new Date(), 4 - i));
    const qEnd = endOfQuarter(qStart);
    const label = `Q${Math.floor(qStart.getMonth() / 3) + 1} ${format(qStart, "yy")}`;

    const revenue = invoices
      .filter(inv => inv.status === "paid" && inRange(inv.date_sent, qStart, qEnd))
      .reduce((s, inv) => s + (inv.amount ?? 0), 0);

    const cogs = expenses
      .filter(e => e.expense_type === "cogs" && inRange(e.date, qStart, qEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const labor = expenses
      .filter(e => e.expense_type === "labor" && inRange(e.date, qStart, qEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const opex = expenses
      .filter(e => ["operating", "overhead"].includes(e.expense_type) && inRange(e.date, qStart, qEnd))
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(1)) : null;
    const netProfit = revenue - cogs - labor - opex;
    const netMargin = revenue > 0 ? parseFloat(((netProfit / revenue) * 100).toFixed(1)) : null;

    return { label, revenue, grossMargin, netMargin };
  });
}

const fmtRev = (n) => `$${Math.round(n / 1000)}k`;

export default function ChartsRow({ invoices, expenses }) {
  const monthlyData = useMemo(() => buildMonthlyData(invoices, expenses), [invoices, expenses]);
  const quarterlyData = useMemo(() => buildQuarterlyData(invoices, expenses), [invoices, expenses]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trends (Last 12 Months)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue — monthly */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">Monthly Revenue</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtRev} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#1C2331" name="Revenue" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gross & Net Margin — quarterly */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">Quarterly Gross & Net Margin %</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={quarterlyData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v, name) => [`${v !== null ? v.toFixed(1) : "—"}%`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="grossMargin" stroke="#C9A96E" strokeWidth={2} dot={{ r: 4 }} name="Gross Margin %" connectNulls />
              <Line type="monotone" dataKey="netMargin" stroke="#1C2331" strokeWidth={2} dot={{ r: 4 }} name="Net Margin %" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}