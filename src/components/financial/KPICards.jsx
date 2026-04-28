import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
const fmtDelta = (cur, prev) => {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

function KPICard({ label, value, compValue, isPercent, higherIsBetter = true, footnote }) {
  const delta = fmtDelta(value, compValue);
  const improving = delta !== null ? (higherIsBetter ? delta >= 0 : delta <= 0) : null;

  return (
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-2 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground" style={{ fontSize: '11px' }}>
        {label}
      </p>
      <p className="font-bold text-foreground" style={{ fontSize: '20px', lineHeight: '1.2' }}>
        {isPercent ? fmtPct(value) : fmt(value)}
      </p>
      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
      {compValue !== undefined && (
        <div className="flex items-start gap-1.5" style={{ fontSize: '12px' }}>
          {delta !== null && (
            improving
              ? <TrendingUp className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              : <TrendingDown className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">
              {isPercent ? fmtPct(compValue) : fmt(compValue)}
            </span>
            {delta !== null && (
              <span className={`font-semibold ${improving ? "text-green-600" : "text-red-500"}`}>
                {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KPICards({ kpi, headcount }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Key Metrics</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Revenue" value={kpi.revenue} compValue={kpi.compRevenue} />
          <KPICard label="COGS" value={kpi.cogs} compValue={kpi.compCogs} higherIsBetter={false} />
          <KPICard label="Gross Profit" value={kpi.grossProfit} compValue={kpi.compGrossProfit} />
          <KPICard label="Gross Margin" value={kpi.grossMargin} compValue={kpi.compGrossMargin} isPercent />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Net Profit" value={kpi.netProfit} compValue={kpi.compNetProfit} />
          <KPICard label="Net Margin" value={kpi.netMargin} compValue={kpi.compNetMargin} isPercent />
          <KPICard label="Rev / Head" value={kpi.revPerHead} compValue={kpi.compRevPerHead} footnote={headcount ? `Based on ${headcount} employees` : null} />
          <KPICard label="Proj. Year-End Rev" value={kpi.projectedYearEnd} />
        </div>
      </div>
    </div>
  );
}