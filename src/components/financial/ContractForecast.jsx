import React, { useState, useMemo, useCallback, useEffect } from "react";
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
import { Plus, Search, RefreshCw, Pencil, CheckCircle2, X, ChevronDown, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

const CONTRACT_TYPES = [
  { value: "res_gc", label: "Residential GC" },
  { value: "com_gc", label: "Commercial GC" },
  { value: "sub_cont", label: "Sub Contract" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
];

const FORECAST_OPTIONS = [
  { value: "on_track", label: "On Track" },
  { value: "lost", label: "Lost" },
  { value: "delayed", label: "Delayed" },
  { value: "reduced_scope", label: "Reduced Scope" },
];

function ContractTypeBadge({ type }) {
  const styles = {
    res_gc: "bg-blue-100 text-blue-800",
    com_gc: "bg-purple-100 text-purple-800",
    sub_cont: "bg-orange-100 text-orange-800",
  };
  const labels = { res_gc: "Residential GC", com_gc: "Commercial GC", sub_cont: "Sub Contract" };
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

function ForecastBadge({ forecastStatus }) {
  const styles = {
    on_track: "bg-green-100 text-green-800",
    lost: "bg-red-100 text-red-700",
    delayed: "bg-blue-100 text-blue-800",
    reduced_scope: "bg-yellow-100 text-yellow-800",
  };
  const labels = {
    on_track: "On Track",
    lost: "Lost",
    delayed: "Delayed",
    reduced_scope: "Reduced Scope",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[forecastStatus] ?? "bg-muted text-muted-foreground"}`}>
      {labels[forecastStatus] ?? forecastStatus ?? "—"}
    </span>
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

function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

const EMPTY_FORM = {
  project_name: "",
  customer: "",
  contract_value: "",
  contract_type: "res_gc",
  start_date: "",
  estimated_completion: "",
  projected_end_date: "",
  backlog_as_of_date: getTodayString(),
  notes: "",
  status: "active",
  forecast_status: "on_track",
  adjusted_value: "",
  adjusted_start_date: "",
  forecast_notes: "",
};

const EMPTY_FORECAST_FORM = {
  forecast_status: "on_track",
  adjusted_value: "",
  adjusted_start_date: "",
  forecast_notes: "",
};

export default function ContractForecast({ invoices = [] }) {
  const [contracts, setContracts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState("project_name");
  const [sortDir, setSortDir] = React.useState("asc");
  const [showForm, setShowForm] = React.useState(false);
  const [editingContract, setEditingContract] = React.useState(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [expandedForecastId, setExpandedForecastId] = React.useState(null);
  const [forecastForm, setForecastForm] = React.useState(EMPTY_FORECAST_FORM);
  const [savingForecast, setSavingForecast] = React.useState(false);

  const projectOptions = React.useMemo(() => {
    const names = [...new Set(invoices.map(i => i.project).filter(Boolean))].sort();
    return names;
  }, [invoices]);

  const fetchContracts = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Contract.list();
      // Auto-set original_value on creation if not already set
      const updated = await Promise.all(
        data.map(async (c) => {
          if (c.original_value === undefined || c.original_value === null) {
            await base44.entities.Contract.update(c.id, { original_value: c.contract_value });
            return { ...c, original_value: c.contract_value };
          }
          return c;
        })
      );
      setContracts(updated);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return contracts.filter(
      c =>
        (c.project_name ?? "").toLowerCase().includes(q) ||
        (c.customer ?? "").toLowerCase().includes(q)
    );
  }, [contracts, search]);

  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const summaryData = React.useMemo(() => {
    const originalTotal = sorted.reduce((s, c) => s + (c.original_value ?? c.contract_value ?? 0), 0);
    const adjustedTotal = sorted
      .filter(c => c.forecast_status !== "lost")
      .reduce((s, c) => s + (c.adjusted_value ?? c.contract_value ?? 0), 0);
    const variance = adjustedTotal - originalTotal;

    return {
      originalTotal,
      adjustedTotal,
      variance,
      activeCount: sorted.filter(c => c.status === "active").length,
    };
  }, [sorted]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
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
      backlog_as_of_date: c.backlog_as_of_date ?? getTodayString(),
      notes: c.notes ?? "",
      status: c.status ?? "active",
      forecast_status: c.forecast_status ?? "on_track",
      adjusted_value: c.adjusted_value ?? "",
      adjusted_start_date: c.adjusted_start_date ?? "",
      forecast_notes: c.forecast_notes ?? "",
    });
    setShowForm(true);
  }

  function openForecastEditor(c) {
    setExpandedForecastId(c.id);
    setForecastForm({
      forecast_status: c.forecast_status ?? "on_track",
      adjusted_value: c.adjusted_value ? String(c.adjusted_value) : String(c.contract_value ?? ""),
      adjusted_start_date: c.adjusted_start_date ?? "",
      forecast_notes: c.forecast_notes ?? "",
    });
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      ...form,
      contract_value: parseFloat(form.contract_value) || 0,
    };
    const isNew = !editingContract;

    try {
      if (editingContract) {
        await base44.entities.Contract.update(editingContract.id, payload);
      } else {
        const newPayload = {
          ...payload,
          original_value: payload.contract_value,
        };
        await base44.entities.Contract.create(newPayload);
      }
      setSaving(false);
      setShowForm(false);
      await fetchContracts();
    } catch (e) {
      setSaving(false);
      console.error("Error saving contract:", e);
    }
  }

  async function handleSaveForecast(contractId) {
    setSavingForecast(true);
    try {
      const payload = {
        forecast_status: forecastForm.forecast_status,
        adjusted_value: forecastForm.adjusted_value ? parseFloat(forecastForm.adjusted_value) : undefined,
        adjusted_start_date: forecastForm.adjusted_start_date || undefined,
        forecast_notes: forecastForm.forecast_notes,
      };
      await base44.entities.Contract.update(contractId, payload);
      setExpandedForecastId(null);
      await fetchContracts();
    } finally {
      setSavingForecast(false);
    }
  }

  function getAdjustedValue(c) {
    return c.adjusted_value ?? c.contract_value ?? 0;
  }

  function getValueColor(c) {
    if (c.forecast_status === "lost") return "text-red-600 line-through";
    if (c.forecast_status === "reduced_scope" && c.adjusted_value && c.adjusted_value < c.contract_value) return "text-yellow-600";
    if (c.forecast_status === "delayed") return "text-blue-600";
    return "";
  }

  function rowStyle(c) {
    if (c.forecast_status === "lost") return "bg-slate-50 hover:bg-slate-100 opacity-75";
    return "hover:bg-muted/50";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Contract Forecast
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchContracts} disabled={loading} className="gap-1.5">
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
        <SummaryCard label="Original Projection" value={fmt(summaryData.originalTotal)} sub="All contracts" />
        <SummaryCard label="Adjusted Forecast" value={fmt(summaryData.adjustedTotal)} sub="Excluding lost projects" />
        <SummaryCard
          label="Variance"
          value={fmt(summaryData.variance)}
          sub={summaryData.variance >= 0 ? "Increase" : "Decrease"}
        />
        <SummaryCard label="Active Contracts" value={summaryData.activeCount} />
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
          <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">Loading contracts…</div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No contracts found. Add one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10" />
                  <SortHead label="Project Name" k="project_name" />
                  <SortHead label="Customer" k="customer" />
                  <TableHead>Type</TableHead>
                  <TableHead colSpan={2} className="text-center">Forecast Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Forecast</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <React.Fragment key={c.id}>
                    <TableRow className={rowStyle(c)}>
                      <TableCell className="w-10" />
                      <TableCell className="text-sm font-medium">{c.project_name}</TableCell>
                      <TableCell className="text-sm">{c.customer || "—"}</TableCell>
                      <TableCell><ContractTypeBadge type={c.contract_type} /></TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">
                        <div className="text-xs text-muted-foreground mb-0.5">Original</div>
                        <div className="font-medium text-foreground">{fmt(c.original_value ?? c.contract_value)}</div>
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        <div className="text-xs text-muted-foreground mb-0.5">Adjusted</div>
                        <div className={`font-medium ${getValueColor(c)}`}>
                          {fmt(getAdjustedValue(c))}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell><ForecastBadge forecastStatus={c.forecast_status} /></TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openForecastEditor(c)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Inline Forecast Editor */}
                    {expandedForecastId === c.id && (
                      <TableRow className="bg-slate-50">
                        <TableCell colSpan={9} className="p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs mb-1.5 block">Forecast Status</Label>
                                <Select value={forecastForm.forecast_status} onValueChange={v => setForecastForm(f => ({ ...f, forecast_status: v }))}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FORECAST_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {(forecastForm.forecast_status === "reduced_scope" || forecastForm.forecast_status === "on_track") && (
                                <div>
                                  <Label className="text-xs mb-1.5 block">Adjusted Value</Label>
                                  <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={forecastForm.adjusted_value}
                                    onChange={e => setForecastForm(f => ({ ...f, adjusted_value: e.target.value }))}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              )}

                              {forecastForm.forecast_status === "delayed" && (
                                <div>
                                  <Label className="text-xs mb-1.5 block">New Start Date</Label>
                                  <Input
                                    type="date"
                                    value={forecastForm.adjusted_start_date}
                                    onChange={e => setForecastForm(f => ({ ...f, adjusted_start_date: e.target.value }))}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              )}
                            </div>

                            <div>
                              <Label className="text-xs mb-1.5 block">Notes</Label>
                              <Textarea
                                placeholder="Reason for change…"
                                value={forecastForm.forecast_notes}
                                onChange={e => setForecastForm(f => ({ ...f, forecast_notes: e.target.value }))}
                                className="text-xs h-20"
                              />
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => setExpandedForecastId(null)}>Cancel</Button>
                              <Button size="sm" onClick={() => handleSaveForecast(c.id)} disabled={savingForecast}>
                                {savingForecast ? "Saving…" : "Save Forecast"}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
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

            <div>
              <Label className="text-xs mb-1 block">Projected End Date (for Revenue Forecast)</Label>
              <Input
                type="date"
                value={form.projected_end_date}
                onChange={e => setForm(f => ({ ...f, projected_end_date: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">As of Date *</Label>
              <p className="text-xs text-muted-foreground mb-2">Only invoices after this date will reduce the expected revenue.</p>
              <Input
                type="date"
                value={form.backlog_as_of_date}
                onChange={e => setForm(f => ({ ...f, backlog_as_of_date: e.target.value }))}
              />
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