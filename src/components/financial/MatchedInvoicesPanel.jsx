import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, AlertCircle, Search } from "lucide-react";
import { format, parseISO } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

export default function MatchedInvoicesPanel({
  contract,
  allInvoices,
  onAddManualInvoice,
  onRemoveManualInvoice,
  onExcludeInvoice,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-matched invoices - case-insensitive partial matching
  const autoMatched = useMemo(() => {
    if (!contract || !allInvoices) return [];
    const backlogDate = new Date(contract.backlog_as_of_date || new Date());
    const manualIds = contract.manual_invoice_ids ?? [];
    const excludedIds = contract.excluded_invoice_ids ?? [];
    const projectName = (contract.project_name || "").toLowerCase().trim();

    const matched = allInvoices.filter(inv => {
      if (excludedIds.includes(inv.id)) return false;
      if (manualIds.includes(inv.id)) return false;
      if (!inv.date_sent) return false;
      
      const invDate = new Date(inv.date_sent);
      if (invDate < backlogDate) return false;
      
      const invProject = (inv.project || "").toLowerCase().trim();
      return invProject.includes(projectName) || projectName.includes(invProject);
    });

    // Debug logging
    console.log("MatchedInvoicesPanel Debug:", {
      contractProjectName: contract.project_name,
      contractProjectNameLower: projectName,
      backlogDate: contract.backlog_as_of_date,
      totalInvoices: allInvoices.length,
      matchedCount: matched.length,
      sampleInvoices: allInvoices.slice(0, 3).map(inv => ({
        id: inv.id,
        project: inv.project,
        projectLower: (inv.project || "").toLowerCase(),
        dateSent: inv.date_sent,
        customer: inv.customer,
      })),
    });

    return matched;
  }, [contract, allInvoices]);

  // Manually linked invoices
  const manualMatched = useMemo(() => {
    if (!contract || !allInvoices) return [];
    const manualIds = contract.manual_invoice_ids ?? [];
    return allInvoices.filter(inv => manualIds.includes(inv.id));
  }, [contract, allInvoices]);

  // Available invoices to add (not already matched, not excluded)
  const availableInvoices = useMemo(() => {
    if (!contract || !allInvoices) return [];
    const manualIds = contract.manual_invoice_ids ?? [];
    const excludedIds = contract.excluded_invoice_ids ?? [];
    const backlogDate = new Date(contract.backlog_as_of_date || new Date());
    const projectName = (contract.project_name || "").toLowerCase().trim();

    const available = allInvoices.filter(inv => {
      // Already manually linked
      if (manualIds.includes(inv.id)) return false;
      // Already excluded
      if (excludedIds.includes(inv.id)) return false;
      // Already auto-matched
      if (inv.date_sent) {
        const invDate = new Date(inv.date_sent);
        if (invDate >= backlogDate) {
          const invProject = (inv.project || "").toLowerCase().trim();
          if (invProject.includes(projectName) || projectName.includes(invProject)) {
            return false;
          }
        }
      }
      return true;
    });

    const q = searchQuery.toLowerCase();
    return available.filter(inv =>
      (inv.invoice_number ?? "").toLowerCase().includes(q) ||
      (inv.customer ?? "").toLowerCase().includes(q) ||
      (inv.project ?? "").toLowerCase().includes(q)
    );
  }, [contract, allInvoices, searchQuery]);

  const allMatched = [...autoMatched, ...manualMatched];
  const totalMatched = allMatched.reduce((s, inv) => s + (inv.amount ?? 0), 0);

  return (
    <div className="space-y-6 pt-4 border-t">
      <div>
        <h4 className="text-sm font-semibold mb-3">Current Matched Invoices</h4>
        {allMatched.length === 0 ? (
          <p className="text-xs text-muted-foreground mb-3">No invoices matched.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-muted/30 mb-3">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Date Sent</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Project</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-right w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {allMatched.map(inv => {
                  const isManual = (contract.manual_invoice_ids ?? []).includes(inv.id);
                  return (
                    <TableRow key={inv.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs font-medium">{inv.invoice_number}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.date_sent ? format(parseISO(inv.date_sent), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{inv.customer}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{inv.project}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmt(inv.amount)}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge className={isManual ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}>
                          {isManual ? "Manual" : "Auto"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isManual ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => onRemoveManualInvoice(inv.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => onExcludeInvoice(inv.id)}
                          >
                            <AlertCircle className="w-3 h-3" />
                            Wrong?
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold border-t">
                  <TableCell colSpan={4} className="text-xs">Total</TableCell>
                  <TableCell className="text-xs text-right">{fmt(totalMatched)}</TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-3">Add Invoices Manually</h4>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search invoice #, customer, or project…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          {availableInvoices.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No available invoices to add.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border rounded-lg bg-card">
              {availableInvoices.map(inv => (
                <button
                  key={inv.id}
                  onClick={() => {
                    onAddManualInvoice(inv.id);
                    setSearchQuery("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b text-xs last:border-b-0 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{inv.invoice_number}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {inv.customer} {inv.project ? `/ ${inv.project}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{fmt(inv.amount)}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {inv.date_sent ? format(parseISO(inv.date_sent), "MMM d") : "—"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}