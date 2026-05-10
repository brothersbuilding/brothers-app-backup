import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, X, ChevronDown, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcProject } from "@/utils/projectCalcs";

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const s = "$" + Math.round(abs).toLocaleString("en-US");
  return n < 0 ? "-" + s : s;
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m] = dateStr.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

function mkMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = pct > 100 ? "#dc2626" : pct >= 100 ? "#2563eb" : "#16a34a";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div style={{ width: `${clamped}%`, backgroundColor: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-xs font-mono w-10 text-right" style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Project Form ──────────────────────────────────────────────────────────────
function ProjectForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    project_name: initial?.project_name || "",
    year: initial?.year ?? CURRENT_YEAR,
    start_date: initial?.start_date || "",
    end_date: initial?.end_date || "",
    projected_total: initial?.projected_total ?? "",
    status: initial?.status || "active",
    notes: initial?.notes || "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Name *</label>
          <input
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={form.project_name}
            onChange={e => set("project_name", e.target.value)}
            placeholder="Project name"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Year *</label>
          <input
            type="number"
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={form.year}
            onChange={e => set("year", parseInt(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Date</label>
          <input
            type="date"
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={form.start_date}
            onChange={e => set("start_date", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End Date</label>
          <input
            type="date"
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={form.end_date}
            onChange={e => set("end_date", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projected Total Revenue</label>
          <input
            type="number"
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={form.projected_total}
            onChange={e => set("projected_total", e.target.value === "" ? "" : parseFloat(e.target.value))}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
          <select
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={form.status}
            onChange={e => set("status", e.target.value)}
          >
            <option value="active">Active</option>
            <option value="complete">Complete</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
          <textarea
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none"
            rows={2}
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border border-border bg-background hover:bg-muted transition-colors">Cancel</button>
        <button
          onClick={() => onSave(form)}
          disabled={!form.project_name}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── Log Billing Modal ─────────────────────────────────────────────────────────
function LogBillingModal({ project, billings, onClose, onSaved }) {
  const [form, setForm] = useState({ month: new Date().getMonth() + 1, year: CURRENT_YEAR, amount_billed: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const projectBillings = useMemo(() =>
    [...(billings.filter(b => b.project_id === project.id))].sort((a, b) => a.month_key.localeCompare(b.month_key)),
    [billings, project.id]
  );

  const handleSave = async () => {
    if (!form.amount_billed && form.amount_billed !== 0) return;
    setSaving(true);
    const month_key = mkMonthKey(form.year, form.month);
    const existing = projectBillings.find(b => b.month_key === month_key);
    const payload = {
      project_id: project.id,
      project_name: project.project_name,
      year: form.year,
      month: form.month,
      month_key,
      amount_billed: parseFloat(form.amount_billed),
      notes: form.notes,
    };
    if (existing) {
      await base44.entities.ProjectBilling.update(existing.id, payload);
    } else {
      await base44.entities.ProjectBilling.create(payload);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="font-semibold text-base">Log Billing</p>
            <p className="text-xs text-muted-foreground mt-0.5">{project.project_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Month</label>
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={form.month}
                onChange={e => set("month", parseInt(e.target.value))}
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Year</label>
              <input
                type="number"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={form.year}
                onChange={e => set("year", parseInt(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount Billed *</label>
            <input
              type="number"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={form.amount_billed}
              onChange={e => set("amount_billed", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none"
              rows={2}
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || form.amount_billed === ""}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          {projectBillings.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Billing History</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Month</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Amount</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectBillings.map((b) => {
                      const [y, m] = b.month_key.split("-");
                      return (
                        <tr
                          key={b.id}
                          className="border-t border-border/40 hover:bg-muted/30 cursor-pointer"
                          onClick={() => setForm({ month: parseInt(m), year: parseInt(y), amount_billed: b.amount_billed, notes: b.notes || "" })}
                        >
                          <td className="px-3 py-2 text-xs">{MONTHS[parseInt(m) - 1]} {y}</td>
                          <td className="px-3 py-2 text-xs text-right font-mono font-semibold">{fmt(b.amount_billed)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[120px]">{b.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ProjectedRevenueSection() {
  const [open, setOpen] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [loggingProject, setLoggingProject] = useState(null);

  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ["projected-revenue"],
    queryFn: () => base44.entities.ProjectedRevenue.list("-year", 500),
  });

  const { data: billings = [] } = useQuery({
    queryKey: ["project-billing"],
    queryFn: () => base44.entities.ProjectBilling.list("month_key", 2000),
  });

  const availableYears = useMemo(() => {
    const years = new Set(projects.map(p => String(p.year)));
    years.add(String(CURRENT_YEAR));
    return [...years].sort().reverse();
  }, [projects]);

  const filteredProjects = useMemo(() =>
    projects.filter(p => String(p.year) === selectedYear),
    [projects, selectedYear]
  );

  const rows = useMemo(() => filteredProjects.map(p => {
    const calc = calcProject(p, billings);
    return { ...p, ...calc };
  }), [filteredProjects, billings]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    projected_total: acc.projected_total + (r.projected_total || 0),
    total_billed: acc.total_billed + r.total_billed,
    remaining: acc.remaining + r.remaining,
    projectedThisYear: acc.projectedThisYear + r.projectedThisYear,
    carryoverRevenue: acc.carryoverRevenue + r.carryoverRevenue,
  }), { projected_total: 0, total_billed: 0, remaining: 0, projectedThisYear: 0, carryoverRevenue: 0 }), [rows]);

  const overallPct = totals.projected_total > 0
    ? Math.min(100, (totals.total_billed / totals.projected_total) * 100)
    : 0;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["projected-revenue"] });
    queryClient.invalidateQueries({ queryKey: ["project-billing"] });
  };

  const handleSaveProject = async (form) => {
    const payload = { ...form, projected_total: form.projected_total === "" ? null : Number(form.projected_total) };
    if (editingProject) {
      await base44.entities.ProjectedRevenue.update(editingProject.id, payload);
    } else {
      await base44.entities.ProjectedRevenue.create(payload);
    }
    setShowForm(false);
    setEditingProject(null);
    refresh();
  };

  const statusBadge = (status) => {
    const colors = { active: "bg-green-100 text-green-800", complete: "bg-blue-100 text-blue-800", cancelled: "bg-muted text-muted-foreground" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colors[status] || colors.active}`}>{status}</span>;
  };

  const TH = "px-3 py-2.5 text-white text-xs font-semibold uppercase tracking-wide";

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="font-semibold text-base font-barlow uppercase tracking-wider">Projected Revenue</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-5 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              onClick={() => { setEditingProject(null); setShowForm(true); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Project
            </button>
          </div>

          {/* Form */}
          {(showForm || editingProject) && (
            <ProjectForm
              initial={editingProject}
              onSave={handleSaveProject}
              onCancel={() => { setShowForm(false); setEditingProject(null); }}
            />
          )}

          {/* Table */}
          {rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm border rounded-lg">
              No projects for {selectedYear}. Click "Add Project" to get started.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#1C2331" }}>
                    <th className={`${TH} text-left`}>Project</th>
                    <th className={`${TH} text-left`}>Status</th>
                    <th className={`${TH} text-right`}>Start</th>
                    <th className={`${TH} text-right`}>End</th>
                    <th className={`${TH} text-right`}>Projected Total</th>
                    <th className={`${TH} text-right`}>Billed to Date</th>
                    <th className={`${TH} text-right`}>Remaining</th>
                    <th className={`${TH} text-right`} style={{ backgroundColor: "#243040" }}>{CURRENT_YEAR} Revenue</th>
                    <th className={`${TH} text-right`}>Carryover</th>
                    <th className={`${TH} min-w-[160px]`}>Completion</th>
                    <th className={`${TH} text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#faf9f7" }} className="border-t border-border/40">
                      <td className="px-3 py-3 font-medium whitespace-nowrap">{row.project_name}</td>
                      <td className="px-3 py-3">{statusBadge(row.status)}</td>
                      <td className="px-3 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.start_date)}</td>
                      <td className="px-3 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.end_date)}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs">{fmt(row.projected_total)}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs">{fmt(row.total_billed)}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold" style={{ color: row.remaining < 0 ? "#dc2626" : undefined }}>
                        {fmt(row.remaining)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold" style={{ backgroundColor: i % 2 === 0 ? "rgba(202,160,80,0.08)" : "rgba(202,160,80,0.12)" }}>
                        {fmt(row.projectedThisYear)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground">{fmt(row.carryoverRevenue)}</td>
                      <td className="px-3 py-3">
                        <ProgressBar pct={row.completion_pct} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => setLoggingProject(row)}
                            className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted transition-colors whitespace-nowrap"
                          >
                            Log Billing
                          </button>
                          <button
                            onClick={() => { setEditingProject(row); setShowForm(false); }}
                            className="p-1 rounded border border-border bg-background hover:bg-muted transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer totals */}
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td className="px-3 py-3 font-bold text-sm" colSpan={2}>Totals</td>
                    <td colSpan={2} />
                    <td className="px-3 py-3 text-right font-mono text-xs font-bold">{fmt(totals.projected_total)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-bold">{fmt(totals.total_billed)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: totals.remaining < 0 ? "#dc2626" : undefined }}>
                      {fmt(totals.remaining)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ backgroundColor: "rgba(202,160,80,0.15)" }}>
                      {fmt(totals.projectedThisYear)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground font-bold">{fmt(totals.carryoverRevenue)}</td>
                    <td className="px-3 py-3">
                      <ProgressBar pct={overallPct} />
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Log Billing Modal */}
      {loggingProject && (
        <LogBillingModal
          project={loggingProject}
          billings={billings}
          onClose={() => setLoggingProject(null)}
          onSaved={() => { refresh(); }}
        />
      )}
    </div>
  );
}