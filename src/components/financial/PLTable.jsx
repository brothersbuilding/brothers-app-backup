import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export default function PLTable({ kpi, curExpenses, compExpenses }) {
  const curOpex = curExpenses.filter(e => ["operating", "overhead"].includes(e.expense_type));
  const compOpex = compExpenses.filter(e => ["operating", "overhead"].includes(e.expense_type));

  const curCats = groupByCategory(curOpex);
  const compCats = groupByCategory(compOpex);
  const allCats = Array.from(new Set([...Object.keys(curCats), ...Object.keys(compCats)]));

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Profit & Loss</h2>
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-48">Line Item</TableHead>
              <TableHead className="text-right">Current Period</TableHead>
              <TableHead className="text-right">Comparison</TableHead>
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