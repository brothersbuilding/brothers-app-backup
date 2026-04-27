import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";

// Convert "Last, First [Suffix]" → "First [Suffix] Last" (split on first comma only)
const parseEmployeeName = (raw) => {
  if (!raw) return "";
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx === -1) return trimmed;
  const last = trimmed.slice(0, commaIdx).trim();
  const first = trimmed.slice(commaIdx + 1).trim();
  return `${first} ${last}`.trim();
};

// Strip \xa0, whitespace, $, and , then parse as float. Returns null if blank.
const cleanCurrency = (raw) => {
  if (!raw) return null;
  const cleaned = raw.replace(/[\xa0\s$,]/g, "");
  if (cleaned === "") return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

// RFC-4180-compliant CSV parser — handles newlines inside quoted fields correctly.
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
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { fields.push(field); field = ""; }
      else if (ch === "\n") { fields.push(field); field = ""; rows.push(fields); fields = []; }
      else { field += ch; }
    }
  }
  if (field !== "" || fields.length > 0) { fields.push(field); rows.push(fields); }
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.replace(/\xa0/g, " ").trim().toLowerCase());
  return rows.slice(1).map((values) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || "").replace(/\xa0/g, " ").trim(); });
    return obj;
  });
};

const VALID_PERMISSION_LEVELS = ["admin", "manager", "labor"];

const mapRowToEmployee = (row) => {
  const hourlyPay = cleanCurrency(row["hourly pay"]);
  const salaryPay = cleanCurrency(row["salary pay"]);

  const hourly_rates = [];
  if (hourlyPay !== null && hourlyPay > 0) {
    hourly_rates.push({ pay_type_label: "Regular", hourly_amount: hourlyPay });
    hourly_rates.push({ pay_type_label: "Overtime", hourly_amount: parseFloat((hourlyPay * 1.5).toFixed(2)) });
  }

  const salary_rates = [];
  if (salaryPay !== null && salaryPay > 0) {
    salary_rates.push({ label: "Base Salary", annual_amount: salaryPay });
  }

  const rawPermission = (row["permission level"] || "").trim().toLowerCase();
  const permission_level = VALID_PERMISSION_LEVELS.includes(rawPermission) ? rawPermission : "labor";

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
    permission_level,
  };
};

// Build an update payload: only include fields where CSV has a value.
// CSV is source of truth — if CSV has a value, it wins.
// If CSV field is blank/empty, leave existing value alone.
const buildUpsertPayload = (csvEmp, existing) => {
  const payload = {};
  const changedFields = [];

  const scalarFields = [
    "address_line1", "address_line2", "city", "state", "zip_code",
    "phone", "hire_date", "dob", "permission_level",
  ];

  for (const field of scalarFields) {
    const csvVal = csvEmp[field];
    const existingVal = existing[field];
    if (csvVal) {
      payload[field] = csvVal;
      if (csvVal !== existingVal) changedFields.push(field);
    }
  }

  // hourly_rates: apply if CSV has them
  if (csvEmp.hourly_rates?.length > 0) {
    payload.hourly_rates = csvEmp.hourly_rates;
    const existingRegular = existing.hourly_rates?.[0]?.hourly_amount;
    const csvRegular = csvEmp.hourly_rates[0]?.hourly_amount;
    if (csvRegular !== existingRegular) changedFields.push("hourly_rates");
  }

  // salary_rates: apply if CSV has them
  if (csvEmp.salary_rates?.length > 0) {
    payload.salary_rates = csvEmp.salary_rates;
    const existingSalary = existing.salary_rates?.[0]?.annual_amount;
    const csvSalary = csvEmp.salary_rates[0]?.annual_amount;
    if (csvSalary !== existingSalary) changedFields.push("salary_rates");
  }

  return { payload, changedFields };
};

export default function EmployeeCSVImport({ onImported }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState([]); // [{ emp, existingId, changedFields, isNew }]
  const [status, setStatus] = useState(null); // null | "loading" | "preview" | "importing" | "done"
  const [result, setResult] = useState({ created: 0, updated: 0, failed: 0 });
  const fileRef = useRef();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("loading");

    const text = await file.text();
    const rows = parseCSV(text);
    const mapped = rows.map(mapRowToEmployee).filter((emp) => emp.full_name);

    // Load all existing employees once for matching
    const existing = await base44.entities.Employee.list("-updated_date", 500);
    const existingByName = {};
    for (const emp of existing) {
      if (emp.full_name) existingByName[emp.full_name.trim().toLowerCase()] = emp;
    }

    const previewRows = mapped.map((csvEmp) => {
      const key = csvEmp.full_name.trim().toLowerCase();
      const existingEmp = existingByName[key];
      if (existingEmp) {
        const { payload, changedFields } = buildUpsertPayload(csvEmp, existingEmp);
        return { emp: csvEmp, existingId: existingEmp.id, payload, changedFields, isNew: false };
      } else {
        return { emp: csvEmp, existingId: null, payload: csvEmp, changedFields: [], isNew: true };
      }
    });

    setPreview(previewRows);
    setStatus("preview");
  };

  const handleImport = async () => {
    setStatus("importing");
    let created = 0, updated = 0, failed = 0;

    for (const row of preview) {
      try {
        if (row.isNew) {
          await base44.entities.Employee.create(row.payload);
          created++;
        } else {
          await base44.entities.Employee.update(row.existingId, row.payload);
          updated++;
        }
      } catch {
        failed++;
      }
    }

    setResult({ created, updated, failed });
    setStatus("done");
    if (created > 0 || updated > 0) onImported?.();
  };

  const handleClose = () => {
    setOpen(false);
    setPreview([]);
    setStatus(null);
    setResult({ created: 0, updated: 0, failed: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const newCount = preview.filter((r) => r.isNew).length;
  const updateCount = preview.filter((r) => !r.isNew).length;

  const FIELD_LABELS = {
    address_line1: "Address 1", address_line2: "Address 2", city: "City",
    state: "State", zip_code: "ZIP", phone: "Phone", hire_date: "Hire Date",
    dob: "DOB", permission_level: "Permission", hourly_rates: "Hourly Pay",
    salary_rates: "Salary",
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4" /> Import Employees
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Employees from CSV</DialogTitle>
          </DialogHeader>

          {/* Upload */}
          {status === null && (
            <div className="border-2 border-dashed border-border rounded-lg p-10 text-center">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload a CSV with headers:{" "}
                <span className="font-mono text-xs">employee name, address line 1, address line 2, city, state, zip code, phone, salary pay, hourly pay, hire date, birth date, permission level</span>
              </p>
              <label>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <Button type="button" asChild><span>Choose CSV File</span></Button>
              </label>
            </div>
          )}

          {/* Loading */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Parsing file and matching employees…</p>
            </div>
          )}

          {/* Preview */}
          {status === "preview" && (
            <div className="flex flex-col gap-3 flex-1 overflow-hidden">
              {preview.length === 0 ? (
                <p className="text-sm text-destructive">No valid rows found in the CSV. Check the column headers and try again.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {preview.length} employee{preview.length !== 1 ? "s" : ""} found —{" "}
                    <span className="text-green-600 font-medium">{newCount} new</span>
                    {updateCount > 0 && <>, <span className="text-blue-600 font-medium">{updateCount} update{updateCount !== 1 ? "s" : ""}</span></>}
                  </p>
                  <div className="overflow-auto border rounded-lg flex-1">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 text-xs">
                          <TableHead>Status</TableHead>
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
                          <TableHead>Permission</TableHead>
                          <TableHead>Changes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell>
                              {row.isNew ? (
                                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">New</Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Update</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{row.emp.full_name}</TableCell>
                            <TableCell>{row.emp.phone || "—"}</TableCell>
                            <TableCell>{[row.emp.address_line1, row.emp.address_line2].filter(Boolean).join(", ") || "—"}</TableCell>
                            <TableCell>{row.emp.city || "—"}</TableCell>
                            <TableCell>{row.emp.state || "—"}</TableCell>
                            <TableCell>{row.emp.zip_code || "—"}</TableCell>
                            <TableCell>{row.emp.hire_date || "—"}</TableCell>
                            <TableCell>{row.emp.dob || "—"}</TableCell>
                            <TableCell>{row.emp.hourly_rates?.[0]?.hourly_amount ? `$${row.emp.hourly_rates[0].hourly_amount}/hr` : "—"}</TableCell>
                            <TableCell>{row.emp.salary_rates?.[0]?.annual_amount ? `$${row.emp.salary_rates[0].annual_amount}/yr` : "—"}</TableCell>
                            <TableCell>{row.emp.permission_level}</TableCell>
                            <TableCell>
                              {row.isNew ? (
                                <span className="text-muted-foreground">—</span>
                              ) : row.changedFields.length === 0 ? (
                                <span className="text-muted-foreground italic">No changes</span>
                              ) : (
                                <span className="text-blue-700">
                                  {row.changedFields.map((f) => FIELD_LABELS[f] || f).join(", ")}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex gap-3 justify-end pt-1">
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleImport}>
                      Import {preview.length} Employee{preview.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Importing */}
          {status === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Importing employees…</p>
            </div>
          )}

          {/* Done */}
          {status === "done" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {result.failed === 0 ? (
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              ) : (
                <AlertCircle className="w-10 h-10 text-yellow-500" />
              )}
              <div className="text-center space-y-1">
                {result.created > 0 && (
                  <p className="font-semibold text-lg">{result.created} employee{result.created !== 1 ? "s" : ""} created</p>
                )}
                {result.updated > 0 && (
                  <p className="font-semibold text-lg">{result.updated} employee{result.updated !== 1 ? "s" : ""} updated</p>
                )}
                {result.failed > 0 && (
                  <p className="text-sm text-destructive">{result.failed} row{result.failed !== 1 ? "s" : ""} failed</p>
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