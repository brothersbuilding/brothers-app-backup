import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, AlertCircle, Search, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

export default function MatchedInvoicesPanel({
  contract,
  allInvoices,
  onAddManualInvoice,
  onRemoveManualInvoice,
  onExcludeInvoice,
  onTotalChange,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Get effective backlog date (default to 2026-01-01 if missing)
  const effectiveBacklogDate = useMemo(() => {
    if (contract?.backlog_as_of_date) {
      return new Date(contract.backlog_as_of_date);
    }
    return new Date("2026-01-01");
  }, [contract?.backlog_as_of_date]);

  // Auto-matched invoices - case-insensitive partial matching
  const autoMatched = useMemo(() => {
    if (!contract || !allInvoices) return [];
    const manualIds = contract.manual_invoice_ids ?? [];
    const excludedIds = contract.excluded_invoice_ids ?? [];
    const projectName = (contract.project_name || "").toLowerCase().trim();

    const matched = allInvoices.filter(inv => {
      if (excludedIds.includes(inv.id)) return false;
      if (manualIds.includes(inv.id)) return false;
      if (!inv.date_sent) return false;
      
      const invDate = new Date(inv.date_sent);
      if (invDate < effectiveBacklogDate) return false;
      
      const invProject = (inv.project || "").toLowerCase().trim();
      return invProject.includes(projectName) || projectName.includes(invProject);
    });

    return matched;
  }, [contract, allInvoices, effectiveBacklogDate, refreshKey]);

  // Manually linked invoices
  const manualMatched = useMemo(() => {
    if (!contract || !allInvoices) return [];
    const manualIds = contract.manual_invoice_ids ?? [];
    return allInvoices.filter(inv => manualIds.includes(inv.id));
  }, [contract, allInvoices]);

  // Diagnostic: get similar project names from all invoices
  const similarProjects = useMemo(() => {
    if (!contract || !allInvoices) return [];
    const contractProj = (contract.project_name || "").toLowerCase().trim();
    if (!contractProj) return [];
    
    const unique = new Set();
    allInvoices.forEach(inv => {
      const invProj = (inv.project || "").toLowerCase().trim();
      if (invProj && invProj !== contractProj) {
        // Check if similar (contains at least one common word or starts with same letter)
        if (invProj.includes(contractProj.split(" ")[0]) || contractProj.split(" ")[0].includes(invProj.split(" ")[0])) {
          unique.add(inv.project);
        }
      }
    });
    return Array.from(unique).slice(0, 5);
  }, [contract, allInvoices]);

  // Available invoices to add (not already matched, not excluded)
  const availableInvoices = useMemo(() => {
    if (!contract || !allInvoices) return [];
    const manualIds = contract.manual_invoice_ids ?? [];
    const excludedIds = contract.excluded_invoice_ids ?? [];
    const projectName = (contract.project_name || "").toLowerCase().trim();

    const available = allInvoices.filter(inv => {
      // Already manually linked
      if (manualIds.includes(inv.id)) return false;
      // Already excluded
      if (excludedIds.includes(inv.id)) return false;
      // Already auto-matched
      if (inv.date_sent) {
        const invDate = new Date(inv.date_sent);
        if (invDate >= effectiveBacklogDate) {
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
  }, [contract, allInvoices, searchQuery, effectiveBacklogDate, refreshKey]);

  const allMatched = [...autoMatched, ...manualMatched];
  const totalMatched = useMemo(() => {
    const total = allMatched.reduce((s, inv) => s + (inv.amount ?? 0), 0);
    // Notify parent of total change for syncing
    if (onTotalChange) {
      onTotalChange(total);
    }
    return total;
  }, [allMatched, onTotalChange]);

  return (
    <div className="space-y-6 pt-4 border-t">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Current Matched Invoices</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => setRefreshKey(k => k + 1)}
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </div>
        {allMatched.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-4 space-y-2">
            <p className="font-medium">No invoices matched</p>
            <div className="text-left space-y-1 ml-2">
              <p><strong>Debug Info:</strong></p>
              <p>Project Name: <code className="bg-muted px-1 rounded text-[11px]">{contract.project_name || "(empty)"}</code></p>
              <p>Backlog Date: <code className="bg-muted px-1 rounded text-[11px]">{effectiveBacklogDate.toISOString().split('T')[0]}</code></p>
              <p>Total Invoices in DB: <code className="bg-muted px-1 rounded text-[11px]">{allInvoices.length}</code></p>
              {similarProjects.length > 0 && (
                <div className="mt-2 pt-2 border-t border-muted">
                  <p className="font-medium mb-1">Similar project names found:</p>
                  <ul className="space-y-0.5 ml-2 text-[11px]">
                    {similarProjects.map((proj, idx) => (
                      <li key={idx}>• {proj}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-muted/30 mb-3">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Project</TableHead>
                  <TableHead className="text-xs">Date Sent</TableHead>
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
                      <TableCell className="text-xs">{inv.customer}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{inv.project}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.date_sent ? format(parseISO(inv.date_sent), "MMM d, yyyy") : "—"}
                      </TableCell>
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