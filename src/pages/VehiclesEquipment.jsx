import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

const EMPTY_FORM = {
  name: "",
  date_purchased: "",
  purchase_price: "",
  assigned_to: "",
  has_title: false,
  has_registration: false,
  has_insurance: false,
};

function fmt$(n) {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function Check({ checked }) {
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${checked ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
      {checked ? "✓" : "✗"}
    </span>
  );
}

function Modal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      purchase_price: form.purchase_price === "" ? null : parseFloat(form.purchase_price),
    };
    if (initial?.id) {
      await base44.entities.VehicleEquipment.update(initial.id, payload);
    } else {
      await base44.entities.VehicleEquipment.create(payload);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">{initial?.id ? "Edit" : "Add"} Vehicle / Equipment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name *</label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. 2022 Ford F-250"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Purchased</label>
              <input
                type="date"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={form.date_purchased}
                onChange={e => set("date_purchased", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purchase Price</label>
              <input
                type="number"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={form.purchase_price}
                onChange={e => set("purchase_price", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned To</label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={form.assigned_to}
              onChange={e => set("assigned_to", e.target.value)}
              placeholder="Employee name"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-1">
            {[["has_title", "Title"], ["has_registration", "Registration"], ["has_insurance", "Insurance"]].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={!!form[key]}
                  onChange={e => set(key, e.target.checked)}
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VehiclesEquipment() {
  const [modalEntry, setModalEntry] = useState(null); // null = closed, {} = new, {...} = edit
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["vehicle-equipment"],
    queryFn: () => base44.entities.VehicleEquipment.list("-created_date", 500),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["vehicle-equipment"] });

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    await base44.entities.VehicleEquipment.delete(id);
    refresh();
  };

  const TH = "px-4 py-2.5 text-white text-xs font-semibold uppercase tracking-wide text-left";

  return (
    <div className="min-h-screen bg-background p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">
            Vehicles / Equipment
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track company vehicles and equipment — title, registration, and insurance status
          </p>
        </div>
        <Button onClick={() => setModalEntry({})} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add New
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="border rounded-xl p-12 text-center text-muted-foreground text-sm bg-card">
          No vehicles or equipment yet. Click "Add New" to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#1C2331" }}>
                <th className={TH}>Name</th>
                <th className={TH}>Date Purchased</th>
                <th className={`${TH} text-right`}>Purchase Price</th>
                <th className={TH}>Assigned To</th>
                <th className={`${TH} text-center`}>Title</th>
                <th className={`${TH} text-center`}>Registration</th>
                <th className={`${TH} text-center`}>Insurance</th>
                <th className={`${TH} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const incomplete = !entry.has_title || !entry.has_registration || !entry.has_insurance;
                const rowBg = incomplete
                  ? (i % 2 === 0 ? "#fffbeb" : "#fef9e0")
                  : (i % 2 === 0 ? "#ffffff" : "#faf9f7");
                return (
                  <tr key={entry.id} style={{ backgroundColor: rowBg }} className="border-t border-border/40">
                    <td className="px-4 py-3 font-medium">
                      {incomplete && (
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-2 align-middle" />
                      )}
                      {entry.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.date_purchased ? format(parseISO(entry.date_purchased), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmt$(entry.purchase_price)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.assigned_to || "—"}</td>
                    <td className="px-4 py-3 text-center"><Check checked={!!entry.has_title} /></td>
                    <td className="px-4 py-3 text-center"><Check checked={!!entry.has_registration} /></td>
                    <td className="px-4 py-3 text-center"><Check checked={!!entry.has_insurance} /></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => setModalEntry(entry)}
                          className="p-1.5 rounded border border-border bg-background hover:bg-muted transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 rounded border border-border bg-background hover:bg-red-50 text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalEntry !== null && (
        <Modal
          initial={modalEntry?.id ? modalEntry : null}
          onClose={() => setModalEntry(null)}
          onSaved={() => { setModalEntry(null); refresh(); }}
        />
      )}
    </div>
  );
}