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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

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

  const handleImport = async () => {
    if (rows.length === 0) {
      toast.error("No data to import");
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke(functionName, { rows });
      setResult({ status: 'success', count: res.data.importedCount });
      toast.success(`Imported ${res.data.importedCount} records`);
      onSuccess();
      setRows([]);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      setResult({ status: 'error', message: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const preview = rows.slice(0, 10);

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
        <label htmlFor={`csv-${functionName}`}>
          <Button as="span" variant="outline" size="sm" className="cursor-pointer">
            Browse Files
          </Button>
        </label>
      </div>

      {/* Preview Table */}
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">{rows.length} rows found</p>
          {preview.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="text-xs w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {Object.keys(preview[0]).map(key => (
                      <th key={key} className="px-2 py-1.5 text-left font-medium text-slate-700 whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-2 py-1.5 text-slate-600 whitespace-nowrap truncate max-w-xs">
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 10 && (
            <p className="text-xs text-slate-500">Showing first 10 of {rows.length} rows</p>
          )}
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
              <p>Imported {result.count} records successfully</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{result.message}</p>
            </>
          )}
        </div>
      )}

      {/* Action */}
      {rows.length > 0 && !result && (
        <Button onClick={handleImport} disabled={loading} className="w-full gap-2 text-xs h-8">
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? 'Importing…' : 'Confirm Import'}
        </Button>
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
        <div className="border-t px-4 py-4 space-y-4">
          <ImportCard
            title="Bills / Expenses (QB Transaction List)"
            functionName="importBillsFromCSV"
            onSuccess={() => onImportComplete()}
          />
          <ImportCard
            title="Payments (QB Transaction List)"
            functionName="importPaymentsFromCSV"
            onSuccess={() => onImportComplete()}
          />
        </div>
      )}
    </div>
  );
}