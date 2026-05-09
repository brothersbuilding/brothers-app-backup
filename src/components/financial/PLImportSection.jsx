import React, { useState, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

const LS_KEY = "pl_upload_history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function saveHistory(entries) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, 20))); } catch {}
}

async function processBatched(items, batchSize, delayMs, fn) {
  let i = 0;
  while (i < items.length) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(fn));
    i += batchSize;
    if (i < items.length) await new Promise((r) => setTimeout(r, delayMs));
  }
}

// ── CSV parser ─────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === "," && !inQuote) { result.push(cur.trim()); cur = ""; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function parseAmount(s) {
  if (!s) return null;
  const t = s.replace(/[$"\s]/g, "").trim();
  if (t === "" || t === "-") return null;
  const neg = /^\((.+)\)$/.exec(t);
  const clean = neg ? "-" + neg[1].replace(/,/g, "") : t.replace(/,/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function parseMonthHeader(h) {
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  h = (h || "").trim();
  const m1 = h.match(/^(\d{2})-([A-Za-z]{3})$/);
  if (m1) {
    const year = parseInt(m1[1]) + 2000;
    const month = MONTHS[m1[2].toLowerCase()];
    if (month) return { key: `${year}-${String(month).padStart(2,"0")}`, year, month };
  }
  const m2 = h.match(/^([A-Za-z]{3})[-\s](\d{2,4})$/);
  if (m2) {
    const month = MONTHS[m2[1].toLowerCase()];
    const year = m2[2].length === 2 ? parseInt(m2[2]) + 2000 : parseInt(m2[2]);
    if (month) return { key: `${year}-${String(month).padStart(2,"0")}`, year, month };
  }
  return null;
}

function uploadTypeFromCount(n) {
  if (n === 1) return "monthly";
  if (n <= 3) return "quarterly";
  return "annual";
}

const GROUP_HEADERS = new Set(["Income", "Cost of Goods Sold", "Expenses"]);
const TOTAL_LABELS = new Set(["Gross Profit", "Net Operating Income", "Net Other Income", "Net Income"]);

function classifyRow(label) {
  if (GROUP_HEADERS.has(label)) return "group_header";
  if (label.startsWith("Total for ")) return "subtotal";
  if (TOTAL_LABELS.has(label)) return "total";
  return "item";
}

function parseQBCSV(text, filename) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV has too few rows");

  const headers = parseCSVLine(lines[0]);

  const monthCols = [];
  headers.forEach((h, i) => {
    if (i === 0) return;
    const parsed = parseMonthHeader(h);
    if (parsed) monthCols.push({ index: i, ...parsed });
  });

  if (monthCols.length === 0) throw new Error('No month columns detected. Expected headers like "26-Jan".');

  const upload_type = uploadTypeFromCount(monthCols.length);
  const today = new Date().toISOString().split("T")[0];

  // Pre-scan: find all labels that have a "Total for <label>" counterpart
  const subtotaled = new Set();
  for (let ri = 1; ri < lines.length; ri++) {
    const cols = parseCSVLine(lines[ri]);
    const label = (cols[0] || "").trim();
    if (label.startsWith("Total for ")) subtotaled.add(label.replace(/^Total for /, ""));
  }

  // Parse with correct parent tracking
  const finalRows = [];
  let currentSection = "Income";
  let parentStack = [];

  for (let ri = 1; ri < lines.length; ri++) {
    const cols = parseCSVLine(lines[ri]);
    const label = (cols[0] || "").trim();
    if (!label) continue;

    const row_type = classifyRow(label);

    if (row_type === "group_header") {
      currentSection = label;
      parentStack = [];
    } else if (row_type === "subtotal") {
      const closing = label.replace(/^Total for /, "");
      const idx = parentStack.lastIndexOf(closing);
      if (idx >= 0) parentStack = parentStack.slice(0, idx);
    } else if (row_type === "item") {
      if (subtotaled.has(label)) parentStack.push(label);
    }

    const section = row_type === "total" ? "Summary" : currentSection;

    let parent_label = "";
    if (row_type === "item" && !subtotaled.has(label)) {
      parent_label = parentStack.length > 0 ? parentStack[parentStack.length - 1] : "";
    }

    let indent_level = 0;
    if (row_type === "item") indent_level = parent_label ? 2 : 1;
    else if (row_type === "subtotal") indent_level = 1;

    // Build amounts map for this row
    const amounts = {};
    monthCols.forEach(({ index, key }) => {
      const v = parseAmount(cols[index]);
      if (v !== null) amounts[key] = v;
    });

    finalRows.push({
      label,
      section,
      row_type,
      parent_label,
      indent_level,
      sort_order: ri - 1,
      amounts,
      upload_type,
      source_file: filename,
      uploaded_date: today,
    });
  }

  return { monthCols, finalRows, upload_type };
}

function monthToQuarter(m) {
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtMonthKey(k) {
  const [y, m] = k.split("-");
  return `${MONTH_NAMES[parseInt(m)]} ${y}`;
}

export default function PLImportSection({ onImported }) {
  const [importStatus, setImportStatus] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [historyEntries, setHistoryEntries] = useState(() => loadHistory());
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const processFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith(".csv")) {
      setErrorMsg("Please upload a .csv file.");
      setImportStatus("error");
      return;
    }

    setImportStatus("parsing");
    setErrorMsg("");
    setImportResult(null);

    const text = await file.text();
    let parsed;
    try {
      parsed = parseQBCSV(text, file.name);
    } catch (err) {
      setImportStatus("error");
      setErrorMsg(`Parse error: ${err.message}`);
      return;
    }

    setImportStatus("saving");
    const { monthCols, finalRows, upload_type } = parsed;
    const today = new Date().toISOString().split("T")[0];

    try {
      const creates = [];
      const updates = [];

      const incomingMonthKeys = monthCols.map((c) => c.key);
      const monthKeysStr = incomingMonthKeys.join(",");
      const firstCol = monthCols[0];

      const allExisting = await base44.entities.PLEntry.list("sort_order", 5000);
      const incomingSet = new Set(incomingMonthKeys);
      const existingByLabel = {};
      allExisting.forEach((r) => {
        if (!r.month_keys) return;
        const rKeys = r.month_keys.split(",");
        if (rKeys.some((k) => incomingSet.has(k))) {
          existingByLabel[r.label] = r;
        }
      });

      finalRows.forEach((row) => {
        const monthly_amounts = {};
        monthCols.forEach(({ key }) => {
          const v = row.amounts[key];
          if (v !== null && v !== undefined) monthly_amounts[key] = v;
        });

        const payload = {
          label: row.label,
          section: row.section,
          parent_label: row.parent_label,
          row_type: row.row_type,
          indent_level: row.indent_level,
          sort_order: row.sort_order,
          source_file: row.source_file,
          upload_type: row.upload_type,
          uploaded_date: row.uploaded_date,
          year: firstCol.year,
          month: 0,
          month_key: firstCol.key,
          quarter: monthCols.length === 1 ? monthToQuarter(firstCol.month) : "",
          month_keys: monthKeysStr,
          monthly_amounts: JSON.stringify(monthly_amounts),
        };

        const existing = existingByLabel[row.label];
        if (existing) {
          const existingAmounts = JSON.parse(existing.monthly_amounts || "{}");
          const mergedAmounts = { ...existingAmounts, ...monthly_amounts };
          const existingKeys = (existing.month_keys || "").split(",").filter(Boolean);
          const mergedKeys = [...new Set([...existingKeys, ...incomingMonthKeys])].sort().join(",");
          updates.push({ id: existing.id, data: {
            ...payload,
            monthly_amounts: JSON.stringify(mergedAmounts),
            month_keys: mergedKeys,
          }});
        } else {
          creates.push(payload);
        }
      });

      const total = updates.length + creates.length;
      setSaveProgress({ done: 0, total });

      await processBatched(updates, 3, 800,
        ({ id, data }) => base44.entities.PLEntry.update(id, data));
      setSaveProgress({ done: updates.length, total });
      await processBatched(creates, 3, 800,
        (data) => base44.entities.PLEntry.create(data));
      setSaveProgress({ done: total, total });

      const newEntry = {
        source_file: file.name,
        uploaded_date: today,
        months: incomingMonthKeys,
        count: total,
      };
      const updatedHistory = [newEntry, ...historyEntries.filter(
        (h) => !(h.source_file === newEntry.source_file && h.uploaded_date === newEntry.uploaded_date)
      )].slice(0, 20);
      saveHistory(updatedHistory);
      setHistoryEntries(updatedHistory);

      setImportResult({ created: creates.length, updated: updates.length, months: incomingMonthKeys.length, filename: file.name });
      setImportStatus("done");
      queryClient.invalidateQueries({ queryKey: ["pl-entries"] });
      onImported?.();
    } catch (err) {
      setImportStatus("error");
      setErrorMsg(`Save error: ${err.message}`);
    }
  }, [onImported, queryClient, historyEntries]);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const isBusy = importStatus === "parsing" || importStatus === "saving";

  const handleClearAll = async () => {
    if (!window.confirm("Delete ALL PLEntry records? This cannot be undone.")) return;
    let deleted = 0;
    let batch;
    do {
      batch = await base44.entities.PLEntry.list("sort_order", 100);
      for (const r of batch) {
        try {
          await base44.entities.PLEntry.delete(r.id);
          deleted++;
        } catch { /* already deleted, skip */ }
        await new Promise(res => setTimeout(res, 150));
      }
    } while (batch.length === 100);
    alert(`Deleted ${deleted} records. Database is now clean.`);
    queryClient.invalidateQueries({ queryKey: ["pl-entries"] });
    setHistoryEntries([]);
    saveHistory([]);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isBusy && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/60 hover:bg-muted/30"
        } ${isBusy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
        {isBusy ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm text-muted-foreground">
              {importStatus === "parsing"
                ? "Parsing CSV…"
                : saveProgress.total > 0
                  ? `Saving… ${saveProgress.done} / ${saveProgress.total} records`
                  : "Saving to database…"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Drop a QuickBooks P&L CSV here, or click to browse</p>
            <p className="text-xs text-muted-foreground">Month columns like <code className="bg-muted px-1 rounded">26-Jan</code> · Total column ignored</p>
          </div>
        )}
      </div>

      {/* Clear all */}
      <div className="text-center">
        <button onClick={handleClearAll} className="text-xs text-red-500 underline mt-2">
          Clear all P&L data
        </button>
      </div>

      {/* Result banner */}
      {importStatus === "done" && importResult && (
        <div className="flex items-start gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Import complete — <strong>{importResult.created}</strong> records created,{" "}
            <strong>{importResult.updated}</strong> records updated across{" "}
            <strong>{importResult.months}</strong> month{importResult.months !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {importStatus === "error" && (
        <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {/* Upload history */}
      {historyEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Upload History</p>
          <div className="space-y-2">
            {historyEntries.map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-sm bg-muted/30 rounded-lg px-4 py-2.5 border border-border/50">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{h.source_file}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.months.map(fmtMonthKey).join(", ")} · {h.count} records
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {h.uploaded_date ? format(parseISO(h.uploaded_date), "MMM d, yyyy") : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}