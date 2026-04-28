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
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-1 shadow-sm overflow-hidden min-w-0" style={{ minHeight: '140px' }}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
      <p className="font-bold text-foreground leading-tight" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)' }}>
        {isPercent ? fmtPct(value) : fmt(value)}
      </p>
      {footnote && <p className="text-xs text-muted-foreground mt-1 truncate">{footnote}</p>}
      {compValue !== undefined && (
        <div className="flex items-center gap-1 mt-1 min-w-0">
          {delta !== null && (
            improving
              ? <TrendingUp className="w-3 h-3 text-green-600 shrink-0" />
              : <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
          )}
          <span className="text-xs text-muted-foreground truncate" style={{ maxWidth: '100%' }}>
            {isPercent ? fmtPct(compValue) : fmt(compValue)}
          </span>
          {delta !== null && (
            <span className={`text-xs font-semibold shrink-0 ${improving ? "text-green-600" : "text-red-500"}`}>
              {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function KPICards({ kpi, headcount }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Key Metrics</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
        <KPICard label="Revenue" value={kpi.revenue} compValue={kpi.compRevenue} />
        <KPICard label="COGS" value={kpi.cogs} compValue={kpi.compCogs} higherIsBetter={false} />
        <KPICard label="Gross Profit" value={kpi.grossProfit} compValue={kpi.compGrossProfit} />
        <KPICard label="Gross Margin" value={kpi.grossMargin} compValue={kpi.compGrossMargin} isPercent />
        <KPICard label="Net Profit" value={kpi.netProfit} compValue={kpi.compNetProfit} />
        <KPICard label="Net Margin" value={kpi.netMargin} compValue={kpi.compNetMargin} isPercent />
        <KPICard label="Rev / Head" value={kpi.revPerHead} compValue={kpi.compRevPerHead} footnote={headcount ? `Based on ${headcount} employees` : null} />
        <KPICard label="Proj. Year-End Rev" value={kpi.projectedYearEnd} />
      </div>
    </div>
  );
}