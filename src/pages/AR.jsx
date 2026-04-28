import React, { useState, useMemo, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, AlertCircle, CheckCircle2, Upload, Zap } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import CSVImportPanel from "@/components/ar/CSVImportPanel";
import CustomerBalanceTable from "@/components/ar/CustomerBalanceTable";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

function agingBucket(dueDateStr) {
  if (!dueDateStr) return "0-30";
  const days = differenceInDays(new Date(), parseISO(dueDateStr));
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function overdueDays(dueDateStr) {
  if (!dueDateStr) return 0;
  const d = differenceInDays(new Date(), parseISO(dueDateStr));
  return Math.max(0, d);
}

const BUCKET_META = [
  { key: "0-30", label: "0 – 30 Days", timeframe: "Current", ring: "ring-green-400", text: "text-green-700", bg: "bg-green-50", badge: "bg-green-100 text-green-800" },
  { key: "31-60", label: "31 – 60 Days", timeframe: "Overdue", ring: "ring-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50", badge: "bg-yellow-100 text-yellow-800" },
  { key: "61-90", label: "61 – 90 Days", timeframe: "Very Overdue", ring: "ring-orange-400", text: "text-orange-700", bg: "bg-orange-50", badge: "bg-orange-100 text-orange-800" },
  { key: "90+", label: "90+ Days", timeframe: "Critical", ring: "ring-red-400", text: "text-red-700", bg: "bg-red-50", badge: "bg-red-100 text-red-800" },
];

// Returns the effective outstanding amount for aging (open_balance if set, else full amount)
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

function useSort(defaultKey, defaultDir = "desc") {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });
  const onSort = (key) =>
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  return [sort, onSort];
}

function useInfiniteScroll(displayCount, setDisplayCount, totalCount) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        setDisplayCount((prev) => Math.min(prev + 10, totalCount));
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [displayCount, totalCount, setDisplayCount]);

  return scrollRef;
}

function sortInvoices(invoices, sort, getValue) {
  return [...invoices].sort((a, b) => {
    const av = getValue(a, sort.key);
    const bv = getValue(b, sort.key);
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

export default function AR() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [unpaidSort, onUnpaidSort] = useSort("age", "desc");
  const [paidSort, onPaidSort] = useSort("date_sent", "desc");
  const [unpaidDisplayCount, setUnpaidDisplayCount] = useState(20);
  const [paidDisplayCount, setPaidDisplayCount] = useState(20);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["ar-invoices"],
    queryFn: () => base44.entities.Invoice.list("-updated_date", 500),
    refetchInterval: 5 * 60 * 1000,
  });

  const unpaidInvoices = useMemo(() => invoices.filter((inv) => inv.status === "unpaid" || inv.status === "partial"), [invoices]);
  const paidInvoices = useMemo(() => invoices.filter((inv) => inv.status === "paid"), [invoices]);

  const bucketTotals = useMemo(() => {
    const totals = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    unpaidInvoices.forEach((inv) => { totals[agingBucket(inv.due_date)] += effectiveBalance(inv); });
    return totals;
  }, [unpaidInvoices]);

  const totalOutstanding = useMemo(() => unpaidInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0), [unpaidInvoices]);
  const totalOpenBalance = useMemo(() => unpaidInvoices.reduce((sum, inv) => sum + effectiveBalance(inv), 0), [unpaidInvoices]);

  const avgCollectionDays = useMemo(() => {
    const withDates = paidInvoices.filter((inv) => inv.date_sent && inv.due_date);
    if (!withDates.length) return 0;
    return Math.round(withDates.reduce((sum, inv) => sum + differenceInDays(parseISO(inv.due_date), parseISO(inv.date_sent)), 0) / withDates.length);
  }, [paidInvoices]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await base44.functions.invoke("triggerARSync", {});
      queryClient.invalidateQueries({ queryKey: ["ar-invoices"] });
      setSyncResult({ status: "success", message: result?.message ?? "Sync complete.", timestamp: new Date() });
    } catch (error) {
      setSyncResult({ status: "error", message: error?.message ?? "Sync failed.", timestamp: new Date() });
    } finally {
      setSyncing(false);
    }
  };

  const getBadge = (inv) => {
    const meta = BUCKET_META.find((b) => b.key === agingBucket(inv.due_date));
    const days = overdueDays(inv.due_date);
    if (!meta) return null;
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>{days === 0 ? "Current" : `${days}d overdue`}</span>;
  };

  const unpaidGetValue = (inv, key) => {
    if (key === "invoice_number") return inv.invoice_number ?? "";
    if (key === "customer") return inv.customer ?? "";
    if (key === "project") return inv.project ?? "";
    if (key === "amount") return inv.amount ?? 0;
    if (key === "open_balance") return effectiveBalance(inv);
    if (key === "due_date") return inv.due_date ?? "";
    if (key === "date_sent") return inv.date_sent ?? "";
    if (key === "age") return overdueDays(inv.due_date);
    return "";
  };

  const paidGetValue = (inv, key) => {
    if (key === "invoice_number") return inv.invoice_number ?? "";
    if (key === "customer") return inv.customer ?? "";
    if (key === "project") return inv.project ?? "";
    if (key === "amount") return inv.amount ?? 0;
    if (key === "date_sent") return inv.date_sent ?? "";
    if (key === "due_date") return inv.due_date ?? "";
    if (key === "paid_date") return inv.paid_date ?? "";
    return "";
  };

  const sortedUnpaid = useMemo(() => sortInvoices(unpaidInvoices, unpaidSort, unpaidGetValue), [unpaidInvoices, unpaidSort]);
  const sortedPaid = useMemo(() => sortInvoices(paidInvoices, paidSort, paidGetValue), [paidInvoices, paidSort]);

  // Reset display counts when sort changes
  useEffect(() => { setUnpaidDisplayCount(20); }, [unpaidSort]);
  useEffect(() => { setPaidDisplayCount(20); }, [paidSort]);

  const unpaidScrollRef = useInfiniteScroll(unpaidDisplayCount, setUnpaidDisplayCount, sortedUnpaid.length);
  const paidScrollRef = useInfiniteScroll(paidDisplayCount, setPaidDisplayCount, sortedPaid.length);



  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Accounts Receivable</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Synced with QuickBooks · auto-refreshes every 5 min</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(!showImport)} className="gap-2">
              <Upload className="w-4 h-4" />Import CSV
            </Button>
            <Button onClick={handleSync} disabled={syncing} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from QuickBooks"}
            </Button>
          </div>
          {syncResult && (
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border ${syncResult.status === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {syncResult.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {syncResult.message}
              <span className="opacity-60 ml-1">{format(syncResult.timestamp, "h:mm a")}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="lg:col-span-1 rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-foreground mb-2">{fmt(totalOpenBalance)}</p>
          <p className="text-xs text-muted-foreground">{unpaidInvoices.length} invoices</p>
        </div>
        <div className="lg:col-span-1 rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Avg Collection</p>
          <p className="text-2xl font-bold text-foreground mb-2">{avgCollectionDays}</p>
          <p className="text-xs text-muted-foreground">Days</p>
        </div>
        {BUCKET_META.map((b) => (
          <div key={b.key} className={`lg:col-span-1 rounded-lg border ring-1 ${b.ring} ${b.bg} p-4`}>
            <p className="text-xs text-muted-foreground mb-1">{b.label}</p>
            <p className={`text-2xl font-bold mb-2 ${b.text}`}>{fmt(bucketTotals[b.key])}</p>
            <p className="text-xs text-muted-foreground">{b.timeframe}</p>
          </div>
        ))}
      </div>

      <CustomerBalanceTable unpaidInvoices={unpaidInvoices} />

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border rounded-md px-4 py-2.5 mb-4">
        <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
        <span><strong>QuickBooks webhook active.</strong> When an invoice is marked paid in QB it will automatically move to the Paid section.</span>
      </div>

      {showImport && (
        <CSVImportPanel
          onClose={() => setShowImport(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ["ar-invoices"] })}
        />
      )}

      <div className="grid grid-cols-1 gap-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Unpaid Invoices {unpaidInvoices.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">({unpaidInvoices.length})</span>}</h2>
          <Card className="overflow-hidden">
            {!isLoading && unpaidInvoices.length > 0 && (
              <div className="px-6 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
                Showing {Math.min(unpaidDisplayCount, sortedUnpaid.length)} of {sortedUnpaid.length} invoices
              </div>
            )}
            <div ref={unpaidScrollRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "500px" }}>
              {isLoading ? <div className="py-8 text-center text-muted-foreground text-sm animate-pulse">Loading invoices…</div>
              : unpaidInvoices.length === 0 ? <div className="py-8 text-center text-muted-foreground text-sm">No unpaid invoices — all clear!</div>
              : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <SortableHead label="Invoice #" sortKey="invoice_number" sort={unpaidSort} onSort={onUnpaidSort} />
                      <SortableHead label="Customer" sortKey="customer" sort={unpaidSort} onSort={onUnpaidSort} />
                      <SortableHead label="Project" sortKey="project" sort={unpaidSort} onSort={onUnpaidSort} />
                      <SortableHead label="Amount" sortKey="amount" sort={unpaidSort} onSort={onUnpaidSort} className="text-right" />
                      <SortableHead label="Balance Due" sortKey="open_balance" sort={unpaidSort} onSort={onUnpaidSort} className="text-right" />
                      <SortableHead label="Due Date" sortKey="due_date" sort={unpaidSort} onSort={onUnpaidSort} />
                      <SortableHead label="Date Sent" sortKey="date_sent" sort={unpaidSort} onSort={onUnpaidSort} />
                      <SortableHead label="Age" sortKey="age" sort={unpaidSort} onSort={onUnpaidSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUnpaid.slice(0, unpaidDisplayCount).map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm font-mono">{inv.invoice_number || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.customer || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.project || "—"}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{fmt(inv.amount)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {inv.open_balance != null && inv.open_balance !== inv.amount ? (
                            <span className="text-blue-700 font-semibold">{fmt(inv.open_balance)}</span>
                          ) : "—"}
                          {inv.status === "partial" && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Partial</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{inv.due_date ? format(parseISO(inv.due_date), "MMM dd, yyyy") : "—"}</TableCell>
                        <TableCell className="text-sm">{inv.date_sent ? format(parseISO(inv.date_sent), "MMM dd, yyyy") : "—"}</TableCell>
                        <TableCell>{getBadge(inv)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Paid Invoices {paidInvoices.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">({paidInvoices.length})</span>}</h2>
          <Card className="overflow-hidden">
            {!isLoading && paidInvoices.length > 0 && (
              <div className="px-6 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
                Showing {Math.min(paidDisplayCount, sortedPaid.length)} of {sortedPaid.length} invoices
              </div>
            )}
            <div ref={paidScrollRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "500px" }}>
              {isLoading ? <div className="py-8 text-center text-muted-foreground text-sm animate-pulse">Loading invoices…</div>
              : paidInvoices.length === 0 ? <div className="py-8 text-center text-muted-foreground text-sm">No paid invoices yet</div>
              : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <SortableHead label="Invoice #" sortKey="invoice_number" sort={paidSort} onSort={onPaidSort} />
                      <SortableHead label="Customer" sortKey="customer" sort={paidSort} onSort={onPaidSort} />
                      <SortableHead label="Project" sortKey="project" sort={paidSort} onSort={onPaidSort} />
                      <SortableHead label="Amount" sortKey="amount" sort={paidSort} onSort={onPaidSort} className="text-right" />
                      <SortableHead label="Invoice Date" sortKey="date_sent" sort={paidSort} onSort={onPaidSort} />
                      <SortableHead label="Due Date" sortKey="due_date" sort={paidSort} onSort={onPaidSort} />
                      <SortableHead label="Paid Date" sortKey="paid_date" sort={paidSort} onSort={onPaidSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPaid.slice(0, paidDisplayCount).map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm font-mono">{inv.invoice_number || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.customer || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.project || "—"}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{fmt(inv.amount)}</TableCell>
                        <TableCell className="text-sm">{inv.date_sent ? format(parseISO(inv.date_sent), "MMM dd, yyyy") : "—"}</TableCell>
                        <TableCell className="text-sm">{inv.due_date ? format(parseISO(inv.due_date), "MMM dd, yyyy") : "—"}</TableCell>
                        <TableCell className="text-sm text-green-700">{inv.paid_date ? format(parseISO(inv.paid_date), "MMM dd, yyyy") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}