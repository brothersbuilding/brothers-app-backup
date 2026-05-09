import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── CSV Parser ─────────────────────────────────────────────────────────────────
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

// Parse QB header like "26-Jan" or "Jan 26" or "Jan 2026" → "2026-01"
function parseQBHeader(h) {
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  h = h.trim();

  // "26-Jan" format
  const m1 = h.match(/^(\d{2})-([A-Za-z]{3})$/);
  if (m1) {
    const yr = parseInt(m1[1]) + 2000;
    const mon = MONTHS[m1[2].toLowerCase()];
    if (mon) return `${yr}-${String(mon).padStart(2,"0")}`;
  }

  // "Jan 26" or "Jan 2026"
  const m2 = h.match(/^([A-Za-z]{3})\s+(\d{2,4})$/);
  if (m2) {
    const mon = MONTHS[m2[1].toLowerCase()];
    const yr = m2[2].length === 2 ? parseInt(m2[2]) + 2000 : parseInt(m2[2]);
    if (mon) return `${yr}-${String(mon).padStart(2,"0")}`;
  }

  return null;
}

const TOTAL_LABELS = new Set(["Gross Profit", "Net Operating Income", "Net Income", "Net Other Income"]);
const SECTION_HEADERS = new Set(["Income", "Cost of Goods Sold", "Expenses", "Other Income/Expense"]);

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

// Derive indent level: items under a group_header are indent 1,
// items that are under another item group are indent 2
function assignIndentLevels(rows) {
  let depth = 0;
  return rows.map((row) => {
    if (row.row_type === "group_header") {
      row.indent_level = 0;
      depth = 1;
    } else if (row.row_type === "total") {
      row.indent_level = 0;
      depth = 0;
    } else if (row.row_type === "subtotal") {
      row.indent_level = Math.max(0, depth - 1);
    } else {
      row.indent_level = depth;
    }
    return row;
  });
}

function parseQBCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const headers = parseCSVLine(lines[0]);
  // Find month columns
  const monthCols = []; // [{index, key}]
  let totalColIndex = -1;

  headers.forEach((h, i) => {
    if (i === 0) return;
    const key = parseQBHeader(h);
    if (key) {
      monthCols.push({ index: i, key });
    } else if (h.trim().toLowerCase() === "total") {
      totalColIndex = i;
    }
  });

  if (monthCols.length === 0) throw new Error("No month columns found. Expected headers like '26-Jan', 'Jan 26', etc.");

  // Build period metadata
  const sortedMonths = [...monthCols].sort((a, b) => a.key.localeCompare(b.key));
  const firstMonth = sortedMonths[0].key;
  const lastMonth = sortedMonths[sortedMonths.length - 1].key;
  const months = sortedMonths.map((m) => m.key).join(",");
  const year = parseInt(firstMonth.split("-")[0]);

  // Detect quarter
  const monthNums = sortedMonths.map((m) => parseInt(m.key.split("-")[1]));
  let quarter = null;
  if (monthNums.length === 3) {
    const q1 = [1,2,3], q2=[4,5,6], q3=[7,8,9], q4=[10,11,12];
    if (monthNums.every((m,i) => m === q1[i])) quarter = "Q1";
    else if (monthNums.every((m,i) => m === q2[i])) quarter = "Q2";
    else if (monthNums.every((m,i) => m === q3[i])) quarter = "Q3";
    else if (monthNums.every((m,i) => m === q4[i])) quarter = "Q4";
  }

  // Month name map
  const MON_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const periodLabel = quarter
    ? `${quarter} ${year}`
    : monthCols.length === 1
    ? `${MON_NAMES[parseInt(firstMonth.split("-")[1])]} ${year}`
    : `${MON_NAMES[parseInt(firstMonth.split("-")[1])]}–${MON_NAMES[parseInt(lastMonth.split("-")[1])]} ${year}`;

  // Parse rows
  const rawRows = [];
  let currentSection = "Income";
  let parentLabel = null;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const label = (cols[0] || "").trim();
    if (!label) continue;

    const section = detectSection(label, currentSection);
    currentSection = section;

    const rowType = detectRowType(label);

    // Track parent for indent
    if (rowType === "group_header") parentLabel = label;
    else if (rowType === "subtotal") parentLabel = null;

    const monthly_values = {};
    monthCols.forEach(({ index, key }) => {
      const v = parseNum(cols[index]);
      if (v !== null) monthly_values[key] = v;
    });

    const total_value = totalColIndex >= 0 ? parseNum(cols[totalColIndex]) : null;

    rawRows.push({
      label,
      section,
      parent_label: rowType === "item" ? parentLabel : null,
      row_type: rowType,
      indent_level: 0, // assigned later
      monthly_values: JSON.stringify(monthly_values),
      total_value: total_value ?? 0,
    });
  }

  const rows = assignIndentLevels(rawRows);

  return {
    statement: { period_label: periodLabel, period_start: firstMonth, period_end: lastMonth, year, quarter, months },
    rows,
  };
}

export default function PLImportSection({ onImported }) {
  const [status, setStatus] = useState(null); // null | "parsing" | "saving" | "success" | "error"
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setStatus("parsing");
    setMessage("");

    const text = await file.text();
    let parsed;
    try {
      parsed = parseQBCSV(text);
    } catch (err) {
      setStatus("error");
      setMessage(`Parse error: ${err.message}`);
      return;
    }

    setStatus("saving");
    try {
      const { statement, rows } = parsed;

      // Check for existing statement with same period
      const existing = await base44.entities.PLStatement.filter({
        period_start: statement.period_start,
        period_end: statement.period_end,
      });

      let statementId;
      if (existing.length > 0) {
        // Update existing statement
        const existingStmt = existing[0];
        statementId = existingStmt.id;
        await base44.entities.PLStatement.update(statementId, {
          ...statement,
          filename: file.name,
          uploaded_date: new Date().toISOString().split("T")[0],
        });

        // Get existing rows
        const existingRows = await base44.entities.PLRow.filter({ statement_id: statementId });
        const existingRowMap = {};
        existingRows.forEach((r) => { existingRowMap[r.label] = r; });

        // Update or create rows
        const updates = [];
        const creates = [];
        rows.forEach((row) => {
          const data = { ...row, statement_id: statementId };
          if (existingRowMap[row.label]) {
            updates.push(base44.entities.PLRow.update(existingRowMap[row.label].id, data));
          } else {
            creates.push(data);
          }
        });
        await Promise.all(updates);
        if (creates.length > 0) await base44.entities.PLRow.bulkCreate(creates);

        setMessage(`Updated statement "${statement.period_label}" — ${rows.length} rows processed (${creates.length} new).`);
      } else {
        // Create new statement
        const created = await base44.entities.PLStatement.create({
          ...statement,
          filename: file.name,
          uploaded_date: new Date().toISOString().split("T")[0],
        });
        statementId = created.id;

        const rowData = rows.map((r) => ({ ...r, statement_id: statementId }));
        await base44.entities.PLRow.bulkCreate(rowData);

        setMessage(`Imported "${statement.period_label}" — ${rows.length} rows created.`);
      }

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
        Upload a QuickBooks Profit & Loss CSV export. Columns should be month headers like <code className="bg-muted px-1 rounded text-xs">26-Jan</code> with a <code className="bg-muted px-1 rounded text-xs">Total</code> column at the end.
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