import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseISO, isWithinInterval } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try { return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end }); } catch { return false; }
}

const CONTRACT_TYPE_LABELS = {
  res_gc: "Residential GC",
  com_gc: "Commercial GC",
  sub_cont: "Sub Contract",
};

function ContractTypeBadge({ type }) {
  const styles = {
    res_gc: "bg-blue-100 text-blue-800",
    com_gc: "bg-purple-100 text-purple-800",
    sub_cont: "bg-orange-100 text-orange-800",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[type] ?? "bg-muted text-muted-foreground"}`}>
      {CONTRACT_TYPE_LABELS[type] ?? type ?? "—"}
    </span>
  );
}

export default function RevenueByProject({ invoices, range }) {
  const { data: contracts = [] } = useQuery({
    queryKey: ["fin-contracts"],
    queryFn: () => base44.entities.Contract.list(),
  });

  const contractMap = useMemo(() => {
    const map = {};
    contracts.forEach(c => {
      if (c.project_name) map[c.project_name] = c;
    });
    return map;
  }, [contracts]);
  const grouped = useMemo(() => {
    const map = {};
    for (const inv of invoices.filter(i => inRange(i.date_sent, range) || (i.status !== "paid" && inRange(i.due_date, range)))) {
      const p = inv.project || "(No Project)";
      if (!map[p]) map[p] = { project: p, totalInvoiced: 0, totalPaid: 0, outstanding: 0 };
      map[p].totalInvoiced += inv.amount ?? 0;
      if (inv.status === "paid") map[p].totalPaid += inv.amount ?? 0;
      else map[p].outstanding += inv.open_balance ?? inv.amount ?? 0;
    }
    
    const projectRows = Object.values(map).sort((a, b) => b.totalPaid - a.totalPaid);
    
    // Group by contract type
    const byType = { res_gc: [], com_gc: [], sub_cont: [], other: [] };
    projectRows.forEach(row => {
      const contract = contractMap[row.project];
      const type = contract?.contract_type || "other";
      byType[type].push({ ...row, contractType: type });
    });
    
    return byType;
  }, [invoices, range, contractMap]);

  const allRows = useMemo(() => [
    ...grouped.res_gc,
    ...grouped.com_gc,
    ...grouped.sub_cont,
    ...grouped.other,
  ], [grouped]);

  const renderTypeSection = (type, rows, label) => {
    if (rows.length === 0) return null;
    
    const subtotal = {
      totalInvoiced: rows.reduce((s, r) => s + r.totalInvoiced, 0),
      totalPaid: rows.reduce((s, r) => s + r.totalPaid, 0),
      outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    };

    return (
      <React.Fragment key={type}>
        <TableRow className="bg-muted/70 font-semibold">
          <TableCell className="text-xs">{label}</TableCell>
          <TableCell className="text-xs text-right">{fmt(subtotal.totalInvoiced)}</TableCell>
          <TableCell className="text-xs text-right text-green-700">{fmt(subtotal.totalPaid)}</TableCell>
          <TableCell className="text-xs text-right text-red-600">{fmt(subtotal.outstanding)}</TableCell>
        </TableRow>
        {rows.map(r => (
          <TableRow key={r.project} className="hover:bg-muted/20 text-xs">
            <TableCell className="pl-8">{r.project}</TableCell>
            <TableCell className="text-right">{fmt(r.totalInvoiced)}</TableCell>
            <TableCell className="text-right text-green-700">{fmt(r.totalPaid)}</TableCell>
            <TableCell className="text-right text-red-600">{fmt(r.outstanding)}</TableCell>
          </TableRow>
        ))}
      </React.Fragment>
    );
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Revenue by Project (Grouped by Contract Type)</h2>
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Project</TableHead>
                <TableHead className="text-xs text-right">Invoiced</TableHead>
                <TableHead className="text-xs text-right">Paid</TableHead>
                <TableHead className="text-xs text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTypeSection("res_gc", grouped.res_gc, "Residential GC")}
              {renderTypeSection("com_gc", grouped.com_gc, "Commercial GC")}
              {renderTypeSection("sub_cont", grouped.sub_cont, "Sub Contract")}
              {renderTypeSection("other", grouped.other, "Unclassified")}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}