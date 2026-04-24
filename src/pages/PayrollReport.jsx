import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isWithinInterval } from "date-fns";

// Pay periods: 11th–26th and 27th–10th
function getPayPeriods(entries) {
  const periods = new Set();
  entries.forEach((e) => {
    if (!e.date) return;
    const d = parseISO(e.date);
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();
    let label, start, end;
    if (day >= 11 && day <= 26) {
      start = new Date(year, month, 11);
      end = new Date(year, month, 26);
      label = `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    } else if (day >= 27) {
      start = new Date(year, month, 27);
      end = new Date(year, month + 1, 10);
      label = `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    } else {
      start = new Date(year, month - 1, 27);
      end = new Date(year, month, 10);
      label = `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    }
    periods.add(JSON.stringify({ label, start: start.toISOString(), end: end.toISOString() }));
  });
  return Array.from(periods)
    .map((s) => JSON.parse(s))
    .sort((a, b) => new Date(b.start) - new Date(a.start));
}

function entryMatchesPeriod(entry, period) {
  if (!period) return true;
  const d = parseISO(entry.date);
  return isWithinInterval(d, { start: new Date(period.start), end: new Date(period.end) });
}

export default function PayrollReport() {
  const [filterType, setFilterType] = useState("pay_period"); // pay_period | custom
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterCostCode, setFilterCostCode] = useState("all");
  const [filterSaifCode, setFilterSaifCode] = useState("all");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["timeEntries-all"],
    queryFn: () => base44.entities.TimeEntry.list("-date", 500),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  // Build lookup maps from settings
  const saifCodesMap = useMemo(() => {
    const record = appSettings.find((s) => s.key === "saif_codes");
    if (!record) return {};
    const codes = JSON.parse(record.value);
    return Object.fromEntries(codes.map((c) => [c.name, parseFloat(c.rate) || 0]));
  }, [appSettings]);

  const saifMappingMap = useMemo(() => {
    const record = appSettings.find((s) => s.key === "saif_mapping");
    if (!record) return {};
    return JSON.parse(record.value);
  }, [appSettings]);

  // Build user hourly wage lookup by email
  const userWageMap = useMemo(() => {
    return Object.fromEntries(users.map((u) => [u.email, parseFloat(u.hourly_wage) || 0]));
  }, [users]);

  // Calculate SAIF cost for a single entry
  const getSaifCost = (entry) => {
    const wage = userWageMap[entry.employee_email] || 0;
    const saifCode = entry.saif_code || saifMappingMap[entry.cost_code] || "";
    const pct = saifCodesMap[saifCode] || 0;
    return wage * (entry.hours || 0) * (pct / 100);
  };

  const payPeriods = useMemo(() => getPayPeriods(entries), [entries]);

  const employees = useMemo(() => [...new Set(entries.map((e) => e.employee_name).filter(Boolean))].sort(), [entries]);
  const costCodes = useMemo(() => [...new Set(entries.map((e) => e.cost_code).filter(Boolean))].sort(), [entries]);
  const saifCodes = useMemo(() => [...new Set(entries.map((e) => e.saif_code).filter(Boolean))].sort(), [entries]);

  const selectedPeriodObj = useMemo(
    () => payPeriods.find((p) => p.label === selectedPeriod) || null,
    [payPeriods, selectedPeriod]
  );

  const filtered = useMemo(() => {
    let result = [...entries];

    // Date filter
    if (filterType === "pay_period" && selectedPeriod !== "all" && selectedPeriodObj) {
      result = result.filter((e) => entryMatchesPeriod(e, selectedPeriodObj));
    } else if (filterType === "custom" && customStart && customEnd) {
      const start = parseISO(customStart);
      const end = parseISO(customEnd);
      result = result.filter((e) => {
        const d = parseISO(e.date);
        return isWithinInterval(d, { start, end });
      });
    }

    if (filterEmployee !== "all") result = result.filter((e) => e.employee_name === filterEmployee);
    if (filterProject !== "all") result = result.filter((e) => e.project_id === filterProject);
    if (filterCostCode !== "all") result = result.filter((e) => e.cost_code === filterCostCode);
    if (filterSaifCode !== "all") result = result.filter((e) => e.saif_code === filterSaifCode);

    // Sort
    result.sort((a, b) => {
      let va = a[sortField] ?? "";
      let vb = b[sortField] ?? "";
      if (sortField === "hours") { va = Number(va); vb = Number(vb); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [entries, filterType, selectedPeriod, selectedPeriodObj, customStart, customEnd, filterEmployee, filterProject, filterCostCode, filterSaifCode, sortField, sortDir]);

  const totalHours = filtered.reduce((s, e) => s + (e.hours || 0), 0);
  const overtimeHours = Math.max(0, totalHours - 40);
  const straightHours = Math.min(totalHours, 40);
  const totalSaifCost = filtered.reduce((s, e) => s + getSaifCost(e), 0);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIndicator = ({ field }) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const handleExportCSV = () => {
    const headers = ["Date", "Employee", "Email", "Project", "Cost Code", "SAIF Code", "Hours", "SAIF Cost", "Description"];
    const rows = filtered.map((e) => [
      e.date, e.employee_name || "", e.employee_email || "", e.project_name || "",
      e.cost_code || "", e.saif_code || "", e.hours || 0,
      getSaifCost(e).toFixed(2),
      `"${(e.description || "").replace(/"/g, '""')}"`
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payroll-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/reports" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Payroll Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">All employee time card data</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date filter type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Date Filter</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pay_period">Pay Period</SelectItem>
                <SelectItem value="custom">Custom Dates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterType === "pay_period" ? (
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-xs">Pay Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger><SelectValue placeholder="All periods" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Periods</SelectItem>
                  {payPeriods.map((p) => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}

          {/* Employee */}
          <div className="space-y-1.5">
            <Label className="text-xs">Employee</Label>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <Label className="text-xs">Project</Label>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Code */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cost Code</Label>
            <Select value={filterCostCode} onValueChange={setFilterCostCode}>
              <SelectTrigger><SelectValue placeholder="All cost codes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cost Codes</SelectItem>
                {costCodes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* SAIF Code */}
          <div className="space-y-1.5">
            <Label className="text-xs">SAIF Code</Label>
            <Select value={filterSaifCode} onValueChange={setFilterSaifCode}>
              <SelectTrigger><SelectValue placeholder="All SAIF codes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SAIF Codes</SelectItem>
                {saifCodes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Hours</p>
          <p className="text-2xl font-bold font-barlow mt-1">{totalHours.toFixed(1)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Straight Time</p>
          <p className="text-2xl font-bold font-barlow mt-1">{straightHours.toFixed(1)}</p>
        </Card>
        <Card className="p-4 text-center bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-700 uppercase tracking-wide font-semibold">Overtime</p>
          <p className="text-2xl font-bold font-barlow text-amber-700 mt-1">{overtimeHours.toFixed(1)}</p>
        </Card>
        <Card className="p-4 text-center bg-blue-50 border-blue-100">
          <p className="text-xs text-blue-700 uppercase tracking-wide font-semibold">SAIF Cost</p>
          <p className="text-2xl font-bold font-barlow text-blue-700 mt-1">${totalSaifCost.toFixed(2)}</p>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{filtered.length} entries</p>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No entries match the selected filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("date")}>Date<SortIndicator field="date" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("employee_name")}>Employee<SortIndicator field="employee_name" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("project_name")}>Project<SortIndicator field="project_name" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("cost_code")}>Cost Code<SortIndicator field="cost_code" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("saif_code")}>SAIF Code<SortIndicator field="saif_code" /></TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("hours")}>Hours<SortIndicator field="hours" /></TableHead>
                  <TableHead className="text-right">SAIF Cost</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm whitespace-nowrap">{format(parseISO(entry.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm font-medium">{entry.employee_name || "—"}</TableCell>
                    <TableCell className="text-sm">{entry.project_name || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {entry.cost_code ? <Badge variant="outline" className="text-xs">{entry.cost_code}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.saif_code ? <Badge variant="outline" className="text-xs">{entry.saif_code}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-right">{entry.hours}h</TableCell>
                    <TableCell className="text-sm font-semibold text-right text-blue-700">
                      {getSaifCost(entry) > 0 ? `$${getSaifCost(entry).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{entry.description || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}