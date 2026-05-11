import React, { useState, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Plus, X, Pencil, Trash2, ChevronUp, ChevronDown,
  Paperclip, Upload, FileText, Download, Loader2, FileDown
} from "lucide-react";
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";

const EQUIPMENT_TYPES = ["Vehicle", "Trailer", "Heavy Equipment", "Power Tool", "Hand Tool", "Other"];

const EMPTY_FORM = {
  name: "",
  equipment_type: "",
  vin_sn: "",
  date_purchased: "",
  purchase_price: "",
  assigned_to: "",
  has_title: false,
  has_registration: false,
  has_insurance: false,
  notes: "",
};

function fmt$(n) {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey === col) {
    return sortDir === "asc"
      ? <ChevronUp className="inline w-3 h-3 ml-1" />
      : <ChevronDown className="inline w-3 h-3 ml-1" />;
  }
  return <ChevronUp className="inline w-3 h-3 ml-1 opacity-30" />;
}

function Check({ checked }) {
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${checked ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
      {checked ? "✓" : "✗"}
    </span>
  );
}

// ── PDF Export ────────────────────────────────────────────────────────────────
function exportToPDF(entries) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = format(new Date(), "MMMM d, yyyy");

  // Header bar
  doc.setFillColor(28, 35, 49);
  doc.rect(0, 0, pageW, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("VEHICLES / EQUIPMENT", 40, 32);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Exported: " + now, pageW - 40, 32, { align: "right" });

  // Summary line
  const missingDocs = entries.filter(e => !e.has_title || !e.has_registration || !e.has_insurance).length;
  doc.setTextColor(28, 35, 49);
  doc.setFontSize(9);
  doc.text("Total Records: " + entries.length, 40, 68);
  if (missingDocs > 0) {
    doc.setTextColor(180, 83, 9);
    doc.text("! " + missingDocs + " record" + (missingDocs !== 1 ? "s" : "") + " missing title, registration, or insurance", 160, 68);
  }

  // Table columns
  const cols = [
    { label: "Name",           width: 110, align: "left"   },
    { label: "Type",           width: 80,  align: "left"   },
    { label: "VIN / SN",       width: 100, align: "left"   },
    { label: "Date Purchased", width: 85,  align: "left"   },
    { label: "Purchase Price", width: 80,  align: "right"  },
    { label: "Assigned To",    width: 85,  align: "left"   },
    { label: "Title",          width: 42,  align: "center" },
    { label: "Registration",   width: 70,  align: "center" },
    { label: "Insurance",      width: 58,  align: "center" },
  ];
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const rowH = 20;
  const cellPad = 5;
  const startX = 40;
  let y = 80;

  // Header row
  doc.setFillColor(28, 35, 49);
  doc.rect(startX, y, totalW, rowH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let cx = startX;
  for (const col of cols) {
    const tx = col.align === "right" ? cx + col.width - cellPad
             : col.align === "center" ? cx + col.width / 2
             : cx + cellPad;
    doc.text(col.label, tx, y + 13, { align: col.align === "left" ? "left" : col.align });
    cx += col.width;
  }
  y += rowH;

  // Data rows
  doc.setFont("helvetica", "normal");
  for (let ri = 0; ri < entries.length; ri++) {
    const e = entries[ri];
    const incomplete = !e.has_title || !e.has_registration || !e.has_insurance;
    const bg = incomplete ? [255, 251, 235] : ri % 2 === 0 ? [255, 255, 255] : [250, 249, 247];
    doc.setFillColor(...bg);
    doc.rect(startX, y, totalW, rowH, "F");
    doc.setDrawColor(220, 215, 205);
    doc.rect(startX, y, totalW, rowH, "S");

    const rowData = [
      e.name || "-",
      e.equipment_type || "-",
      e.vin_sn || "-",
      fmtDate(e.date_purchased),
      e.purchase_price ? fmt$(e.purchase_price) : "-",
      e.assigned_to || "-",
      e.has_title ? "YES" : "NO",
      e.has_registration ? "YES" : "NO",
      e.has_insurance ? "YES" : "NO",
    ];

    cx = startX;
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const val = rowData[ci];
      if (ci >= 6) {
        doc.setTextColor(...(val === "YES" ? [21, 128, 61] : [185, 28, 28]));
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(28, 35, 49);
        doc.setFont("helvetica", "normal");
      }
      doc.setFontSize(7.5);
      const tx = col.align === "right" ? cx + col.width - cellPad
               : col.align === "center" ? cx + col.width / 2
               : cx + cellPad;
      const maxChars = Math.floor((col.width - cellPad * 2) / 4.2);
      const txt = val.length > maxChars ? val.substring(0, maxChars - 1) + "…" : val;
      doc.text(txt, tx, y + 13, { align: col.align === "left" ? "left" : col.align });
      cx += col.width;
    }
    y += rowH;

    if (y > pageH - 40 && ri < entries.length - 1) {
      doc.addPage();
      y = 40;
    }
  }

  // Notes section
  const withNotes = entries.filter(e => e.notes && e.notes.trim());
  if (withNotes.length > 0) {
    y += 16;
    if (y > pageH - 60) { doc.addPage(); y = 40; }
    doc.setFillColor(28, 35, 49);
    doc.rect(40, y, pageW - 80, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("NOTES", 48, y + 13);
    y += 28;
    for (const entry of withNotes) {
      if (y > pageH - 80) { doc.addPage(); y = 40; }
      doc.setTextColor(28, 35, 49);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(entry.name, 40, y);
      y += 13;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(entry.notes, pageW - 80);
      doc.text(lines, 40, y);
      y += lines.length * 11 + 10;
    }
  }

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("Brothers Building  |  Page " + i + " of " + totalPages, pageW / 2, pageH - 18, { align: "center" });
  }

  doc.save("vehicles-equipment-" + format(new Date(), "yyyy-MM-dd") + ".pdf");
}

// ── Document Panel ────────────────────────────────────────────────────────────
function DocumentPanel({ entryId }) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["vehicle-docs", entryId],
    queryFn: () => base44.entities.VehicleDocument.filter({ vehicle_id: entryId }, "-created_date", 200),
  });

  const refreshDocs = () => queryClient.invalidateQueries({ queryKey: ["vehicle-docs", entryId] });

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.VehicleDocument.create({
          vehicle_id: entryId,
          file_name: file.name,
          file_url,
          file_size: file.size,
          file_type: file.type,
        });
      }
      refreshDocs();
    } catch (err) {
      console.error("Upload failed", err);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Remove this attachment?")) return;
    setDeletingId(docId);
    await base44.entities.VehicleDocument.delete(docId);
    refreshDocs();
    setDeletingId(null);
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="w-3 h-3" /> Documents
        </p>
        <div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            disabled={uploading}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
          >
            {uploading ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</> : <><Upload className="w-3 h-3" /> Add File</>}
          </button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground italic">Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No documents attached. Click "Add File" to upload.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-background/60" onClick={(e) => e.stopPropagation()}>
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate font-medium text-foreground text-xs">{doc.file_name}</span>
              {doc.file_size && <span className="text-xs text-muted-foreground shrink-0">{formatSize(doc.file_size)}</span>}
              <a href={doc.file_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                className="text-xs px-2 py-0.5 rounded border border-border bg-background hover:bg-muted transition-colors shrink-0">View</a>
              <a href={doc.file_url} download={doc.file_name} onClick={(e) => e.stopPropagation()}
                className="p-1 rounded border border-border bg-background hover:bg-muted transition-colors shrink-0" title="Download">
                <Download className="w-3.5 h-3.5" />
              </a>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }} disabled={deletingId === doc.id}
                className="p-1 rounded border border-border bg-background hover:bg-red-50 text-red-500 transition-colors shrink-0" title="Remove">
                {deletingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, purchase_price: form.purchase_price === "" ? null : parseFloat(form.purchase_price) };
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
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">{initial?.id ? "Edit" : "Add"} Vehicle / Equipment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name *</label>
            <input className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. 2022 Ford F-250" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={form.equipment_type} onChange={e => set("equipment_type", e.target.value)}>
              <option value="">— Select type —</option>
              {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">VIN / Serial Number</label>
            <input className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background font-mono"
              value={form.vin_sn} onChange={e => set("vin_sn", e.target.value)} placeholder="e.g. 1FTFW1ET2NFA12345" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Purchased</label>
              <input type="date" className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={form.date_purchased} onChange={e => set("date_purchased", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purchase Price</label>
              <input type="number" className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned To</label>
            <input className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)} placeholder="Employee name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none"
              rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional details..." />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-1">
            {[["has_title", "Title"], ["has_registration", "Registration"], ["has_insurance", "Insurance"]].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 accent-primary" checked={!!form[key]} onChange={e => set(key, e.target.checked)} />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VehiclesEquipment() {
  const [modalEntry, setModalEntry] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["vehicle-equipment"],
    queryFn: () => base44.entities.VehicleEquipment.list("-created_date", 500),
  });

  const sortedEntries = useMemo(() => {
    if (!sortKey) return entries;
    return [...entries].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [entries, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

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
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Vehicles / Equipment</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track company vehicles and equipment — title, registration, and insurance status</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportToPDF(sortedEntries)}
            disabled={isLoading || entries.length === 0}
            className="flex items-center gap-1.5"
          >
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
          <Button onClick={() => setModalEntry({})} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add New
          </Button>
        </div>
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
                <th className={`${TH} cursor-pointer`} onClick={() => handleSort("name")}>Name<SortIcon col="name" sortKey={sortKey} sortDir={sortDir} /></th>
                <th className={`${TH} cursor-pointer`} onClick={() => handleSort("equipment_type")}>Type<SortIcon col="equipment_type" sortKey={sortKey} sortDir={sortDir} /></th>
                <th className={TH}>VIN / SN</th>
                <th className={`${TH} cursor-pointer`} onClick={() => handleSort("date_purchased")}>Date Purchased<SortIcon col="date_purchased" sortKey={sortKey} sortDir={sortDir} /></th>
                <th className={`${TH} text-right cursor-pointer`} onClick={() => handleSort("purchase_price")}>Purchase Price<SortIcon col="purchase_price" sortKey={sortKey} sortDir={sortDir} /></th>
                <th className={`${TH} cursor-pointer`} onClick={() => handleSort("assigned_to")}>Assigned To<SortIcon col="assigned_to" sortKey={sortKey} sortDir={sortDir} /></th>
                <th className={`${TH} text-center`}>Title</th>
                <th className={`${TH} text-center`}>Registration</th>
                <th className={`${TH} text-center`}>Insurance</th>
                <th className={`${TH} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry, i) => {
                const incomplete = !entry.has_title || !entry.has_registration || !entry.has_insurance;
                const rowBg = incomplete
                  ? (i % 2 === 0 ? "#fffbeb" : "#fef9e0")
                  : (i % 2 === 0 ? "#ffffff" : "#faf9f7");
                const isExpanded = expandedId === entry.id;
                return (
                  <React.Fragment key={entry.id}>
                    <tr style={{ backgroundColor: rowBg }}
                      className="border-t border-border/40 cursor-pointer hover:brightness-95 transition-all"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                      <td className="px-4 py-3 font-medium">
                        {incomplete && <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-2 align-middle" />}
                        {entry.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{entry.equipment_type || "—"}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{entry.vin_sn || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(entry.date_purchased)}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt$(entry.purchase_price)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{entry.assigned_to || "—"}</td>
                      <td className="px-4 py-3 text-center"><Check checked={!!entry.has_title} /></td>
                      <td className="px-4 py-3 text-center"><Check checked={!!entry.has_registration} /></td>
                      <td className="px-4 py-3 text-center"><Check checked={!!entry.has_insurance} /></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-1 justify-center" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setModalEntry(entry)}
                            className="p-1.5 rounded border border-border bg-background hover:bg-muted transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded border border-border bg-background hover:bg-red-50 text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: rowBg }} className="border-t border-border/20">
                        <td colSpan={10} className="px-6 py-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {entry.notes ? entry.notes : <span className="text-muted-foreground italic">No notes added.</span>}
                          </p>
                          <DocumentPanel entryId={entry.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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