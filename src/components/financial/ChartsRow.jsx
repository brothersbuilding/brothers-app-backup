import React, { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, startOfMonth, endOfMonth, format, parseISO, isWithinInterval } from "date-fns";

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

// Build annual margin data from the last 4 full-year snapshots
function buildAnnualMargins(snapshots) {
  // Filter to "Full Year YYYY" snapshots and sort ascending
  const annual = snapshots
    .filter(s => /^Full Year \d{4}$/.test(s.period))
    .sort((a, b) => a.period_start?.localeCompare(b.period_start));

  // Take last 4
  const last4 = annual.slice(-4);

  return last4.map(s => {
    const year = s.period.replace("Full Year ", "");
    return {
      label: year,
      grossMargin: s.gross_margin != null ? parseFloat(s.gross_margin.toFixed(1)) : null,
      netMargin: s.net_margin != null ? parseFloat(s.net_margin.toFixed(1)) : null,
    };
  });
}

const fmtRev = (n) => `$${Math.round(n / 1000)}k`;

export default function ChartsRow({ invoices, expenses, snapshots = [] }) {
  const monthlyData = useMemo(() => buildMonthlyRevenue(invoices), [invoices]);
  const quarterlyData = useMemo(() => buildAnnualMargins(snapshots), [snapshots]);

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
          <p className="text-xs font-semibold text-foreground mb-3">Annual Gross Margin %</p>
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
          <p className="text-xs font-semibold text-foreground mb-3">Annual Net Margin %</p>
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