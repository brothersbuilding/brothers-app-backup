import React, { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, subQuarters, subYears, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format, parseISO, isWithinInterval } from "date-fns";

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

// Determine period type from preset
function getPeriodType(preset) {
  if (["this_month", "last_month"].includes(preset)) return "month";
  if (["q1", "q2", "q3", "q4"].includes(preset)) return "quarter";
  return "year"; // ytd, year_to_last_month, custom
}

// Get the "anchor" date for the selected preset (the end of that period)
function getAnchorDate(preset) {
  const now = new Date();
  const y = now.getFullYear();
  switch (preset) {
    case "this_month": return endOfMonth(now);
    case "last_month": return endOfMonth(subMonths(now, 1));
    case "q1": return new Date(y, 2, 31);
    case "q2": return new Date(y, 5, 30);
    case "q3": return new Date(y, 8, 30);
    case "q4": return new Date(y, 11, 31);
    default: return endOfYear(now); // year-based
  }
}

// Build last-4 margin data points based on period type
function buildMarginData(snapshots, preset) {
  const periodType = getPeriodType(preset);
  const anchor = getAnchorDate(preset);

  if (periodType === "month") {
    // Walk back from anchor finding 4 months that have snapshot data
    const result = [];
    let current = anchor;
    let attempts = 0;
    while (result.length < 4 && attempts < 24) {
      const key = format(current, "MMM yyyy");
      const snap = snapshots.find(s => s.period === key);
      if (snap) {
        result.unshift({
          label: format(current, "MMM yy"),
          grossMargin: snap.gross_margin != null ? parseFloat(snap.gross_margin.toFixed(1)) : null,
          netMargin: snap.net_margin != null ? parseFloat(snap.net_margin.toFixed(1)) : null,
        });
      }
      current = subMonths(current, 1);
      attempts++;
    }
    return result;
  }

  if (periodType === "quarter") {
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const buildQuarter = (qAnchor) => {
      const qEnd = endOfQuarter(qAnchor);
      const qStart = startOfQuarter(qEnd);
      const qNum = Math.floor(qStart.getMonth() / 3) + 1;
      const year = format(qStart, "yyyy");
      const label = `Q${qNum} ${format(qStart, "yy")}`;
      const monthsInQ = [0, 1, 2].map(m => `${MONTH_NAMES[qStart.getMonth() + m]} ${year}`);
      const qSnaps = snapshots.filter(s => monthsInQ.includes(s.period));
      if (qSnaps.length === 0) return null;
      const revenue = qSnaps.reduce((s, x) => s + (x.revenue ?? 0), 0);
      const grossProfit = qSnaps.reduce((s, x) => s + (x.gross_profit ?? 0), 0);
      const netProfit = qSnaps.reduce((s, x) => s + (x.net_profit ?? 0), 0);
      const grossMargin = revenue > 0 ? parseFloat((grossProfit / revenue * 100).toFixed(1)) : null;
      const netMargin = revenue > 0 ? parseFloat((netProfit / revenue * 100).toFixed(1)) : null;
      return { label, grossMargin, netMargin };
    };

    // Walk back from anchor until we find 4 quarters with data
    const result = [];
    let current = anchor;
    let attempts = 0;
    while (result.length < 4 && attempts < 12) {
      const q = buildQuarter(current);
      if (q) result.unshift(q);
      current = subQuarters(current, 1);
      attempts++;
    }
    return result;
  }

  // Year: last 4 full years
  const annual = snapshots
    .filter(s => /^Full Year \d{4}$/.test(s.period))
    .sort((a, b) => a.period_start?.localeCompare(b.period_start))
    .slice(-4);

  return annual.map(s => ({
    label: s.period.replace("Full Year ", ""),
    grossMargin: s.gross_margin != null ? parseFloat(s.gross_margin.toFixed(1)) : null,
    netMargin: s.net_margin != null ? parseFloat(s.net_margin.toFixed(1)) : null,
  }));
}

function getPeriodLabel(preset) {
  const type = getPeriodType(preset);
  if (type === "month") return "Monthly";
  if (type === "quarter") return "Quarterly";
  return "Annual";
}

const fmtRev = (n) => `$${Math.round(n / 1000)}k`;

export default function ChartsRow({ invoices, expenses, snapshots = [], preset = "ytd" }) {
  const monthlyData = useMemo(() => buildMonthlyRevenue(invoices), [invoices]);
  const marginData = useMemo(() => buildMarginData(snapshots, preset), [snapshots, preset]);
  const periodLabel = getPeriodLabel(preset);

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

        {/* Gross Margin % */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">{periodLabel} Gross Margin % (Last 4)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={marginData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => [`${v !== null ? v.toFixed(1) : "—"}%`, "Gross Margin"]} />
              <Line type="monotone" dataKey="grossMargin" stroke="#C9A96E" strokeWidth={2} dot={{ r: 4 }} name="Gross Margin %" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Net Margin % */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-3">{periodLabel} Net Margin % (Last 4)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={marginData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
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