import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";

// Convert "Last, First" → "First Last"
const parseEmployeeName = (raw) => {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",").map((s) => s.trim());
    return `${first} ${last}`.trim();
  }
  return trimmed;
};

// Parse a basic CSV string into array of objects keyed by header
const parseCSV = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    // Handle quoted fields
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
};

const mapRowToEmployee = (row) => {
  const hourlyPay = parseFloat(row["hourly pay"]) || 0;
  const salaryPay = parseFloat(row["salary pay"]) || 0;

  const hourly_rates = [];
  if (hourlyPay > 0) {
    hourly_rates.push({ pay_type_label: "Regular", hourly_amount: hourlyPay });
    hourly_rates.push({ pay_type_label: "Overtime", hourly_amount: parseFloat((hourlyPay * 1.5).toFixed(2)) });
  }

  const salary_rates = [];
  if (salaryPay > 0) {
    salary_rates.push({ label: "Base Salary", annual_amount: salaryPay });
  }

  return {
    full_name: parseEmployeeName(row["employee name"]),
    address_line1: row["address line 1"] || "",
    address_line2: row["address line 2"] || "",
    city: row["city"] || "",
    state: row["state"] || "",
    zip_code: row["zip code"] || "",
    phone: row["phone"] || "",
    hire_date: row["hire date"] || "",
    dob: row["birth date"] || "",
    hourly_rates,
    salary_rates,
    permission_level: "labor",
  };
};

export default function EmployeeCSVImport({ onImported }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState([]);
  const [status, setStatus] = useState(null); // null | "preview" | "importing" | "done"
  const [result, setResult] = useState({ succeeded: 0, failed: 0 });
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      const mapped = rows.map(mapRowToEmployee).filter((emp) => emp.full_name);
      setPreview(mapped);
      setStatus("preview");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setStatus("importing");
    let succeeded = 0;
    let failed = 0;
    for (const emp of preview) {
      try {
        await base44.entities.Employee.create(emp);
        succeeded++;
      } catch {
        failed++;
      }
    }
    setResult({ succeeded, failed });
    setStatus("done");
    if (succeeded > 0) onImported?.();
  };

  const handleClose = () => {
    setOpen(false);
    setPreview([]);
    setStatus(null);
    setResult({ succeeded: 0, failed: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4" /> Import Employees
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Employees from CSV</DialogTitle>
          </DialogHeader>

          {/* Step 1: Upload */}
          {(status === null || status === "preview") && (
            <div className="space-y-4 flex-1 overflow-auto">
              {status === null && (
                <div className="border-2 border-dashed border-border rounded-lg p-10 text-center">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a CSV with headers: <span className="font-mono text-xs">employee name, address line 1, address line 2, city, state, zip code, phone, salary pay, hourly pay, hire date, birth date</span>
                  </p>
                  <label>
                    <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                    <Button type="button" asChild><span>Choose CSV File</span></Button>
                  </label>
                </div>
              )}

              {status === "preview" && preview.length > 0 && (
                <>
                  <p className="text-sm text-muted-foreground">{preview.length} employee{preview.length !== 1 ? "s" : ""} ready to import.</p>
                  <div className="overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 text-xs">
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>ZIP</TableHead>
                          <TableHead>Hire Date</TableHead>
                          <TableHead>DOB</TableHead>
                          <TableHead>Hourly Pay</TableHead>
                          <TableHead>Salary</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((emp, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell className="font-medium">{emp.full_name}</TableCell>
                            <TableCell>{emp.phone || "—"}</TableCell>
                            <TableCell>{[emp.address_line1, emp.address_line2].filter(Boolean).join(", ") || "—"}</TableCell>
                            <TableCell>{emp.city || "—"}</TableCell>
                            <TableCell>{emp.state || "—"}</TableCell>
                            <TableCell>{emp.zip_code || "—"}</TableCell>
                            <TableCell>{emp.hire_date || "—"}</TableCell>
                            <TableCell>{emp.dob || "—"}</TableCell>
                            <TableCell>{emp.hourly_rates?.[0]?.hourly_amount ? `$${emp.hourly_rates[0].hourly_amount}/hr` : "—"}</TableCell>
                            <TableCell>{emp.salary_rates?.[0]?.annual_amount ? `$${emp.salary_rates[0].annual_amount}/yr` : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleImport}>Import {preview.length} Employee{preview.length !== 1 ? "s" : ""}</Button>
                  </div>
                </>
              )}

              {status === "preview" && preview.length === 0 && (
                <p className="text-sm text-destructive">No valid rows found in the CSV. Check the column headers and try again.</p>
              )}
            </div>
          )}

          {/* Step 2: Importing */}
          {status === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Importing employees…</p>
            </div>
          )}

          {/* Step 3: Done */}
          {status === "done" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {result.failed === 0 ? (
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              ) : (
                <AlertCircle className="w-10 h-10 text-yellow-500" />
              )}
              <div className="text-center">
                <p className="font-semibold text-lg">{result.succeeded} employee{result.succeeded !== 1 ? "s" : ""} imported successfully</p>
                {result.failed > 0 && (
                  <p className="text-sm text-destructive mt-1">{result.failed} row{result.failed !== 1 ? "s" : ""} failed to import</p>
                )}
              </div>
              <Button onClick={handleClose}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}