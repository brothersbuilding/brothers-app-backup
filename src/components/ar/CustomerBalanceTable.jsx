import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

function effectiveBalance(inv) {
  return inv.open_balance != null ? inv.open_balance : (inv.amount ?? 0);
}

function SortableHead({ label, sortKey, sort, onSort, className }) {
  const active = sort.key === sortKey;
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : <span className="opacity-0"> ↑</span>}
      </span>
    </TableHead>
  );
}

export default function CustomerBalanceTable({ unpaidInvoices }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "balance", dir: "desc" });

  const onSort = (key) =>
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });

  // Group by customer
  const customerRows = useMemo(() => {
    const map = {};
    for (const inv of unpaidInvoices) {
      const customer = inv.customer || "(No Customer)";
      if (!map[customer]) map[customer] = { customer, count: 0, totalInvoiced: 0, balance: 0 };
      map[customer].count++;
      map[customer].totalInvoiced += inv.amount ?? 0;
      map[customer].balance += effectiveBalance(inv);
    }
    return Object.values(map);
  }, [unpaidInvoices]);

  const maxBalance = useMemo(() => Math.max(...customerRows.map((r) => r.balance), 0), [customerRows]);
  const totalBalance = useMemo(() => customerRows.reduce((s, r) => s + r.balance, 0), [customerRows]);
  const totalInvoiced = useMemo(() => customerRows.reduce((s, r) => s + r.totalInvoiced, 0), [customerRows]);
  const totalCount = useMemo(() => customerRows.reduce((s, r) => s + r.count, 0), [customerRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? customerRows.filter((r) => r.customer.toLowerCase().includes(q)) : customerRows;
  }, [customerRows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = sort.key === "customer" ? a.customer : sort.key === "count" ? a.count : a.balance;
      const bv = sort.key === "customer" ? b.customer : sort.key === "count" ? b.count : b.balance;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-accent transition-colors mb-3"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Outstanding Balance by Customer
        <span className="ml-1 text-xs font-normal text-muted-foreground">({customerRows.length} customers)</span>
      </button>

      {open && (
        <Card className="overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <SortableHead label="Customer" sortKey="customer" sort={sort} onSort={onSort} />
                  <SortableHead label="# Invoices" sortKey="count" sort={sort} onSort={onSort} className="text-right w-24" />
                  <SortableHead label="Total Invoiced" sortKey="totalInvoiced" sort={sort} onSort={onSort} className="text-right w-36" />
                  <SortableHead label="Balance Due" sortKey="balance" sort={sort} onSort={onSort} className="text-right w-36" />
                  <TableHead className="w-48">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const pct = maxBalance > 0 ? (row.balance / maxBalance) * 100 : 0;
                  const isHigh = row.balance > 50000;
                  return (
                    <TableRow key={row.customer} className={isHigh ? "bg-red-50 hover:bg-red-100" : "hover:bg-muted/50"}>
                      <TableCell className={`text-sm font-medium ${isHigh ? "text-red-700" : ""}`}>
                        {row.customer}
                        {isHigh && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-normal">High</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">{row.count}</TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">{fmt(row.totalInvoiced)}</TableCell>
                      <TableCell className={`text-sm text-right font-semibold ${isHigh ? "text-red-700" : "text-foreground"}`}>
                        {fmt(row.balance)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${isHigh ? "bg-red-500" : "bg-accent"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(pct)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Total row */}
            <div className="border-t bg-muted/30 px-4 py-2.5 flex items-center gap-4 text-sm">
              <span className="font-semibold flex-1">Total ({filtered.length} customers)</span>
              <span className="w-24 text-right text-muted-foreground">{totalCount} inv</span>
              <span className="w-36 text-right text-muted-foreground">{fmt(totalInvoiced)}</span>
              <span className="w-36 text-right font-bold text-foreground">{fmt(totalBalance)}</span>
              <span className="w-48" />
            </div>
          </div>

          {sorted.length === 0 && (
            <div className="py-6 text-center text-muted-foreground text-sm">No customers match your search.</div>
          )}
        </Card>
      )}
    </div>
  );
}