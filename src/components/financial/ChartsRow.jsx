import React, { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, subQuarters, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, format, parseISO, isWithinInterval } from "date-fns";

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  try { return isWithinInterval(parseISO(dateStr), { start, end }); } catch { return false; }
}

function buildMonthlyRevenue(invoices) {
  return Array.from({ length: 12 }, (_, i) => {
    const monthStart = startOfMonth(subMonths(new Date(), 11 - i));
    const monthEnd = endOfMonth(monthStart);
    const label = format(monthStart, "MMM yy");
    const revenue = invoices
      .filter(inv => inv.status === "paid" && inRange(inv.date_sent, monthStart, monthEnd))
      .reduce((s, inv) => s + (inv.amount ?? 0), 0);
    return { label, revenue };
  });
}

// Build quarterly margin data, preferring uploaded P&L snapshots over live expense calculations
function buildQuarterlyMargins(invoices, expenses, snapshots) {
  // Index snapshots: "Q1 2025" -> snapshot, also "Full Year 2025" for annual fallback
  const snapByQuarter = {};
  snapshots.forEach(s => {
    if (s.period) snapByQuarter[s.period] = s;
    // Also index "Full Year YYYY" snapshots keyed by year
    const m = s.period?.match(/^Full Year (\d{4})$/);
    if (m) snapByQuarter[`year_${m[1]}`] = s;
  });

  return Array.from({ length: 5 }, (_, i) => {
    const qStart = startOfQuarter(subQuarters(new Date(), 4 - i));
    const qEnd = endOfQuarter(qStart);
    const qNum = Math.floor(qStart.getMonth() / 3) + 1;
    const year = format(qStart, "yyyy");
    const label = `Q${qNum} ${format(qStart, "yy")}`;

    // Try to find a matching snapshot: "Q1 2025", "Q1 2026", etc.
    const snapKey = `Q${qNum} ${year}`;
    const snap = snapByQuarter[snapKey];

    if (snap && snap.gross_margin != null && snap.net_margin != null) {
      return {
        label,
        grossMargin: parseFloat((snap.gross_margin).toFixed(1)),
        netMargin: parseFloat((snap.net_margin).toFixed(1)),
      };
    }

    // Fall back to live calculation from invoices/expenses
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

    // Only show live calculation if there's actually expense data; otherwise null
    const hasExpenses = cogs + labor + opex > 0;
    const grossMargin = revenue > 0 && hasExpenses ? parseFloat(((revenue - cogs) / revenue * 100).toFixed(1)) : null;
    const netMargin = revenue > 0 && hasExpenses ? parseFloat(((revenue - cogs - labor - opex) / revenue * 100).toFixed(1)) : null;

    return { label, grossMargin, netMargin };
  });
}

const fmtRev = (n) => `$${Math.round(n / 1000)}k`;

export default function ChartsRow({ invoices, expenses, snapshots = [] }) {
  const monthlyData = useMemo(() => buildMonthlyRevenue(invoices), [invoices]);
  const quarterlyData = useMemo(() => buildQuarterlyMargins(invoices, expenses, snapshots), [invoices, expenses, snapshots]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trends (Last 12 Months)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

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

        {/* Gross Margin % — quarterly */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">Quarterly Gross Margin %</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={quarterlyData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => [`${v !== null ? v.toFixed(1) : "—"}%`, "Gross Margin"]} />
              <Line type="monotone" dataKey="grossMargin" stroke="#C9A96E" strokeWidth={2} dot={{ r: 4 }} name="Gross Margin %" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Net Margin % — quarterly */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">Quarterly Net Margin %</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={quarterlyData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => [`${v !== null ? v.toFixed(1) : "—"}%`, "Net Margin"]} />
              <Line type="monotone" dataKey="netMargin" stroke="#1C2331" strokeWidth={2} dot={{ r: 4 }} name="Net Margin %" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}