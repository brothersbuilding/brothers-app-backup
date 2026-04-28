import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const cleanNumber = (raw) => {
  if (!raw) return null;
  const cleaned = raw.replace(/[\xa0\s$,]/g, "");
  if (cleaned === "") return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const parseName = (name) => {
  if (!name) return { customer: "", project: "" };
  const colonIdx = name.indexOf(":");
  if (colonIdx === -1) return { customer: name.trim(), project: "" };
  return { customer: name.slice(0, colonIdx).trim(), project: name.slice(colonIdx + 1).trim() };
};

const parseCSV = (text) => {
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let fields = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { fields.push(field); field = ""; }
      else if (ch === "\n") { fields.push(field); field = ""; rows.push(fields); fields = []; }
      else { field += ch; }
    }
  }
  if (field !== "" || fields.length > 0) { fields.push(field); rows.push(fields); }
  return rows;
};

const parseRows = (csvText) => {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  const results = [];
  for (let i = 1; i < allRows.length; i++) {
    const cols = allRows[i].map((c) => c.replace(/\xa0/g, " ").trim());
    if (cols.every((c) => c === "")) continue;

    const [date, num, name, dueDate, amount, openBalance] = cols;

    if (!num) continue;
    if (isNaN(Number(num))) continue;
    if ((cols[0] || "").toUpperCase().startsWith("TOTAL")) continue;

    const openBal = cleanNumber(openBalance);
    const status = openBal === 0 || (openBalance || "").trim() === "0" ? "paid" : "unpaid";
    const { customer, project } = parseName(name);

    results.push({
      invoice_number: num,
      customer,
      project,
      amount: cleanNumber(amount) ?? 0,
      due_date: dueDate,
      status,
    });
  }
  return results;
};

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

export default function CSVImportPanel({ onClose, onImported }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null); // { rows, rawText }
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null); // { done: number, total: number }
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith(".csv")) {
      setImportResult({ status: "error", message: "Please upload a .csv file.", timestamp: new Date() });
      return;
    }
    const text = await file.text();
    const rows = parseRows(text);
    setPreview({ rows, rawText: text });
    setImportResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleBackfill = async () => {
    if (!preview) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await base44.functions.invoke("backfillFromCSV", { csv: preview.rawText });
      const data = result?.data ?? result;
      const updated = data?.updated ?? 0;
      setImportResult({ status: "success", message: `Fixed ${updated} invoice${updated !== 1 ? "s" : ""} with missing names.`, timestamp: new Date() });
      onImported?.();
    } catch (error) {
      setImportResult({ status: "error", message: error?.message ?? "Backfill failed.", timestamp: new Date() });
    } finally {
      setImporting(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress(null);

    let offset = 0;
    const limit = 25;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    try {
      while (true) {
        const result = await base44.functions.invoke("importInvoicesFromCSV", {
          csv: preview.rawText,
          offset,
          limit,
        });
        const data = result?.data ?? result;
        totalCreated += data.created ?? 0;
        totalUpdated += data.updated ?? 0;
        totalSkipped += data.skipped ?? 0;

        const done = data.nextOffset == null || data.done;
        const processedSoFar = done ? (data.total ?? offset + (data.processed ?? limit)) : data.nextOffset;
        setImportProgress({ done: processedSoFar, total: data.total ?? processedSoFar });

        if (done) break;

        offset = data.nextOffset;
        await new Promise((res) => setTimeout(res, 2000));
      }

      setImportResult({
        status: "success",
        message: `Import complete: ${totalCreated} new, ${totalUpdated} updated, ${totalSkipped} skipped`,
        timestamp: new Date(),
      });
      onImported?.();
      setPreview(null);
    } catch (error) {
      setImportResult({ status: "error", message: error?.message ?? "Import failed.", timestamp: new Date() });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const paidCount = preview ? preview.rows.filter((r) => r.status === "paid").length : 0;
  const unpaidCount = preview ? preview.rows.filter((r) => r.status === "unpaid").length : 0;

  return (
    <div className="mb-6 border rounded-lg p-5 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm text-foreground">Bulk Import from QuickBooks CSV</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            In QuickBooks: Reports → Invoice List → Export to Excel/CSV → upload here
          </p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drop zone — only show if no preview yet */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}`}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Drop your CSV here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">QuickBooks Invoice List export (.csv)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-foreground">{preview.rows.length} invoices found</span>
            <Badge className="bg-green-100 text-green-800 border-green-200">{paidCount} paid</Badge>
            <Badge className="bg-red-100 text-red-800 border-red-200">{unpaidCount} unpaid</Badge>
            <button
              className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => { setPreview(null); setImportResult(null); }}
            >
              Choose different file
            </button>
          </div>

          <div className="border rounded-lg overflow-auto max-h-72">
            <Table>
            <TableHeader>
            <TableRow className="bg-muted/50 text-xs">
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {preview.rows.slice(0, 10).map((row, i) => (
              <TableRow key={i} className="text-xs">
                <TableCell className="font-mono">{row.invoice_number}</TableCell>
                <TableCell>{row.customer || "—"}</TableCell>
                <TableCell>{row.project || "—"}</TableCell>
                <TableCell className="text-right font-medium">{fmt(row.amount)}</TableCell>
                <TableCell>{row.due_date || "—"}</TableCell>
                    <TableCell>
                      {row.status === "paid" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Unpaid</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.rows.length > 10 && (
              <p className="text-xs text-muted-foreground text-center py-2 border-t">
                …and {preview.rows.length - 10} more rows
              </p>
            )}
          </div>

          {importProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Importing…</span>
                <span>{importProgress.done} of {importProgress.total}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => { setPreview(null); setImportResult(null); }} disabled={importing}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleBackfill} disabled={importing} className="text-amber-700 border-amber-300 hover:bg-amber-50">
              {importing ? "Fixing…" : "Fix Missing Names"}
            </Button>
            <Button onClick={handleConfirm} disabled={importing}>
              {importing ? `Importing… ${importProgress ? `(${importProgress.done}/${importProgress.total})` : ""}` : `Confirm Import (${preview.rows.length})`}
            </Button>
          </div>
        </div>
      )}

      {importResult && (
        <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border mt-3 ${importResult.status === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {importResult.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          {importResult.message}
          <span className="opacity-60 ml-1">{format(importResult.timestamp, "h:mm a")}</span>
        </div>
      )}
    </div>
  );
}