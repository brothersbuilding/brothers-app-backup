import React, { useMemo } from "react";
import { startOfMonth, endOfMonth, subMonths, format, isWithinInterval, parseISO } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try {
    return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end });
  } catch { return false; }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ProfitLossSection({ preset, range, snapshots }) {
  const plData = useMemo(() => {
    if (!snapshots) return null;

    // Helper to detect record type from period string
    const getPeriodType = (period) => {
      if (/^Q[1-4] \d{4}$/.test(period)) return "quarterly";
      if (/^Full Year \d{4}$/.test(period)) return "annual";
      return "monthly";
    };

    // Quarterly presets: show monthly + quarterly total
    if (["q1", "q2", "q3", "q4"].includes(preset)) {
      const quarterMap = { q1: [0, 1, 2], q2: [3, 4, 5], q3: [6, 7, 8], q4: [9, 10, 11] };
      const monthIndices = quarterMap[preset];
      const year = new Date().getFullYear();
      const monthLabels = monthIndices.map(i => MONTHS[i]);
      const quarterNum = Math.floor(monthIndices[0] / 3) + 1;
      const quarterKey = `Q${quarterNum} ${year}`;

      // Find monthly snapshots
      const monthlySnapshots = monthLabels.map(m => 
        snapshots.find(s => s.period === `${m} ${year}` && getPeriodType(s.period) === "monthly")
      );

      // Find quarterly snapshot
      const quarterlySnapshot = snapshots.find(s => s.period === quarterKey && getPeriodType(s.period) === "quarterly");

      // If quarterly doesn't exist, sum the 3 monthly records
      const qTotalData = quarterlySnapshot || (monthlySnapshots.every(s => s) ? {
        revenue: monthlySnapshots.reduce((s, snap) => s + (snap?.revenue || 0), 0),
        cogs: monthlySnapshots.reduce((s, snap) => s + (snap?.cogs || 0), 0),
        gross_profit: monthlySnapshots.reduce((s, snap) => s + (snap?.gross_profit || 0), 0),
        operating_expenses: monthlySnapshots.reduce((s, snap) => s + (snap?.operating_expenses || 0), 0),
        net_profit: monthlySnapshots.reduce((s, snap) => s + (snap?.net_profit || 0), 0),
        gross_margin: monthlySnapshots.reduce((s, snap) => s + (snap?.gross_profit || 0), 0) / monthlySnapshots.reduce((s, snap) => s + (snap?.revenue || 0), 1) * 100,
        net_margin: monthlySnapshots.reduce((s, snap) => s + (snap?.net_profit || 0), 0) / monthlySnapshots.reduce((s, snap) => s + (snap?.revenue || 0), 1) * 100,
      } : null);

      const columns = [
        { label: monthLabels[0], data: monthlySnapshots[0] || null },
        { label: monthLabels[1], data: monthlySnapshots[1] || null },
        { label: monthLabels[2], data: monthlySnapshots[2] || null },
        { label: "Q Total", data: qTotalData, isTotalCol: true },
      ];

      return { type: "quarterly", columns };
    }

    // Yearly presets: sum ONLY monthly records within the period
    if (["ytd", "year_to_last_month"].includes(preset)) {
      const year = new Date().getFullYear();
      
      // Filter for monthly records only within range
      const monthlyInRange = snapshots.filter(s => 
        getPeriodType(s.period) === "monthly" && inRange(s.period_start, range)
      );

      // YTD total = sum of monthly records only
      const ytdData = {
        revenue: monthlyInRange.reduce((s, snap) => s + (snap?.revenue || 0), 0),
        cogs: monthlyInRange.reduce((s, snap) => s + (snap?.cogs || 0), 0),
        gross_profit: monthlyInRange.reduce((s, snap) => s + (snap?.gross_profit || 0), 0),
        operating_expenses: monthlyInRange.reduce((s, snap) => s + (snap?.operating_expenses || 0), 0),
        net_profit: monthlyInRange.reduce((s, snap) => s + (snap?.net_profit || 0), 0),
        gross_margin: monthlyInRange.length > 0 ? (monthlyInRange.reduce((s, snap) => s + (snap?.gross_profit || 0), 0) / monthlyInRange.reduce((s, snap) => s + (snap?.revenue || 0), 1)) * 100 : 0,
        net_margin: monthlyInRange.length > 0 ? (monthlyInRange.reduce((s, snap) => s + (snap?.net_profit || 0), 0) / monthlyInRange.reduce((s, snap) => s + (snap?.revenue || 0), 1)) * 100 : 0,
      };

      const columns = [{ label: "YTD Total", data: ytdData, isTotalCol: true }];
      return { type: "yearly", columns };
    }

    // Monthly (this_month or last_month): use single monthly record
    if (["this_month", "last_month"].includes(preset)) {
      const snapshot = snapshots.find(s => inRange(s.period_start, range) && getPeriodType(s.period) === "monthly");
      return {
        type: "monthly",
        columns: [{ label: format(range.start, "MMM yyyy"), data: snapshot || null }],
      };
    }

    // Custom range: sum ONLY monthly records within the date range
    const monthlyInRange = snapshots.filter(s => 
      getPeriodType(s.period) === "monthly" && inRange(s.period_start, range)
    );

    const customData = {
      revenue: monthlyInRange.reduce((s, snap) => s + (snap.revenue || 0), 0),
      cogs: monthlyInRange.reduce((s, snap) => s + (snap.cogs || 0), 0),
      gross_profit: monthlyInRange.reduce((s, snap) => s + (snap.gross_profit || 0), 0),
      operating_expenses: monthlyInRange.reduce((s, snap) => s + (snap.operating_expenses || 0), 0),
      net_profit: monthlyInRange.reduce((s, snap) => s + (snap.net_profit || 0), 0),
      gross_margin: monthlyInRange.length > 0 ? (monthlyInRange.reduce((s, snap) => s + (snap.gross_profit || 0), 0) / monthlyInRange.reduce((s, snap) => s + (snap.revenue || 0), 1)) * 100 : 0,
      net_margin: monthlyInRange.length > 0 ? (monthlyInRange.reduce((s, snap) => s + (snap.net_profit || 0), 0) / monthlyInRange.reduce((s, snap) => s + (snap.revenue || 0), 1)) * 100 : 0,
    };
    return { type: "custom", columns: [{ label: "Total", data: customData, isTotalCol: true }] };
  }, [preset, snapshots, range]);

  if (!plData) return null;

  const rows = [
    { key: "revenue", label: "Revenue" },
    { key: "cogs", label: "Cost of Goods Sold (COGS)" },
    { key: "gross_profit", label: "Gross Profit", isBold: true, showMargin: "gross_margin" },
    { key: "operating_expenses", label: "Operating Expenses" },
    { key: "net_profit", label: "Net Profit", isBold: true, showMargin: "net_margin" },
  ];

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b" style={{ background: "#1C2331" }}>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Profit & Loss</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#1C2331" }}>
              <th className="text-left px-4 py-2 text-white font-semibold text-xs uppercase tracking-wide w-48">Line Item</th>
              {plData.columns.map((col, i) => (
                <th
                  key={i}
                  className="text-right px-4 py-2 text-white font-semibold text-xs uppercase tracking-wide"
                  style={{ background: col.isTotalCol ? "#2C3347" : "#1C2331" }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.key} style={{ background: rowIdx % 2 === 0 ? "#fff" : "#F7F6F3" }}>
                <td className="text-left px-4 py-2.5" style={{ fontWeight: row.isBold ? 700 : 400, color: "#1A1A1A" }}>
                  {row.label}
                </td>
                {plData.columns.map((col, colIdx) => {
                  const value = col.data?.[row.key];
                  const marginValue = col.data?.[row.showMargin];
                  const isTotalCol = col.isTotalCol;

                  return (
                    <td
                      key={colIdx}
                      className="text-right px-4 py-2.5"
                      style={{
                        background: isTotalCol ? "#F7F6F3" : undefined,
                        fontWeight: row.isBold ? 700 : 400,
                      }}
                    >
                      {value === undefined || value === null ? (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      ) : (
                        <div>
                          <span style={{ color: value < 0 ? "#DC2626" : "#1A1A1A" }}>
                            {fmt(value)}
                          </span>
                          {row.showMargin && marginValue !== undefined && (
                            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                              {fmtPct(marginValue)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}