import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Pencil, Loader2, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import MatchedInvoicesPanel from "@/components/financial/MatchedInvoicesPanel";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

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

function ForecastStatusBadge({ status }) {
  const styles = {
    on_track: "bg-green-100 text-green-800",
    lost: "bg-red-100 text-red-700",
    delayed: "bg-blue-100 text-blue-800",
    reduced_scope: "bg-yellow-100 text-yellow-800",
  };
  const labels = { on_track: "On Track", lost: "Lost", delayed: "Delayed", reduced_scope: "Reduced Scope" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status ?? "—"}
    </span>
  );
}

function BilledProgressBar({ invoiced, contractValue }) {
  const pct = contractValue > 0 ? (invoiced / contractValue) * 100 : 0;
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
      <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function SummaryCard({ label, value, sub, muted = false }) {
  return (
    <div className={`${muted ? "bg-muted/30" : "bg-card border"} rounded-xl p-4 shadow-sm`}>
      <p className={`text-xs mb-1 ${muted ? "text-muted-foreground" : "text-muted-foreground"}`}>{label}</p>
      <p className={`text-xl font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
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
  backlog_as_of_date: getTodayString(),
  projected_end_date: "",
  forecast_status: "on_track",
  notes: "",
};

export default function ContractBacklogTable({ onEdit, invoices = [] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saveMessage, setSaveMessage] = useState(null);

  const { data: backlogData, isLoading } = useQuery({
    queryKey: ["contract-backlog"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getContractBacklog", {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const contracts = backlogData?.contracts ?? [];
  const summary = backlogData?.summary ?? {};
  
  // Get the current full contract object for editing (not just backlog data)
  const { data: allContracts = [] } = useQuery({
    queryKey: ["all-contracts"],
    queryFn: () => base44.entities.Contract.list(),
  });

  const projectOptions = useMemo(() => {
    const names = [...new Set(invoices.map(i => i.project).filter(Boolean))].sort();
    return names;
  }, [invoices]);



  const sorted = useMemo(() => {
    // Separate active and complete (over-billed)
    const active = [];
    const complete = [];
    
    contracts.forEach(c => {
      const isOverBilled = c.total_invoiced > c.contract_value;
      if (isOverBilled) {
        complete.push(c);
      } else {
        active.push(c);
      }
    });
    
    // Sort each group by value
    active.sort((a, b) => b.contract_value - a.contract_value);
    complete.sort((a, b) => b.contract_value - a.contract_value);
    
    return [...active, ...complete];
  }, [contracts]);

  const totals = useMemo(() => {
    // Only include active contracts (not over-billed) in calculations
    const activeContracts = sorted.filter(c => c.total_invoiced <= c.contract_value);
    return {
      contract_value: activeContracts.reduce((s, c) => s + c.contract_value, 0),
      adjusted_value: activeContracts.reduce((s, c) => s + (c.adjusted_value ?? c.contract_value), 0),
      total_invoiced: activeContracts.reduce((s, c) => s + c.total_invoiced, 0),
      remaining_value: activeContracts.reduce((s, c) => s + c.remaining_value, 0),
      projected_this_year: activeContracts.reduce((s, c) => s + c.projected_revenue_this_year, 0),
      projected_next_year: activeContracts.reduce((s, c) => s + c.projected_revenue_next_year, 0),
    };
  }, [sorted]);

  async function handleSave() {
    setSaving(true);
    try {
      await base44.entities.Contract.create({
        ...form,
        contract_value: parseFloat(form.contract_value) || 0,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["contract-backlog"] });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(contract) {
    // Find the full contract object from allContracts
    const fullContract = allContracts.find(c => c.id === contract.id);
    setEditingId(contract.id);
    setEditForm({
      project_name: contract.project_name || "",
      contract_type: contract.contract_type || "res_gc",
      contract_value: contract.contract_value || "",
      backlog_as_of_date: contract.backlog_as_of_date || "",
      projected_end_date: contract.projected_end_date || "",
      forecast_status: contract.forecast_status || "on_track",
      adjusted_value: contract.adjusted_value || "",
      adjusted_start_date: contract.adjusted_start_date || "",
      notes: contract.notes || "",
      manual_invoice_ids: fullContract?.manual_invoice_ids || [],
      excluded_invoice_ids: fullContract?.excluded_invoice_ids || [],
    });
  }

  async function handleEditSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        project_name: editForm.project_name,
        contract_type: editForm.contract_type,
        contract_value: parseFloat(editForm.contract_value) || 0,
        backlog_as_of_date: editForm.backlog_as_of_date,
        projected_end_date: editForm.projected_end_date,
        forecast_status: editForm.forecast_status,
        adjusted_value: editForm.adjusted_value ? parseFloat(editForm.adjusted_value) : undefined,
        adjusted_start_date: editForm.adjusted_start_date,
        notes: editForm.notes,
        manual_invoice_ids: editForm.manual_invoice_ids,
        excluded_invoice_ids: editForm.excluded_invoice_ids,
      };
      
      console.log("Saving contract with payload:", payload);
      
      await base44.entities.Contract.update(editingId, payload);
      
      // Re-fetch to confirm save
      const updated = await base44.entities.Contract.list();
      const savedContract = updated.find(c => c.id === editingId);
      console.log("Contract saved and re-fetched:", {
        id: editingId,
        backlog_as_of_date: savedContract?.backlog_as_of_date,
        projected_end_date: savedContract?.projected_end_date,
        manual_invoice_ids: savedContract?.manual_invoice_ids,
        excluded_invoice_ids: savedContract?.excluded_invoice_ids,
      });
      
      const manualCount = (savedContract?.manual_invoice_ids || []).length;
      setSaveMessage({
        type: "success",
        text: `Contract saved successfully${manualCount > 0 ? ` • ${manualCount} invoices manually linked` : ""}`,
      });
      
      setTimeout(() => {
        setEditingId(null);
        setEditForm({});
        setSaveMessage(null);
        queryClient.invalidateQueries({ queryKey: ["contract-backlog"] });
        queryClient.invalidateQueries({ queryKey: ["all-contracts"] });
      }, 1500);
    } catch (error) {
      console.error("Error saving contract:", error);
      setSaveMessage({
        type: "error",
        text: `Error saving contract: ${error.message || "Unknown error"}`,
      });
      setSaving(false);
    }
  }

  function closeEdit() {
    setEditingId(null);
    setEditForm({});
  }

  function addManualInvoice(invoiceId) {
    setEditForm(f => ({
      ...f,
      manual_invoice_ids: [...(f.manual_invoice_ids || []), invoiceId],
    }));
  }

  function removeManualInvoice(invoiceId) {
    setEditForm(f => ({
      ...f,
      manual_invoice_ids: (f.manual_invoice_ids || []).filter(id => id !== invoiceId),
    }));
  }

  function excludeInvoice(invoiceId) {
    setEditForm(f => ({
      ...f,
      excluded_invoice_ids: [...(f.excluded_invoice_ids || []), invoiceId],
    }));
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Projected Revenue</h2>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Project
          </Button>
        </div>

        {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Original Projection" value={fmt(totals.contract_value)} />
        <SummaryCard label="Adjusted Forecast" value={fmt(totals.adjusted_value)} />
        <SummaryCard label="Projected This Year" value={fmt(totals.projected_this_year)} />
        <SummaryCard label="Carrying to 2027" value={fmt(totals.projected_next_year)} muted={true} sub="Future revenue" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading backlog…
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No active contracts found.</div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Project</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs text-right">Contract Value</TableHead>
                  <TableHead className="text-xs text-right">Invoiced to Date</TableHead>
                  <TableHead className="text-xs text-right">Remaining</TableHead>
                  <TableHead className="text-xs">% Billed</TableHead>
                  <TableHead className="text-xs">End Date <span className="text-muted-foreground font-normal text-[10px]">(click edit to add)</span></TableHead>
                  <TableHead className="text-xs text-right">Monthly Run Rate</TableHead>
                  <TableHead className="text-xs text-right">This Year</TableHead>
                  <TableHead className="text-xs text-right">Beyond 2026</TableHead>
                  <TableHead className="text-xs">Forecast Status</TableHead>
                  <TableHead className="text-right w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(c => {
                   const isComplete = c.total_invoiced > c.contract_value;
                   const isEditing = editingId === c.id;
                   return (
                   <React.Fragment key={c.id}>
                     <TableRow className={isComplete ? "bg-muted/20 hover:bg-muted/30 opacity-60" : "hover:bg-muted/50"}>
                       <TableCell className="text-sm font-medium">{c.project_name}</TableCell>
                       <TableCell><ContractTypeBadge type={c.contract_type} /></TableCell>
                       <TableCell className="text-sm text-right">{fmt(c.contract_value)}</TableCell>
                       <TableCell className="text-sm text-right text-green-700">{fmt(c.total_invoiced)}</TableCell>
                       <TableCell className="text-sm text-right font-semibold">{fmt(c.remaining_value)}</TableCell>
                       <TableCell><BilledProgressBar invoiced={c.total_invoiced} contractValue={c.contract_value} /></TableCell>
                       <TableCell className="text-sm text-muted-foreground">
                         {c.projected_end_date ? format(parseISO(c.projected_end_date), "MMM d, yyyy") : "—"}
                       </TableCell>
                       <TableCell className="text-sm text-right">{fmt(c.monthly_run_rate)}</TableCell>
                       <TableCell className="text-sm text-right font-semibold">{fmt(c.projected_revenue_this_year)}</TableCell>
                       <TableCell className={`text-sm text-right ${c.projected_revenue_next_year > 0 ? "text-muted-foreground font-semibold" : ""}`}>
                         {fmt(c.projected_revenue_next_year)}
                       </TableCell>
                       <TableCell>{isComplete ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Complete</span> : <ForecastStatusBadge status={c.forecast_status} />}</TableCell>
                       <TableCell className="text-right">
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-7 w-7"
                           onClick={() => openEdit(c)}
                         >
                           <Pencil className="w-3.5 h-3.5" />
                         </Button>
                       </TableCell>
                     </TableRow>
                     {isEditing && (
                       <TableRow className="bg-muted/30">
                         <TableCell colSpan={12} className="p-4">
                           <div className="space-y-4 max-h-[600px] overflow-y-auto">
                             <h3 className="text-sm font-semibold">Edit Contract</h3>
                             <div className="grid grid-cols-2 gap-4">
                               <div>
                                 <Label className="text-xs mb-1 block">Project Name</Label>
                                 <Input
                                   value={editForm.project_name}
                                   onChange={e => setEditForm(f => ({ ...f, project_name: e.target.value }))}
                                 />
                               </div>
                               <div>
                                 <Label className="text-xs mb-1 block">Contract Type</Label>
                                 <Select value={editForm.contract_type} onValueChange={v => setEditForm(f => ({ ...f, contract_type: v }))}>
                                   <SelectTrigger>
                                     <SelectValue />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="res_gc">Residential GC</SelectItem>
                                     <SelectItem value="com_gc">Commercial GC</SelectItem>
                                     <SelectItem value="sub_cont">Sub Contract</SelectItem>
                                   </SelectContent>
                                 </Select>
                               </div>
                               <div>
                                 <Label className="text-xs mb-1 block">Contract Value</Label>
                                 <Input
                                   type="number"
                                   value={editForm.contract_value}
                                   onChange={e => setEditForm(f => ({ ...f, contract_value: e.target.value }))}
                                 />
                               </div>
                               <div>
                                 <Label className="text-xs mb-1 block">Backlog as of Date</Label>
                                 <Input
                                   type="date"
                                   value={editForm.backlog_as_of_date}
                                   onChange={e => setEditForm(f => ({ ...f, backlog_as_of_date: e.target.value }))}
                                 />
                               </div>
                               <div>
                                 <Label className="text-xs mb-1 block">Projected End Date</Label>
                                 <Input
                                   type="date"
                                   value={editForm.projected_end_date}
                                   onChange={e => setEditForm(f => ({ ...f, projected_end_date: e.target.value }))}
                                 />
                               </div>
                               <div>
                                 <Label className="text-xs mb-1 block">Forecast Status</Label>
                                 <Select value={editForm.forecast_status} onValueChange={v => setEditForm(f => ({ ...f, forecast_status: v }))}>
                                   <SelectTrigger>
                                     <SelectValue />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="on_track">On Track</SelectItem>
                                     <SelectItem value="delayed">Delayed</SelectItem>
                                     <SelectItem value="reduced_scope">Reduced Scope</SelectItem>
                                     <SelectItem value="lost">Lost</SelectItem>
                                   </SelectContent>
                                 </Select>
                               </div>
                               {editForm.forecast_status === "reduced_scope" && (
                                 <div>
                                   <Label className="text-xs mb-1 block">Adjusted Value</Label>
                                   <Input
                                     type="number"
                                     value={editForm.adjusted_value}
                                     onChange={e => setEditForm(f => ({ ...f, adjusted_value: e.target.value }))}
                                   />
                                 </div>
                               )}
                               {editForm.forecast_status === "delayed" && (
                                 <div>
                                   <Label className="text-xs mb-1 block">Adjusted Start Date</Label>
                                   <Input
                                     type="date"
                                     value={editForm.adjusted_start_date}
                                     onChange={e => setEditForm(f => ({ ...f, adjusted_start_date: e.target.value }))}
                                   />
                                 </div>
                               )}
                               <div className="col-span-2">
                                 <Label className="text-xs mb-1 block">Notes</Label>
                                 <Textarea
                                   placeholder="Optional notes…"
                                   rows={2}
                                   value={editForm.notes}
                                   onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                 />
                               </div>
                             </div>

                             <MatchedInvoicesPanel
                               contract={{
                                 ...editForm,
                                 id: editingId,
                               }}
                               allInvoices={invoices}
                               onAddManualInvoice={addManualInvoice}
                               onRemoveManualInvoice={removeManualInvoice}
                               onExcludeInvoice={excludeInvoice}
                             />

                             {saveMessage && (
                               <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${saveMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                 {saveMessage.type === 'success' ? (
                                   <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                 ) : (
                                   <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                 )}
                                 {saveMessage.text}
                               </div>
                             )}

                             <div className="flex justify-end gap-2 border-t pt-4">
                               <Button variant="outline" onClick={closeEdit} disabled={saving}>Cancel</Button>
                               <Button onClick={handleEditSave} disabled={saving}>
                                 {saving ? "Saving…" : "Save"}
                               </Button>
                             </div>
                           </div>
                         </TableCell>
                       </TableRow>
                     )}
                   </React.Fragment>
                   );
                })}
                {/* Totals Row */}
                <TableRow className="bg-muted/70 font-semibold border-t-2">
                  <TableCell className="text-sm" colSpan={2}>Totals ({sorted.length} contracts)</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.contract_value)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.total_invoiced)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.remaining_value)}</TableCell>
                  <TableCell><BilledProgressBar invoiced={totals.total_invoiced} contractValue={totals.contract_value} /></TableCell>
                  <TableCell />
                  <TableCell className="text-sm text-right">{fmt(totals.projected_this_year / sorted.length)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.projected_this_year)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.projected_next_year)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      </div>

      {/* Add Project Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block">Project Name *</Label>
              {projectOptions.length > 0 ? (
                <Select value={form.project_name} onValueChange={v => setForm(f => ({ ...f, project_name: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select or type project…" />
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
                  placeholder="Enter project name"
                  value={form.project_name === "__custom__" ? "" : form.project_name}
                  onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                />
              )}
            </div>

            <div>
              <Label className="text-xs mb-1 block">Customer Name *</Label>
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
                    <SelectItem value="res_gc">Residential GC</SelectItem>
                    <SelectItem value="com_gc">Commercial GC</SelectItem>
                    <SelectItem value="sub_cont">Sub Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Backlog as of Date *</Label>
                <Input
                  type="date"
                  value={form.backlog_as_of_date}
                  onChange={e => setForm(f => ({ ...f, backlog_as_of_date: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Projected End Date</Label>
                <Input
                  type="date"
                  value={form.projected_end_date}
                  onChange={e => setForm(f => ({ ...f, projected_end_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Forecast Status</Label>
              <Select value={form.forecast_status} onValueChange={v => setForm(f => ({ ...f, forecast_status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="reduced_scope">Reduced Scope</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Notes</Label>
              <Textarea
                placeholder="Optional notes…"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.project_name || !form.customer || !form.contract_value}>
                {saving ? "Saving…" : "Add Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}