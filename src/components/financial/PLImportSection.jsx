import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── CSV helpers ────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { result.push(cur.trim()); cur = ""; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function parseNum(s) {
  if (!s || s.trim() === "" || s.trim() === "-") return null;
  const cleaned = s.replace(/[$,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Parse QB header like "26-Jan", "Jan 26", "Jan 2026" → "2026-01"
function parseQBHeader(h) {
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  h = h.trim();
  const m1 = h.match(/^(\d{2})-([A-Za-z]{3})$/);
  if (m1) {
    const yr = parseInt(m1[1]) + 2000;
    const mon = MONTHS[m1[2].toLowerCase()];
    if (mon) return `${yr}-${String(mon).padStart(2,"0")}`;
  }
  const m2 = h.match(/^([A-Za-z]{3})\s+(\d{2,4})$/);
  if (m2) {
    const mon = MONTHS[m2[1].toLowerCase()];
    const yr = m2[2].length === 2 ? parseInt(m2[2]) + 2000 : parseInt(m2[2]);
    if (mon) return `${yr}-${String(mon).padStart(2,"0")}`;
  }
  return null;
}

function monthToQuarter(month) {
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

const TOTAL_LABELS = new Set(["Gross Profit", "Net Operating Income", "Net Income", "Net Other Income"]);
const SECTION_HEADERS = new Set(["Income", "Cost of Goods Sold", "Expenses", "Other Income/Expense", "Operating Expenses"]);

function detectSection(label, currentSection) {
  if (label === "Income") return "Income";
  if (label === "Cost of Goods Sold") return "Cost of Goods Sold";
  if (label === "Expenses" || label === "Operating Expenses") return "Expenses";
  if (label === "Other Income/Expense" || label === "Other Income") return "Expenses";
  return currentSection;
}

function detectRowType(label) {
  if (SECTION_HEADERS.has(label)) return "group_header";
  if (label.startsWith("Total for ") || label.startsWith("Total ")) return "subtotal";
  if (TOTAL_LABELS.has(label)) return "total";
  return "item";
}

function parseQBCSV(text, filename) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const headers = parseCSVLine(lines[0]);

  // Detect month columns
  const monthCols = []; // [{index, key, year, month}]
  headers.forEach((h, i) => {
    if (i === 0) return;
    const key = parseQBHeader(h);
    if (key) {
      const [yr, mo] = key.split("-").map(Number);
      monthCols.push({ index: i, key, year: yr, month: mo });
    }
  });

  if (monthCols.length === 0) throw new Error("No month columns found. Expected headers like '26-Jan', 'Jan 26', etc.");

  // Detect upload_type
  const upload_type = monthCols.length === 1 ? "monthly" : monthCols.length === 3 ? "quarterly" : "annual";

  // Parse rows, tracking section/parent/indent
  const today = new Date().toISOString().split("T")[0];
  const entries = [];
  let currentSection = "Income";
  let parentLabel = null;
  let depth = 0;

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cols = parseCSVLine(lines[rowIdx]);
    const label = (cols[0] || "").trim();
    if (!label) continue;

    const section = detectSection(label, currentSection);
    currentSection = section;
    const row_type = detectRowType(label);

    // Track indent depth
    let indent_level;
    if (row_type === "group_header") {
      indent_level = 0;
      depth = 1;
      parentLabel = label;
    } else if (row_type === "total") {
      indent_level = 0;
      depth = 0;
      parentLabel = null;
    } else if (row_type === "subtotal") {
      indent_level = Math.max(0, depth - 1);
      parentLabel = null;
    } else {
      indent_level = depth;
    }

    const sort_order = rowIdx - 1;
    const parent_label = row_type === "item" ? (parentLabel || "") : "";

    // One PLEntry per month column
    monthCols.forEach(({ index, key, year, month }) => {
      const raw = parseNum(cols[index]);
      const amount = raw ?? 0;
      entries.push({
        month_key: key,
        year,
        month,
        quarter: monthToQuarter(month),
        label,
        section,
        parent_label,
        row_type,
        indent_level,
        sort_order,
        amount,
        source_file: filename,
        upload_type,
        uploaded_date: today,
      });
    });
  }

  return entries;
}

export default function PLImportSection({ onImported }) {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setStatus("parsing");
    setMessage("");

    const text = await file.text();
    let entries;
    try {
      entries = parseQBCSV(text, file.name);
    } catch (err) {
      setStatus("error");
      setMessage(`Parse error: ${err.message}`);
      return;
    }

    setStatus("saving");
    try {
      // Get all month_keys in this import
      const monthKeys = [...new Set(entries.map((e) => e.month_key))];

      // Delete existing entries for these months (upsert by wiping & rewriting)
      const existing = await Promise.all(
        monthKeys.map((k) => base44.entities.PLEntry.filter({ month_key: k }))
      );
      const toDelete = existing.flat();
      await Promise.all(toDelete.map((r) => base44.entities.PLEntry.delete(r.id)));

      // Bulk create all new entries
      await base44.entities.PLEntry.bulkCreate(entries);

      const monthCount = monthKeys.length;
      const rowCount = entries.length / monthCount;
      setMessage(`Imported ${monthKeys.length} month(s) × ${Math.round(rowCount)} rows = ${entries.length} entries.`);
      setStatus("success");
      onImported?.();
    } catch (err) {
      setStatus("error");
      setMessage(`Save error: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a QuickBooks Profit & Loss CSV export. Month columns should be formatted like{" "}
        <code className="bg-muted px-1 rounded text-xs">26-Jan</code> with a{" "}
        <code className="bg-muted px-1 rounded text-xs">Total</code> column at the end (which will be ignored — totals are computed from monthly data).
      </p>

      <div className="flex items-center gap-3">
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={status === "parsing" || status === "saving"}
          className="gap-2"
        >
          {(status === "parsing" || status === "saving") ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {status === "parsing" ? "Parsing…" : status === "saving" ? "Saving…" : "Upload P&L CSV"}
        </Button>
      </div>

      {status === "success" && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}
    </div>
  );
}