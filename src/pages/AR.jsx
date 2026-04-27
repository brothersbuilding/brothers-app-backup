import React, { useState, useMemo } from "react";
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

export default function AR() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["ar-invoices"],
    queryFn: () => base44.entities.Invoice.list("-updated_date", 500),
    refetchInterval: 5 * 60 * 1000,
  });

  const unpaidInvoices = useMemo(() => invoices.filter((inv) => inv.status === "unpaid"), [invoices]);
  const paidInvoices = useMemo(() => invoices.filter((inv) => inv.status === "paid"), [invoices]);

  const bucketTotals = useMemo(() => {
    const totals = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    unpaidInvoices.forEach((inv) => { totals[agingBucket(inv.due_date)] += inv.amount ?? 0; });
    return totals;
  }, [unpaidInvoices]);

  const totalOutstanding = useMemo(() => unpaidInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0), [unpaidInvoices]);

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



  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Accounts Receivable</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Synced with QuickBooks · auto-refreshes every 5 min</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowImport(!showImport); setImportResult(null); }} className="gap-2">
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
          <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold text-foreground mb-2">{fmt(totalOutstanding)}</p>
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
            <div className="overflow-x-auto">
              {isLoading ? <div className="py-8 text-center text-muted-foreground text-sm animate-pulse">Loading invoices…</div>
              : unpaidInvoices.length === 0 ? <div className="py-8 text-center text-muted-foreground text-sm">No unpaid invoices — all clear!</div>
              : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Project / Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Date Sent</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidInvoices.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm font-mono">{inv.invoice_number || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.project || "—"}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{fmt(inv.amount)}</TableCell>
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
            <div className="overflow-x-auto">
              {isLoading ? <div className="py-8 text-center text-muted-foreground text-sm animate-pulse">Loading invoices…</div>
              : paidInvoices.length === 0 ? <div className="py-8 text-center text-muted-foreground text-sm">No paid invoices yet</div>
              : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Project / Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Paid / Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidInvoices.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm font-mono">{inv.invoice_number || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.project || "—"}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{fmt(inv.amount)}</TableCell>
                        <TableCell className="text-sm text-green-700">{inv.due_date ? format(parseISO(inv.due_date), "MMM dd, yyyy") : "—"}</TableCell>
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