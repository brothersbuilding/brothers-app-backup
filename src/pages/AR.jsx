import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import StatCard from "@/components/shared/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function AR() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const agingBuckets = [
    { label: "0-30 Days", timeframe: "Current", value: "$0", bgColor: "bg-green-50" },
    { label: "31-60 Days", timeframe: "Overdue", value: "$0", bgColor: "bg-yellow-50" },
    { label: "61-90 Days", timeframe: "Very Overdue", value: "$0", bgColor: "bg-orange-50" },
    { label: "More than 90 Days", timeframe: "Critical", value: "$0", bgColor: "bg-red-100" },
  ];

  const { data: invoices = [] } = useQuery({
    queryKey: ["ar-invoices"],
    queryFn: () => base44.entities.Invoice.list("-updated_date", 500),
  });

  const unpaidInvoices = invoices.filter(inv => inv.status === "unpaid");
  const paidInvoices = invoices.filter(inv => inv.status === "paid");

  const handleUpdate = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke("triggerARSync", {});
      queryClient.invalidateQueries({ queryKey: ["ar-invoices"] });
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Accounts Receivable</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track outstanding invoices by age</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold text-foreground mb-2">$0</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Avg Collection Period</p>
          <p className="text-2xl font-bold text-foreground mb-2">0</p>
          <p className="text-xs text-muted-foreground">Days</p>
        </div>
        {agingBuckets.map((bucket) => (
          <div key={bucket.label} className={`rounded-lg border ${bucket.bgColor} p-4`}>
            <p className="text-xs text-muted-foreground mb-1">{bucket.label}</p>
            <p className="text-2xl font-bold text-foreground mb-2">{bucket.value}</p>
            <p className="text-xs text-muted-foreground">{bucket.timeframe}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={handleUpdate} disabled={syncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Updating..." : "Update from QB"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Unpaid Invoices */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Unpaid Invoices</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              {unpaidInvoices.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No unpaid invoices</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Date Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidInvoices.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm">{inv.invoice_number || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.project || "—"}</TableCell>
                        <TableCell className="text-sm text-right">${inv.amount?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell className="text-sm">{inv.due_date ? format(parseISO(inv.due_date), "MMM dd, yyyy") : "—"}</TableCell>
                        <TableCell className="text-sm">{inv.date_sent ? format(parseISO(inv.date_sent), "MMM dd, yyyy") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>

        {/* Paid Invoices */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Paid Invoices</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              {paidInvoices.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No paid invoices</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidInvoices.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm">{inv.invoice_number || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.project || "—"}</TableCell>
                        <TableCell className="text-sm text-right">${inv.amount?.toFixed(2) || "0.00"}</TableCell>
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