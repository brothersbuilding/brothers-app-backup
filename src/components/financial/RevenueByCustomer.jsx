import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseISO, isWithinInterval } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try { return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end }); } catch { return false; }
}

export default function RevenueByCustomer({ invoices, range }) {
  const allInvoices = useMemo(() => invoices.filter(i => inRange(i.date_sent, range)), [invoices, range]);

  const rows = useMemo(() => {
    const map = {};
    for (const inv of invoices.filter(i => inRange(i.date_sent, range) || (i.status !== "paid" && inRange(i.due_date, range)))) {
      const c = inv.customer || "(No Customer)";
      if (!map[c]) map[c] = { customer: c, totalInvoiced: 0, totalPaid: 0, outstanding: 0 };
      map[c].totalInvoiced += inv.amount ?? 0;
      if (inv.status === "paid") map[c].totalPaid += inv.amount ?? 0;
      else map[c].outstanding += inv.open_balance ?? inv.amount ?? 0;
    }
    return Object.values(map).sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 10);
  }, [invoices, range]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Revenue by Customer (Top 10)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="customer" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="totalPaid" fill="#16a34a" name="Paid" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-auto max-h-72">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs text-right">Invoiced</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.customer} className="hover:bg-muted/20">
                    <TableCell className="text-xs font-medium">{r.customer}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(r.totalInvoiced)}</TableCell>
                    <TableCell className="text-xs text-right text-green-700">{fmt(r.totalPaid)}</TableCell>
                    <TableCell className="text-xs text-right text-red-600">{fmt(r.outstanding)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}