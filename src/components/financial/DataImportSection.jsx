import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, ChevronDown, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

function ImportCard({ title, functionName, onSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const generatePreview = (data) => {
    const expenses = data.filter(r => !/check|transfer|payment|deposit|refund/.test((r['Transaction Type'] || '').toLowerCase()));
    const payments = data.filter(r => /check|transfer|payment|deposit|refund/.test((r['Transaction Type'] || '').toLowerCase()));
    return {
      expensesCount: expenses.length,
      paymentsCount: payments.length,
      totalRows: data.length,
      previewRows: data.slice(0, 15),
    };
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const parsed = parseCSV(text);
        setRows(parsed);
        setResult(null);
      };
      reader.readAsText(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const parsed = parseCSV(text);
        setRows(parsed);
        setResult(null);
      };
      reader.readAsText(file);
    }
  };

  const handleConfirmImport = async () => {
    if (rows.length === 0) {
      toast.error("No data to import");
      return;
    }

    setImporting(true);
    try {
      const res = await base44.functions.invoke(functionName, { rows });
      const count = res.data.totalImported || res.data.importedCount;
      const details = res.data.expensesImported !== undefined 
        ? ` (${res.data.expensesImported} expenses, ${res.data.paymentsImported} payments)`
        : '';
      setResult({ status: 'success', count, details });
      toast.success(`Imported ${count} records${details}`);
      onSuccess();
      setRows([]);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      setResult({ status: 'error', message: msg });
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    setRows([]);
    setResult(null);
  };

  const preview = generatePreview(rows);
  const showPreview = rows.length > 0 && !importing && !result;

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-sm">{title}</h3>
      
      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragActive ? 'border-primary bg-primary/5' : 'border-slate-300'
        }`}
      >
        <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-slate-600 mb-2">Drag CSV file here or</p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
          id={`csv-${functionName}`}
        />
        <label htmlFor={`csv-${functionName}`} className="inline-block">
          <span className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
            Browse Files
          </span>
        </label>
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="border rounded-lg p-3 space-y-3">
          <p className="text-sm font-medium">
            Found <span className="text-orange-600 font-semibold">{preview.expensesCount} expenses</span> and <span className="text-green-600 font-semibold">{preview.paymentsCount} payments</span> — <span className="font-semibold">{preview.totalRows} total rows</span> to import
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-2 py-1.5 border-b font-semibold">Date</th>
                  <th className="text-left px-2 py-1.5 border-b font-semibold">Type</th>
                  <th className="text-left px-2 py-1.5 border-b font-semibold">Vendor/Customer</th>
                  <th className="text-left px-2 py-1.5 border-b font-semibold">Account/Category</th>
                  <th className="text-right px-2 py-1.5 border-b font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, idx) => {
                  const isPayment = /check|transfer|payment|deposit|refund/.test((row['Transaction Type'] || '').toLowerCase());
                  const type = isPayment ? 'Payment' : 'Expense';
                  return (
                    <tr key={idx} className="border-b hover:bg-muted/30">
                      <td className="px-2 py-1.5">{row['Date']}</td>
                      <td className={`px-2 py-1.5 font-medium ${isPayment ? 'text-green-600' : 'text-orange-600'}`}>
                        {type}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row['Name']}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row['Account']}</td>
                      <td className="px-2 py-1.5 text-right font-medium">${Math.abs(parseFloat(row['Amount'] || 0)).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {preview.totalRows > 15 && (
            <p className="text-xs text-slate-500">Showing first 15 of {preview.totalRows} rows</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancel} disabled={importing} size="sm">
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} disabled={importing} size="sm" className="gap-2">
              {importing && <Loader2 className="w-3 h-3 animate-spin" />}
              {importing ? 'Importing...' : 'Confirm Import'}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
            result.status === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {result.status === 'success' ? (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Imported {result.count} records successfully{result.details}</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{result.message}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DataImportSection({ onImportComplete }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50"
      >
        <h2 className="font-semibold text-sm">Data Import</h2>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t px-4 py-4">
          <ImportCard
            title="QuickBooks Transaction List (2026)"
            functionName="importTransactionsFromCSV"
            onSuccess={() => onImportComplete()}
          />
        </div>
      )}
    </div>
  );
}