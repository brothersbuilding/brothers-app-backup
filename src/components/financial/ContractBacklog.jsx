import React, { useState, useMemo, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, RefreshCw, Pencil, CheckCircle2, X } from "lucide-react";
import { format, parseISO } from "date-fns";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

const CONTRACT_TYPES = [
  { value: "fixed", label: "Fixed" },
  { value: "time_and_materials", label: "T&M" },
  { value: "cost_plus", label: "Cost Plus" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
];

function ContractTypeBadge({ type }) {
  const styles = {
    fixed: "bg-blue-100 text-blue-800",
    time_and_materials: "bg-orange-100 text-orange-800",
    cost_plus: "bg-purple-100 text-purple-800",
  };
  const labels = { fixed: "Fixed", time_and_materials: "T&M", cost_plus: "Cost Plus" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[type] ?? "bg-muted text-muted-foreground"}`}>
      {labels[type] ?? type ?? "—"}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-100 text-green-800",
    complete: "bg-slate-100 text-slate-700",
    on_hold: "bg-yellow-100 text-yellow-800",
    cancelled: "bg-red-100 text-red-700",
  };
  const labels = { active: "Active", complete: "Complete", on_hold: "On Hold", cancelled: "Cancelled" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status ?? "—"}
    </span>
  );
}

function BilledBar({ pct }) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  let color = "bg-green-500";
  if (pct >= 95) color = "bg-blue-500";
  else if (pct >= 80) color = "bg-orange-500";
  else if (pct >= 50) color = "bg-yellow-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden min-w-[60px]">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const EMPTY_FORM = {
  project_name: "",
  customer: "",
  contract_value: "",
  contract_type: "fixed",
  start_date: "",
  estimated_completion: "",
  notes: "",
  status: "active",
};

export default function ContractBacklog({ invoices = [] }) {
  const [backlogData, setBacklogData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("remaining_backlog");
  const [sortDir, setSortDir] = useState("desc");
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState(null);

  // Unique project names from invoices for dropdown
  const projectOptions = useMemo(() => {
    const names = [...new Set(invoices.map(i => i.project).filter(Boolean))].sort();
    return names;
  }, [invoices]);

  const fetchBacklog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getContractBacklog", {});
      setBacklogData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBacklog();
    const interval = setInterval(fetchBacklog, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBacklog]);

  const contracts = backlogData?.contracts ?? [];
  const summary = backlogData?.summary ?? {};

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contracts.filter(
      c =>
        (c.project_name ?? "").toLowerCase().includes(q) ||
        (c.customer ?? "").toLowerCase().includes(q)
    );
  }, [contracts, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalsRow = useMemo(() => ({
    contract_value: sorted.reduce((s, c) => s + (c.contract_value ?? 0), 0),
    total_invoiced: sorted.reduce((s, c) => s + (c.total_invoiced ?? 0), 0),
    remaining_backlog: sorted.reduce((s, c) => s + (c.remaining_backlog ?? 0), 0),
    invoice_count: sorted.reduce((s, c) => s + (c.invoice_count ?? 0), 0),
  }), [sorted]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortHead({ label, k, className }) {
    const active = sortKey === k;
    return (
      <TableHead
        className={`cursor-pointer select-none hover:text-foreground whitespace-nowrap ${className ?? ""}`}
        onClick={() => handleSort(k)}
      >
        {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </TableHead>
    );
  }

  function openAdd() {
    setEditingContract(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c) {
    setEditingContract(c);
    setForm({
      project_name: c.project_name ?? "",
      customer: c.customer ?? "",
      contract_value: c.contract_value ?? "",
      contract_type: c.contract_type ?? "fixed",
      start_date: c.start_date ?? "",
      estimated_completion: c.estimated_completion ?? "",
      notes: c.notes ?? "",
      status: c.status ?? "active",
    });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      ...form,
      contract_value: parseFloat(form.contract_value) || 0,
    };
    const isNew = !editingContract;
    const projectName = form.project_name;

    if (editingContract) {
      await base44.entities.Contract.update(editingContract.id, payload);
    } else {
      await base44.entities.Contract.create(payload);
    }
    
    setSaving(false);
    setShowForm(false);
    fetchBacklog();

    // Show confirmation message for new contracts
    if (isNew) {
      const matchingInvoices = invoices.filter(inv => inv.project === projectName);
      const totalAmount = matchingInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

      if (matchingInvoices.length > 0) {
        setConfirmationMessage({
          type: "success",
          text: `Found ${matchingInvoices.length} existing invoice${matchingInvoices.length !== 1 ? "s" : ""} totaling ${fmt(totalAmount)} against this project — these have been applied to your backlog.`,
        });
      } else {
        setConfirmationMessage({
          type: "info",
          text: "No existing invoices found for this project yet — invoices will be matched automatically as they come in.",
        });
      }

      // Auto-hide after 5 seconds
      setTimeout(() => setConfirmationMessage(null), 5000);
    }
  }

  async function handleMarkComplete(c) {
    await base44.entities.Contract.update(c.id, { status: "complete" });
    fetchBacklog();
  }

  function rowStyle(c) {
    if (c.remaining_backlog < 0) return "bg-red-50 hover:bg-red-100";
    if (c.remaining_backlog <= 0) return "bg-green-50 hover:bg-green-100";
    return "hover:bg-muted/50";
  }

  function billingBadge(c) {
    if (c.remaining_backlog < 0) {
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
          Over-billed {fmt(Math.abs(c.remaining_backlog))}
        </span>
      );
    }
    if (c.remaining_backlog === 0 || c.percent_billed >= 100) {
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
          Fully Billed
        </span>
      );
    }
    return null;
  }

  return (
    <div>
      {/* Confirmation Banner */}
      {confirmationMessage && (
        <div className={`mb-4 px-4 py-3 rounded-lg border flex items-center justify-between ${
          confirmationMessage.type === "success"
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-yellow-50 border-yellow-200 text-yellow-700"
        }`}>
          <p className="text-sm font-medium">{confirmationMessage.text}</p>
          <button
            onClick={() => setConfirmationMessage(null)}
            className="text-current hover:opacity-70 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Contract Backlog &amp; Projected Revenue
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBacklog} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Contract
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Contract Value" value={fmt(summary.total_contract_value)} sub="Active contracts" />
        <SummaryCard label="Total Invoiced to Date" value={fmt(summary.total_invoiced)} sub="Against active contracts" />
        <SummaryCard label="Remaining Backlog" value={fmt(summary.total_remaining_backlog)} sub="Contract value – invoiced" />
        <SummaryCard label="Projected Year-End Revenue" value={fmt(summary.projected_year_end_revenue)} sub="YTD revenue + backlog" />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by project or customer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-8 text-sm"
        />
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">Loading contract backlog…</div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No active contracts found. Add one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <SortHead label="Project Name" k="project_name" />
                  <SortHead label="Customer" k="customer" />
                  <TableHead>Type</TableHead>
                  <SortHead label="Contract Value" k="contract_value" className="text-right" />
                  <SortHead label="Invoiced" k="total_invoiced" className="text-right" />
                  <SortHead label="Remaining" k="remaining_backlog" className="text-right" />
                  <SortHead label="% Billed" k="percent_billed" className="min-w-[120px]" />
                  <SortHead label="Invoices" k="invoice_count" className="text-center" />
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(c => (
                  <TableRow key={c.id} className={rowStyle(c)}>
                    <TableCell className="text-sm font-medium">
                      <div className="flex flex-col gap-0.5">
                        {c.project_name}
                        {billingBadge(c)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{c.customer || "—"}</TableCell>
                    <TableCell><ContractTypeBadge type={c.contract_type} /></TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmt(c.contract_value)}</TableCell>
                    <TableCell className="text-sm text-right">{fmt(c.total_invoiced)}</TableCell>
                    <TableCell className={`text-sm text-right font-semibold ${c.remaining_backlog < 0 ? "text-red-600" : ""}`}>
                      {fmt(c.remaining_backlog)}
                    </TableCell>
                    <TableCell><BilledBar pct={c.percent_billed ?? 0} /></TableCell>
                    <TableCell className="text-sm text-center">{c.invoice_count}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {c.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                            title="Mark Complete"
                            onClick={() => handleMarkComplete(c)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/70 font-semibold border-t-2">
                  <TableCell className="text-sm" colSpan={3}>Totals ({sorted.length} contracts)</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totalsRow.contract_value)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totalsRow.total_invoiced)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totalsRow.remaining_backlog)}</TableCell>
                  <TableCell />
                  <TableCell className="text-sm text-center">{totalsRow.invoice_count}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContract ? "Edit Contract" : "Add Contract"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block">Project Name *</Label>
              {projectOptions.length > 0 ? (
                <Select value={form.project_name} onValueChange={v => setForm(f => ({ ...f, project_name: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectOptions.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">— Type manually —</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {(form.project_name === "__custom__" || projectOptions.length === 0) && (
                <Input
                  className="mt-2"
                  placeholder="Enter project name exactly as in invoices"
                  value={form.project_name === "__custom__" ? "" : form.project_name}
                  onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                />
              )}
            </div>

            <div>
              <Label className="text-xs mb-1 block">Customer *</Label>
              <Input
                placeholder="Customer name"
                value={form.customer}
                onChange={e => setForm(f => ({ ...f, customer: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Contract Value *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.contract_value}
                  onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Contract Type</Label>
                <Select value={form.contract_type} onValueChange={v => setForm(f => ({ ...f, contract_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(ct => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Estimated Completion</Label>
                <Input
                  type="date"
                  value={form.estimated_completion}
                  onChange={e => setForm(f => ({ ...f, estimated_completion: e.target.value }))}
                />
              </div>
            </div>

            {editingContract && (
              <div>
                <Label className="text-xs mb-1 block">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs mb-1 block">Notes</Label>
              <Textarea
                placeholder="Any additional notes…"
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.project_name || !form.customer || !form.contract_value}>
                {saving ? "Saving…" : "Save Contract"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}