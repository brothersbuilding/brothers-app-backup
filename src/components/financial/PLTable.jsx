import React from "react";
import { format, parseISO, differenceInDays, getQuarter, getYear } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function getCompRangeLabel(compRange, comparison) {
  if (!compRange?.start || !compRange?.end) return null;
  const start = typeof compRange.start === "string" ? parseISO(compRange.start) : compRange.start;
  const end = typeof compRange.end === "string" ? parseISO(compRange.end) : compRange.end;

  // Full year check: Jan 1 – Dec 31
  if (
    start.getMonth() === 0 && start.getDate() === 1 &&
    end.getMonth() === 11 && end.getDate() === 31
  ) {
    return `Full Year ${getYear(start)}`;
  }

  // Full quarter check: spans exactly one quarter
  const qStart = start.getMonth() === 0 ? 0 : start.getMonth() === 3 ? 3 : start.getMonth() === 6 ? 6 : start.getMonth() === 9 ? 9 : null;
  if (
    qStart !== null &&
    start.getDate() === 1 &&
    end.getMonth() === qStart + 2 &&
    end.getDate() >= 28
  ) {
    const q = Math.floor(qStart / 3) + 1;
    const monthRange = [
      format(start, "MMM"),
      format(end, "MMM"),
    ];
    return `Q${q} ${getYear(start)} (${monthRange[0]} – ${monthRange[1]})`;
  }

  // Default: exact date range
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

function variance(cur, comp) {
  const dollar = cur - comp;
  const pct = comp !== 0 ? ((cur - comp) / Math.abs(comp)) * 100 : null;
  return { dollar, pct };
}

function PLRow({ label, cur, comp, isPercent, higherIsBetter = true, indent = false, bold = false }) {
  const v = variance(cur, comp);
  const improving = v.dollar !== 0 ? (higherIsBetter ? v.dollar > 0 : v.dollar < 0) : null;
  const color = improving === null ? "" : improving ? "text-green-600" : "text-red-500";

  return (
    <TableRow className={bold ? "bg-muted/40 font-semibold" : "hover:bg-muted/20"}>
      <TableCell className={`text-sm ${bold ? "font-semibold" : ""} ${indent ? "pl-8" : ""}`}>{label}</TableCell>
      <TableCell className={`text-sm text-right ${bold ? "font-semibold" : ""}`}>
        {isPercent ? fmtPct(cur) : fmt(cur)}
      </TableCell>
      <TableCell className="text-sm text-right text-muted-foreground">
        {isPercent ? fmtPct(comp) : fmt(comp)}
      </TableCell>
      <TableCell className={`text-sm text-right font-medium ${color}`}>
        {isPercent ? (v.dollar >= 0 ? "+" : "") + fmtPct(v.dollar) : (v.dollar >= 0 ? "+" : "") + fmt(v.dollar)}
      </TableCell>
      <TableCell className={`text-sm text-right ${color}`}>
        {v.pct !== null ? `${v.pct >= 0 ? "+" : ""}${v.pct.toFixed(1)}%` : "—"}
      </TableCell>
    </TableRow>
  );
}

function sumByTypes(expenses, types) {
  return expenses.filter(e => types.includes(e.expense_type)).reduce((s, e) => s + (e.amount ?? 0), 0);
}

function groupByCategory(expenses) {
  const map = {};
  for (const e of expenses) {
    const cat = e.category || "Uncategorized";
    map[cat] = (map[cat] ?? 0) + (e.amount ?? 0);
  }
  return map;
}

export default function PLTable({ kpi, curExpenses, compExpenses, compRange, comparison }) {
  const curOpex = curExpenses.filter(e => ["operating", "overhead"].includes(e.expense_type));
  const compOpex = compExpenses.filter(e => ["operating", "overhead"].includes(e.expense_type));

  const curCats = groupByCategory(curOpex);
  const compCats = groupByCategory(compOpex);
  const allCats = Array.from(new Set([...Object.keys(curCats), ...Object.keys(compCats)]));

  const compLabel = getCompRangeLabel(compRange, comparison);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Profit & Loss</h2>
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-48">Line Item</TableHead>
              <TableHead className="text-right">Current Period</TableHead>
              <TableHead className="text-right">
                <div>Comparison</div>
                {compLabel && <div className="text-xs font-normal text-muted-foreground">{compLabel}</div>}
              </TableHead>
              <TableHead className="text-right">$ Change</TableHead>
              <TableHead className="text-right">% Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <PLRow label="Revenue" cur={kpi.revenue} comp={kpi.compRevenue} bold />
            <PLRow label="Cost of Goods Sold (COGS)" cur={kpi.cogs} comp={kpi.compCogs} higherIsBetter={false} />
            <PLRow label="Gross Profit" cur={kpi.grossProfit} comp={kpi.compGrossProfit} bold />
            <PLRow label="Gross Margin %" cur={kpi.grossMargin} comp={kpi.compGrossMargin} isPercent />
            <TableRow><TableCell colSpan={5} className="text-xs font-semibold text-muted-foreground pt-4 pb-1 uppercase">Operating Expenses</TableCell></TableRow>
            {allCats.map(cat => (
              <PLRow key={cat} label={cat} cur={curCats[cat] ?? 0} comp={compCats[cat] ?? 0} higherIsBetter={false} indent />
            ))}
            <PLRow label="Labor Cost" cur={kpi.labor} comp={kpi.compLabor} higherIsBetter={false} />
            <PLRow label="Total Expenses" cur={kpi.totalExpenses} comp={kpi.compTotalExpenses} higherIsBetter={false} bold />
            <PLRow label="Net Profit" cur={kpi.netProfit} comp={kpi.compNetProfit} bold />
            <PLRow label="Net Margin %" cur={kpi.netMargin} comp={kpi.compNetMargin} isPercent />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}