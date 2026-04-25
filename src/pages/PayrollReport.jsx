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
import { Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  // Calculate BB cost:
  // Base labor = (regHours × wage) + (otHours × wage × 1.5)
  // SAIF = totalHours × wage × saifRate% (no OT premium)
  // 3% tax = on base labor only (not SAIF)
  // BB Cost = baseLaborWithTax + saifAmount
  const getSaifCost = (entry, regHours, otHours) => {
    const wage = userWageMap[entry.employee_email] || 0;
    const totalHours = entry.hours || 0;
    // If reg/ot hours not passed in, treat all as regular
    const reg = regHours !== undefined ? regHours : totalHours;
    const ot = otHours !== undefined ? otHours : 0;
    const saifCode = entry.saif_code || saifMappingMap[entry.cost_code] || "";
    const saifPercentage = saifCodesMap[saifCode] || 0;
    const regCost = reg * wage;
    const otCost = ot * wage * 1.5;
    const baseLaborCost = regCost + otCost;
    const taxAmount = baseLaborCost * 0.03;
    const saifAmount = totalHours * wage * (saifPercentage / 100);
    return baseLaborCost + taxAmount + saifAmount;
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
  const groupedByWeek = useMemo(() => {
    const groups = {};
    filtered.forEach((e) => {
      const d = parseISO(e.date);
      const weekStart = new Date(d);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toISOString();
      if (!groups[weekKey]) groups[weekKey] = [];
      groups[weekKey].push(e);
    });
    return groups;
  }, [filtered]);

  const getRegOTHours = (entry, allEntriesForWeek) => {
    const entryIndex = allEntriesForWeek.findIndex((e) => e.id === entry.id);
    let cumulative = 0;
    for (let i = 0; i <= entryIndex; i++) {
      cumulative += allEntriesForWeek[i].hours || 0;
    }
    const prevCumulative = cumulative - (entry.hours || 0);
    const regHours = Math.max(0, Math.min(40, cumulative) - prevCumulative);
    const otHours = Math.max(0, (entry.hours || 0) - regHours);
    return { regHours, otHours };
  };

   const totalRegHours = filtered.reduce((s, e) => {
     const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(e));
     if (!weekKey) return s;
     const { regHours } = getRegOTHours(e, groupedByWeek[weekKey]);
     return s + regHours;
   }, 0);

   const totalOTHours = filtered.reduce((s, e) => {
     const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(e));
     if (!weekKey) return s;
     const { otHours } = getRegOTHours(e, groupedByWeek[weekKey]);
     return s + otHours;
   }, 0);
   // Helper to get reg/ot hours for an entry from the grouped week data
   const getEntryRegOT = (entry) => {
     const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(entry));
     return weekKey ? getRegOTHours(entry, groupedByWeek[weekKey]) : { regHours: entry.hours || 0, otHours: 0 };
   };

   const totalSaifCost = filtered.reduce((s, e) => {
     const { regHours, otHours } = getEntryRegOT(e);
     return s + getSaifCost(e, regHours, otHours);
   }, 0);

   const getMarkupAmount = (entry, regHours, otHours) => {
     const bbCost = getSaifCost(entry, regHours, otHours);
     if (entry.billable_rate) {
       return (entry.hours || 0) * entry.billable_rate - bbCost;
     } else if (entry.markup) {
       return bbCost * (entry.markup / 100);
     }
     return 0;
   };

   const getTotalBilled = (entry, regHours, otHours) => {
     const bbCost = getSaifCost(entry, regHours, otHours);
     return bbCost + getMarkupAmount(entry, regHours, otHours);
   };

   const totalBilled = filtered.reduce((s, e) => {
     const { regHours, otHours } = getEntryRegOT(e);
     return s + getTotalBilled(e, regHours, otHours);
   }, 0);

   const getBBBreakdown = (entry, regHours, otHours) => {
     const wage = userWageMap[entry.employee_email] || 0;
     const totalHours = entry.hours || 0;
     const reg = regHours !== undefined ? regHours : totalHours;
     const ot = otHours !== undefined ? otHours : 0;
     const saifCode = entry.saif_code || saifMappingMap[entry.cost_code] || "";
     const saifRate = saifCodesMap[saifCode] || 0;
     const regCost = reg * wage;
     const otCost = ot * wage * 1.5;
     const baseLaborCost = regCost + otCost;
     const taxAmount = baseLaborCost * 0.03;
     const saifAmount = totalHours * wage * (saifRate / 100);
     return { wage, totalHours, reg, ot, regCost, otCost, baseLaborCost, saifCode, saifRate, saifAmount, taxAmount, total: baseLaborCost + taxAmount + saifAmount };
   };
   const totalMarkup = filtered.reduce((s, e) => {
     const { regHours, otHours } = getEntryRegOT(e);
     return s + getMarkupAmount(e, regHours, otHours);
   }, 0);

   const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIndicator = ({ field }) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const handleExportCSV = () => {
    const headers = ["Date", "Employee", "Email", "Project", "Cost Code", "SAIF Code", "Reg Hrs", "OT Hrs", "BB Cost", "Markup", "Total", "Per Diem", "Trip Fee", "Approved", "Description"];
    const rows = filtered.map((e) => {
      const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(e));
      const { regHours, otHours } = weekKey ? getRegOTHours(e, groupedByWeek[weekKey]) : { regHours: e.hours, otHours: 0 };
      return [
        e.date, e.employee_name || "", e.employee_email || "", e.project_name || "",
        e.cost_code || "", e.saif_code || "", regHours.toFixed(2), otHours.toFixed(2),
        getSaifCost(e, regHours, otHours).toFixed(2),
        getMarkupAmount(e, regHours, otHours).toFixed(2),
        getTotalBilled(e, regHours, otHours).toFixed(2),
        e.per_diem || 0, e.trip_fee || 0,
        e.approved ? "Yes" : "No",
        `"${(e.description || "").replace(/"/g, '""')}"`
      ];
    });
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
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Regular Time</p>
          <p className="text-2xl font-bold font-barlow mt-1">{totalRegHours.toFixed(1)}</p>
        </Card>
        <Card className="p-4 text-center bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-700 uppercase tracking-wide font-semibold">Overtime</p>
          <p className="text-2xl font-bold font-barlow text-amber-700 mt-1">{totalOTHours.toFixed(1)}</p>
        </Card>
        <Card className="p-4 text-center bg-blue-50 border-blue-100">
          <p className="text-xs text-blue-700 uppercase tracking-wide font-semibold">BB Cost</p>
          <p className="text-2xl font-bold font-barlow text-blue-700 mt-1">${totalSaifCost.toFixed(2)}</p>
        </Card>
        <Card className="p-4 text-center bg-purple-50 border-purple-100">
          <p className="text-xs text-purple-700 uppercase tracking-wide font-semibold">Markup</p>
          <p className="text-2xl font-bold font-barlow text-purple-700 mt-1">${totalMarkup.toFixed(2)}</p>
        </Card>
        <Card className="p-4 text-center bg-green-50 border-green-100">
          <p className="text-xs text-green-700 uppercase tracking-wide font-semibold">Total Billed</p>
          <p className="text-2xl font-bold font-barlow text-green-700 mt-1">${totalBilled.toFixed(2)}</p>
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
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("hours")}>Reg Hrs<SortIndicator field="hours" /></TableHead>
                  <TableHead className="text-right">OT Hrs</TableHead>
                  <TableHead className="text-right">BB Cost</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Per Diem</TableHead>
                  <TableHead className="text-right">Trip Fee</TableHead>
                  <TableHead className="text-center">Approved</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(entry));
                  const { regHours, otHours } = weekKey ? getRegOTHours(entry, groupedByWeek[weekKey]) : { regHours: entry.hours, otHours: 0 };
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm whitespace-nowrap">{format(parseISO(entry.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-sm font-medium">{entry.employee_name || "—"}</TableCell>
                      <TableCell className="text-sm">{entry.project_name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {entry.cost_code ? <Badge variant="outline" className="text-xs">{entry.cost_code}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(entry.saif_code || saifMappingMap[entry.cost_code]) ? <Badge variant="outline" className="text-xs">{entry.saif_code || saifMappingMap[entry.cost_code]}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-right">{regHours > 0 ? `${regHours.toFixed(2)}h` : "—"}</TableCell>
                      <TableCell className="text-sm font-semibold text-right text-amber-700">{otHours > 0 ? `${otHours.toFixed(2)}h` : "—"}</TableCell>
                      <TableCell className="text-sm font-semibold text-right text-blue-700">
                         {getSaifCost(entry, regHours, otHours) > 0 ? (() => {
                           const b = getBBBreakdown(entry, regHours, otHours);
                           return (
                             <TooltipProvider>
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <span className="cursor-help underline decoration-dotted">${getSaifCost(entry, regHours, otHours).toFixed(2)}</span>
                                 </TooltipTrigger>
                                 <TooltipContent className="text-xs space-y-1 text-left p-3 max-w-xs">
                                   <p className="font-semibold mb-1">BB Cost Breakdown</p>
                                   <p>Reg: {b.reg.toFixed(2)}h × ${b.wage.toFixed(2)} = <strong>${b.regCost.toFixed(2)}</strong></p>
                                   {b.ot > 0 && <p>OT: {b.ot.toFixed(2)}h × ${b.wage.toFixed(2)} × 1.5 = <strong>${b.otCost.toFixed(2)}</strong></p>}
                                   <p>Tax (3% on labor): <strong>+${b.taxAmount.toFixed(2)}</strong></p>
                                   {b.saifRate > 0 && <p>SAIF ({b.saifCode} @ {b.saifRate}%): {b.totalHours}h × ${b.wage.toFixed(2)} = <strong>+${b.saifAmount.toFixed(2)}</strong></p>}
                                   <p className="border-t pt-1 font-semibold">Total: ${b.total.toFixed(2)}</p>
                                 </TooltipContent>
                               </Tooltip>
                             </TooltipProvider>
                           );
                         })() : "—"}
                       </TableCell>
                       <TableCell className="text-sm font-semibold text-right text-purple-700">
                         {getMarkupAmount(entry, regHours, otHours) > 0 ? (() => {
                           const bbCost = getSaifCost(entry, regHours, otHours);
                           const markup = getMarkupAmount(entry, regHours, otHours);
                           return (
                             <TooltipProvider>
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <span className="cursor-help underline decoration-dotted">${markup.toFixed(2)}</span>
                                 </TooltipTrigger>
                                 <TooltipContent className="text-xs space-y-1 text-left p-3 max-w-xs">
                                   <p className="font-semibold mb-1">Markup Breakdown</p>
                                   {entry.billable_rate
                                     ? <p>({entry.hours}h × ${entry.billable_rate}/hr) − BB Cost ${bbCost.toFixed(2)} = <strong>${markup.toFixed(2)}</strong></p>
                                     : <p>BB Cost ${bbCost.toFixed(2)} × {entry.markup}% = <strong>${markup.toFixed(2)}</strong></p>}
                                 </TooltipContent>
                               </Tooltip>
                             </TooltipProvider>
                           );
                         })() : "—"}
                       </TableCell>
                       <TableCell className="text-sm font-semibold text-right text-green-700">
                         {getTotalBilled(entry, regHours, otHours) > 0 ? (() => {
                           const bbCost = getSaifCost(entry, regHours, otHours);
                           const markup = getMarkupAmount(entry, regHours, otHours);
                           const total = getTotalBilled(entry, regHours, otHours);
                           return (
                             <TooltipProvider>
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <span className="cursor-help underline decoration-dotted">${total.toFixed(2)}</span>
                                 </TooltipTrigger>
                                 <TooltipContent className="text-xs space-y-1 text-left p-3 max-w-xs">
                                   <p className="font-semibold mb-1">Total Billed Breakdown</p>
                                   <p>BB Cost: <strong>${bbCost.toFixed(2)}</strong></p>
                                   <p>Markup: <strong>+${markup.toFixed(2)}</strong></p>
                                   <p className="border-t pt-1 font-semibold">Total: ${total.toFixed(2)}</p>
                                 </TooltipContent>
                               </Tooltip>
                             </TooltipProvider>
                           );
                         })() : "—"}
                       </TableCell>
                      <TableCell className="text-sm font-semibold text-right">{entry.per_diem ? `$${entry.per_diem.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-sm font-semibold text-right">{entry.trip_fee ? `$${entry.trip_fee.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-center">
                        {entry.approved ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{entry.description || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}