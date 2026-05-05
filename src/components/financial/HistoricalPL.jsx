import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { FileText } from "lucide-react";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
const fmtFull = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

const C = { navy: "#1C2331", gold: "#C9A96E" };

export default function HistoricalPL() {
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["historical-pl-snapshots"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-period_start", 200),
  });

  // Filter to only full-year snapshots from P&L import
  const annualSnaps = snapshots
    .filter(s => /^Full Year \d{4}$/.test(s.period))
    .sort((a, b) => a.period_start?.localeCompare(b.period_start));

  if (isLoading) return null;
  if (annualSnaps.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground mb-1">Historical P&L</h2>
          <p className="text-sm text-muted-foreground">No historical data yet. Import and save P&L data from the verification page.</p>
        </div>
        <Link to="/pl-verification" className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white" style={{ background: C.navy }}>
          <FileText className="w-4 h-4" />
          Go to P&L Verification
        </Link>
      </div>
    );
  }

  const chartData = annualSnaps.map(s => ({
    year: s.period.replace("Full Year ", ""),
    Revenue: s.revenue ?? 0,
    "Gross Profit": s.gross_profit ?? 0,
    "Net Income": s.net_profit ?? 0,
  }));

  const rows = [
    { label: "Revenue", key: "revenue", fmt: fmtFull },
    { label: "COGS", key: "cogs", fmt: fmtFull },
    { label: "Gross Profit", key: "gross_profit", fmt: fmtFull, isTotal: true },
    { label: "Gross Margin %", key: "gross_margin", fmt: fmtPct },
    { label: "Operating Expenses", key: "operating_expenses", fmt: fmtFull },
    { label: "Labor Cost", key: "labor_cost", fmt: fmtFull },
    { label: "Net Income", key: "net_profit", fmt: fmtFull, isTotal: true },
    { label: "Net Margin %", key: "net_margin", fmt: fmtPct },
  ];

  return (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ background: C.navy }}>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Historical P&L — {annualSnaps[0]?.period.replace("Full Year ", "")} – {annualSnaps[annualSnaps.length - 1]?.period.replace("Full Year ", "")}</h2>
        <Link to="/pl-verification" className="text-xs text-white/70 hover:text-white flex items-center gap-1 transition-colors">
          <FileText className="w-3 h-3" />
          Update
        </Link>
      </div>

      {/* Chart */}
      <div className="p-4" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD6" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v, name) => [fmtFull(v), name]} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E2DDD6" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Revenue" fill={C.navy} radius={[2, 2, 0, 0]} />
            <Bar dataKey="Gross Profit" fill={C.gold} radius={[2, 2, 0, 0]} />
            <Bar dataKey="Net Income" fill="#15803D" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto border-t">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "#2C3347" }}>
              <th className="text-left px-4 py-2 text-white font-semibold uppercase tracking-wide w-40">Metric</th>
              {annualSnaps.map(s => (
                <th key={s.id} className="text-right px-4 py-2 text-white font-semibold">{s.period.replace("Full Year ", "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} style={{ background: row.isTotal ? "#F0EDE7" : i % 2 === 0 ? "#fff" : "#F7F6F3" }}>
                <td className="px-4 py-2 font-medium" style={{ color: "#1A1A1A", fontWeight: row.isTotal ? 700 : 400 }}>{row.label}</td>
                {annualSnaps.map(s => {
                  const v = s[row.key] ?? 0;
                  const isNeg = v < 0;
                  return (
                    <td key={s.id} className="text-right px-4 py-2 font-mono" style={{ color: isNeg ? "#DC2626" : "#1A1A1A", fontWeight: row.isTotal ? 700 : 400 }}>
                      {row.fmt(v)}
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