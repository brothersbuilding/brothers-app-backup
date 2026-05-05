import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import InlineSaifCodeEdit from "@/components/time/InlineSaifCodeEdit";
import { Link } from "react-router-dom";
import { ChevronLeft, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isWithinInterval } from "date-fns";
import ClickableTooltip from "@/components/shared/ClickableTooltip";

const DEFAULT_PAY_PERIODS = [
  { label: "Dec 27, 2025 – Jan 10, 2026",  start: "2025-12-27", end: "2026-01-10" },
  { label: "Jan 11 – Jan 26, 2026",         start: "2026-01-11", end: "2026-01-26" },
  { label: "Jan 27 – Feb 10, 2026",         start: "2026-01-27", end: "2026-02-10" },
  { label: "Feb 11 – Feb 26, 2026",         start: "2026-02-11", end: "2026-02-26" },
  { label: "Feb 27 – Mar 10, 2026",         start: "2026-02-27", end: "2026-03-10" },
  { label: "Mar 11 – Mar 26, 2026",         start: "2026-03-11", end: "2026-03-26" },
  { label: "Mar 27 – Apr 10, 2026",         start: "2026-03-27", end: "2026-04-10" },
  { label: "Apr 11 – Apr 26, 2026",         start: "2026-04-11", end: "2026-04-26" },
  { label: "Apr 27 – May 10, 2026",         start: "2026-04-27", end: "2026-05-10" },
  { label: "May 11 – May 26, 2026",         start: "2026-05-11", end: "2026-05-26" },
  { label: "May 27 – Jun 10, 2026",         start: "2026-05-27", end: "2026-06-10" },
  { label: "Jun 11 – Jun 26, 2026",         start: "2026-06-11", end: "2026-06-26" },
  { label: "Jun 27 – Jul 10, 2026",         start: "2026-06-27", end: "2026-07-10" },
  { label: "Jul 11 – Jul 26, 2026",         start: "2026-07-11", end: "2026-07-26" },
  { label: "Jul 27 – Aug 10, 2026",         start: "2026-07-27", end: "2026-08-10" },
  { label: "Aug 11 – Aug 26, 2026",         start: "2026-08-11", end: "2026-08-26" },
  { label: "Aug 27 – Sep 10, 2026",         start: "2026-08-27", end: "2026-09-10" },
  { label: "Sep 11 – Sep 26, 2026",         start: "2026-09-11", end: "2026-09-26" },
  { label: "Sep 27 – Oct 10, 2026",         start: "2026-09-27", end: "2026-10-10" },
  { label: "Oct 11 – Oct 26, 2026",         start: "2026-10-11", end: "2026-10-26" },
  { label: "Oct 27 – Nov 10, 2026",         start: "2026-10-27", end: "2026-11-10" },
  { label: "Nov 11 – Nov 26, 2026",         start: "2026-11-11", end: "2026-11-26" },
  { label: "Nov 27 – Dec 10, 2026",         start: "2026-11-27", end: "2026-12-10" },
  { label: "Dec 11 – Dec 26, 2026",         start: "2026-12-11", end: "2026-12-26" },
];

export default function SaifMonthlyReport() {
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [sortField, setSortField] = useState("employee_name");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };
  const SortIndicator = ({ field }) => sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => base44.auth.me(),
  });
  const canEdit = currentUser?.role === "admin" || currentUser?.role === "manager";

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["timeEntries-all"],
    queryFn: () => base44.entities.TimeEntry.list("-date", 500),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

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

  // INT CARP SAIF rate for PTO hours
  const intCarpSaifCode = useMemo(() => {
    return Object.keys(saifCodesMap).find((k) => k.toLowerCase().includes("int carp") || k.toLowerCase().includes("5645")) || "";
  }, [saifCodesMap]);
  const intCarpRate = intCarpSaifCode ? saifCodesMap[intCarpSaifCode] : 0;

  const userWageMap = useMemo(() => {
    return Object.fromEntries(users.map((u) => [u.email, parseFloat(u.hourly_wage) || 0]));
  }, [users]);

  const { payPeriods, monthGroups } = useMemo(() => {
    const record = appSettings.find((s) => s.key === "pay_periods");
    let periods = DEFAULT_PAY_PERIODS;
    if (record) {
      try { periods = JSON.parse(record.value); } catch { periods = DEFAULT_PAY_PERIODS; }
    }
    const sorted = [...periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    const months = {};
    sorted.forEach((p) => {
      const endDate = new Date(p.end + "T12:00:00");
      let assignedMonth;
      if (endDate.getDate() > 26) {
        const next = new Date(endDate);
        next.setMonth(next.getMonth() + 1);
        assignedMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      } else {
        assignedMonth = p.end.slice(0, 7);
      }
      if (!months[assignedMonth]) months[assignedMonth] = [];
      months[assignedMonth].push(p);
    });
    const sortedMonths = Object.keys(months).sort((a, b) => a.localeCompare(b));
    const groups = sortedMonths.map((key) => ({
      key,
      label: format(parseISO(key + "-01"), "MMMM yyyy"),
      periods: months[key],
      start: months[key].reduce((min, p) => p.start < min ? p.start : min, months[key][0].start),
      end: months[key].reduce((max, p) => p.end > max ? p.end : max, months[key][0].end),
    }));
    return { payPeriods: sorted, monthGroups: groups };
  }, [appSettings]);

  const filteredEntries = useMemo(() => {
    if (selectedPeriod === "all") return entries;
    const monthGroup = monthGroups.find((m) => m.key === selectedPeriod);
    if (!monthGroup) return entries;
    return entries.filter((e) => {
      if (!e.date) return false;
      const d = parseISO(e.date);
      return isWithinInterval(d, { start: new Date(monthGroup.start), end: new Date(monthGroup.end) });
    });
  }, [entries, selectedPeriod, monthGroups]);

  const groupedByWeek = useMemo(() => {
    const groups = {};
    filteredEntries.forEach((e) => {
      const d = parseISO(e.date);
      const weekStart = new Date(d);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = `${e.employee_email}__${weekStart.toISOString()}`;
      if (!groups[weekKey]) groups[weekKey] = [];
      groups[weekKey].push(e);
    });
    return groups;
  }, [filteredEntries]);

  const getRegOTHours = (entry, allEntriesForWeek) => {
    const sorted = [...allEntriesForWeek].sort((a, b) => a.date.localeCompare(b.date));
    const entryIndex = sorted.findIndex((e) => e.id === entry.id);
    let cumulative = 0;
    for (let i = 0; i <= entryIndex; i++) cumulative += sorted[i].hours || 0;
    const prevCumulative = cumulative - (entry.hours || 0);
    const regHours = Math.max(0, Math.min(40, cumulative) - prevCumulative);
    const otHours = Math.max(0, (entry.hours || 0) - regHours);
    return { regHours, otHours };
  };

  const getEntryRegOT = (entry) => {
    const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(entry));
    return weekKey ? getRegOTHours(entry, groupedByWeek[weekKey]) : { regHours: entry.hours || 0, otHours: 0 };
  };

  const resolvedSaifCode = (entry) =>
    (entry.saif_code_override && entry.saif_code_override.trim())
      ? entry.saif_code_override.trim()
      : (saifMappingMap[entry.cost_code] || "");

  // SAIF wage base: ALL hours at straight time (no OT premium), plus PTO at INT CARP rate
  const getSaifWageBase = (entry, regHours, otHours) => {
    const wage = userWageMap[entry.employee_email] || 0;
    const totalHours = (regHours || 0) + (otHours || 0);
    const ptoHours = entry.pto_hours || 0;
    const ptoBase = ptoHours * wage; // PTO also at straight time
    return totalHours * wage + ptoBase;
  };

  const getSaifAmount = (entry, regHours, otHours) => {
    const saifCode = resolvedSaifCode(entry);
    const saifRate = saifCodesMap[saifCode] || 0;
    const wage = userWageMap[entry.employee_email] || 0;
    const totalHours = (regHours || 0) + (otHours || 0);
    const ptoHours = entry.pto_hours || 0;
    // Main SAIF amount at resolved code rate
    const mainAmount = totalHours * wage * (saifRate / 100);
    // PTO at INT CARP rate
    const ptoAmount = ptoHours * wage * (intCarpRate / 100);
    return mainAmount + ptoAmount;
  };

  // Total pay: reg at straight, OT at 1.5x, PTO at straight + per diem + trip fee
  const getTotalPay = (entry, regHours, otHours) => {
    const wage = userWageMap[entry.employee_email] || 0;
    const ptoHours = entry.pto_hours || 0;
    const regPay = (regHours || 0) * wage;
    const otPay = (otHours || 0) * wage * 1.5;
    const ptoPay = ptoHours * wage;
    const perDiem = entry.per_diem || 0;
    const tripFee = entry.trip_fee || 0;
    return regPay + otPay + ptoPay + perDiem + tripFee;
  };

  const reportRows = useMemo(() => {
    const map = {};
    filteredEntries.forEach((entry) => {
      const saifCode = resolvedSaifCode(entry) || "—";
      const key = `${entry.employee_email}__${saifCode}`;
      if (!map[key]) {
        map[key] = {
          employee_name: entry.employee_name || entry.employee_email || "—",
          employee_email: entry.employee_email || "",
          saif_code: saifCode,
          saif_rate: saifCodesMap[saifCode] || 0,
          total_hours: 0,
          reg_hours: 0,
          ot_hours: 0,
          saif_wage_base: 0,
          total_pay: 0,
          saif_amount: 0,
        };
      }
      const { regHours, otHours } = getEntryRegOT(entry);
      map[key].total_hours += entry.hours || 0;
      map[key].reg_hours += regHours;
      map[key].ot_hours += otHours;
      map[key].saif_wage_base += getSaifWageBase(entry, regHours, otHours);
      map[key].total_pay += getTotalPay(entry, regHours, otHours);
      map[key].saif_amount += getSaifAmount(entry, regHours, otHours);
    });
    return Object.values(map);
  }, [filteredEntries, userWageMap, saifCodesMap, saifMappingMap, groupedByWeek, intCarpRate]);

  // Per-employee summary (aggregated across all SAIF codes)
  const employeeSummary = useMemo(() => {
    const map = {};
    reportRows.forEach((r) => {
      if (!map[r.employee_email]) {
        map[r.employee_email] = {
          employee_name: r.employee_name,
          saif_wage_base: 0,
          total_pay: 0,
          saif_amount: 0,
        };
      }
      map[r.employee_email].saif_wage_base += r.saif_wage_base;
      map[r.employee_email].total_pay += r.total_pay;
      map[r.employee_email].saif_amount += r.saif_amount;
    });
    return Object.values(map).sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  }, [reportRows]);

  const sortedReportRows = useMemo(() => {
    return [...reportRows].sort((a, b) => {
      let va = a[sortField] ?? "";
      let vb = b[sortField] ?? "";
      if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [reportRows, sortField, sortDir]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      if (sortField === "employee_name") {
        return sortDir === "asc"
          ? (a.employee_name || "").localeCompare(b.employee_name || "")
          : (b.employee_name || "").localeCompare(a.employee_name || "");
      } else if (sortField === "saif_code") {
        return sortDir === "asc"
          ? resolvedSaifCode(a).localeCompare(resolvedSaifCode(b))
          : resolvedSaifCode(b).localeCompare(resolvedSaifCode(a));
      } else if (sortField === "saif_rate") {
        const va = saifCodesMap[resolvedSaifCode(a)] || 0;
        const vb = saifCodesMap[resolvedSaifCode(b)] || 0;
        return sortDir === "asc" ? va - vb : vb - va;
      } else if (sortField === "saif_wage_base") {
        const { regHours: rA, otHours: oA } = getEntryRegOT(a);
        const { regHours: rB, otHours: oB } = getEntryRegOT(b);
        return sortDir === "asc"
          ? getSaifWageBase(a, rA, oA) - getSaifWageBase(b, rB, oB)
          : getSaifWageBase(b, rB, oB) - getSaifWageBase(a, rA, oA);
      } else if (sortField === "total_pay") {
        const { regHours: rA, otHours: oA } = getEntryRegOT(a);
        const { regHours: rB, otHours: oB } = getEntryRegOT(b);
        return sortDir === "asc"
          ? getTotalPay(a, rA, oA) - getTotalPay(b, rB, oB)
          : getTotalPay(b, rB, oB) - getTotalPay(a, rA, oA);
      } else if (sortField === "saif_amount") {
        const { regHours: rA, otHours: oA } = getEntryRegOT(a);
        const { regHours: rB, otHours: oB } = getEntryRegOT(b);
        return sortDir === "asc"
          ? getSaifAmount(a, rA, oA) - getSaifAmount(b, rB, oB)
          : getSaifAmount(b, rB, oB) - getSaifAmount(a, rA, oA);
      }
      return 0;
    });
  }, [filteredEntries, sortField, sortDir, saifCodesMap, saifMappingMap, userWageMap, groupedByWeek]);

  const totals = useMemo(() => reportRows.reduce(
    (acc, r) => ({
      total_hours: acc.total_hours + r.total_hours,
      reg_hours: acc.reg_hours + r.reg_hours,
      ot_hours: acc.ot_hours + r.ot_hours,
      saif_wage_base: acc.saif_wage_base + r.saif_wage_base,
      total_pay: acc.total_pay + r.total_pay,
      saif_amount: acc.saif_amount + r.saif_amount,
    }),
    { total_hours: 0, reg_hours: 0, ot_hours: 0, saif_wage_base: 0, total_pay: 0, saif_amount: 0 }
  ), [reportRows]);

  const selectedLabel = useMemo(() => {
    if (selectedPeriod === "all") return "All Months";
    return monthGroups.find((m) => m.key === selectedPeriod)?.label || selectedPeriod;
  }, [selectedPeriod, monthGroups]);

  const employees = useMemo(() => {
    return [...new Set(filteredEntries.map((e) => e.employee_name).filter(Boolean))].sort();
  }, [filteredEntries]);

  const handleExportCSV = () => {
    const headers = ["Employee", "Email", "SAIF Code", "SAIF Rate (%)", "Total Hours", "Reg Hours", "OT Hours", "SAIF Wage Base", "Total Pay", "SAIF Amount"];
    const rows = reportRows.map((r) => [
      r.employee_name, r.employee_email, r.saif_code,
      r.saif_rate.toFixed(4), r.total_hours.toFixed(2),
      r.reg_hours.toFixed(2), r.ot_hours.toFixed(2),
      r.saif_wage_base.toFixed(2), r.total_pay.toFixed(2), r.saif_amount.toFixed(2),
    ]);
    rows.push(["TOTAL", "", "", "", totals.total_hours.toFixed(2), totals.reg_hours.toFixed(2), totals.ot_hours.toFixed(2), totals.saif_wage_base.toFixed(2), totals.total_pay.toFixed(2), totals.saif_amount.toFixed(2)]);
    const csv = [
      [`SAIF Monthly Report — ${selectedLabel}`],
      [],
      headers,
      ...rows,
    ].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `saif-monthly-report.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const { jsPDF } = window;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("SAIF Monthly Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 25);
    let y = 35;
    doc.setFontSize(9);
    const headers = ["Employee", "SAIF Code", "Total Hrs", "SAIF Wage Base", "Total Pay", "SAIF Amount"];
    const colWidths = [40, 30, 25, 35, 30, 30];
    headers.forEach((h, i) => doc.text(h, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y));
    y += 8;
    reportRows.forEach((r) => {
      if (y > 270) { doc.addPage(); y = 15; }
      const row = [r.employee_name, r.saif_code, r.total_hours.toFixed(2), r.saif_wage_base.toFixed(2), r.total_pay.toFixed(2), r.saif_amount.toFixed(2)];
      row.forEach((cell, i) => doc.text(String(cell), 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y));
      y += 8;
    });
    doc.save("saif-monthly-report.pdf");
  };

  const handleExportExcel = () => {
    const headers = ["Employee", "Email", "SAIF Code", "SAIF Rate (%)", "Total Hours", "Reg Hours", "OT Hours", "SAIF Wage Base", "Total Pay", "SAIF Amount"];
    const rows = reportRows.map((r) => [
      r.employee_name, r.employee_email, r.saif_code,
      r.saif_rate.toFixed(4), r.total_hours.toFixed(2),
      r.reg_hours.toFixed(2), r.ot_hours.toFixed(2),
      r.saif_wage_base.toFixed(2), r.total_pay.toFixed(2), r.saif_amount.toFixed(2),
    ]);
    rows.push(["TOTAL", "", "", "", totals.total_hours.toFixed(2), totals.reg_hours.toFixed(2), totals.ot_hours.toFixed(2), totals.saif_wage_base.toFixed(2), totals.total_pay.toFixed(2), totals.saif_amount.toFixed(2)]);
    const csv = [
      [`SAIF Monthly Report — ${selectedLabel}`],
      [],
      headers,
      ...rows,
    ].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `saif-monthly-report.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-3 mb-6">
        <Link to="/reports" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">SAIF Monthly Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Workers' comp classification summary by employee and pay period</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 md:self-auto self-start">
              <Download className="w-4 h-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>Export to CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPDF}>Export to PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>Export to Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter */}
      <Card className="p-5 mb-6">
        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs">Month</Label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="All months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthGroups.map((month) => (
                <SelectItem key={month.key} value={month.key}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPeriod !== "all" && (() => {
            const month = monthGroups.find((m) => m.key === selectedPeriod);
            if (!month) return null;
            const orderedPeriods = [...month.periods].sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div className="pt-2 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pay periods included:</p>
                {orderedPeriods.map((p) => (
                  <div key={p.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    {p.label}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Card>

      {/* SAIF Code Summary Table */}
      {(() => {
        const filteredReportRows = selectedEmployee === "all" ? reportRows : reportRows.filter((r) => r.employee_name === selectedEmployee);
        const byCode = {};
        Object.entries(saifCodesMap).forEach(([name, rate]) => {
          byCode[name] = { saif_code: name, saif_rate: rate, total_hours: 0, saif_wage_base: 0, saif_amount: 0 };
        });
        filteredReportRows.forEach((r) => {
          const code = r.saif_code === "—" ? "Unassigned" : r.saif_code;
          if (!byCode[code]) byCode[code] = { saif_code: code, saif_rate: r.saif_rate, total_hours: 0, saif_wage_base: 0, saif_amount: 0 };
          byCode[code].total_hours += r.total_hours;
          byCode[code].saif_wage_base += r.saif_wage_base;
          byCode[code].saif_amount += r.saif_amount;
        });
        const rows = Object.values(byCode).sort((a, b) => b.saif_amount - a.saif_amount);
        const filteredTotals = filteredReportRows.reduce(
          (acc, r) => ({ saif_wage_base: acc.saif_wage_base + r.saif_wage_base, total_pay: acc.total_pay + r.total_pay, saif_amount: acc.saif_amount + r.saif_amount, total_hours: acc.total_hours + r.total_hours }),
          { saif_wage_base: 0, total_pay: 0, saif_amount: 0, total_hours: 0 }
        );
        return (
          <Card className="overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-border space-y-3">
              <p className="text-sm font-medium text-muted-foreground">SAIF Code Summary</p>
              <div className="max-w-xs">
                <Label className="text-xs">Filter by Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>SAIF Code</TableHead>
                  <TableHead className="text-right">Rate (%)</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right text-blue-700">SAIF Wage Base</TableHead>
                  <TableHead className="text-right text-green-700">SAIF Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.saif_code}>
                    <TableCell>
                      {r.saif_code !== "Unassigned"
                        ? <Badge variant="outline" className="text-xs">{r.saif_code}</Badge>
                        : <span className="text-muted-foreground text-xs">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.saif_rate > 0 ? `${r.saif_rate}%` : "—"}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{r.total_hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-sm text-blue-700 font-semibold">
                      {r.saif_wage_base > 0 ? (
                        <ClickableTooltip
                          triggerText={`$${r.saif_wage_base.toFixed(2)}`}
                          content={
                            <>
                              <p className="font-semibold mb-1">SAIF Wage Base</p>
                              <p className="text-xs">All hours × hourly wage at straight time (no OT premium). Trip fees and per diem excluded.</p>
                              <p className="border-t pt-1 font-semibold">Total: ${r.saif_wage_base.toFixed(2)}</p>
                            </>
                          }
                        />
                      ) : "$0.00"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-green-700 font-semibold">
                      {r.saif_amount > 0 ? (
                        <ClickableTooltip
                          triggerText={`$${r.saif_amount.toFixed(2)}`}
                          content={
                            <>
                              <p className="font-semibold mb-1">SAIF Amount</p>
                              <p>SAIF Wage Base × {r.saif_rate}%</p>
                              <p>${r.saif_wage_base.toFixed(2)} × {r.saif_rate}% = <strong>${r.saif_amount.toFixed(2)}</strong></p>
                            </>
                          }
                        />
                      ) : "$0.00"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell className="font-bold text-sm">TOTAL</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-sm">{filteredTotals.total_hours.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm text-blue-700">${filteredTotals.saif_wage_base.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm text-green-700">${filteredTotals.saif_amount.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Per-Employee Summary */}
            <div className="border-t border-border">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-sm font-medium text-muted-foreground">Employee Summary</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right text-blue-700">SAIF Wage Base</TableHead>
                    <TableHead className="text-right text-purple-700">Total Pay</TableHead>
                    <TableHead className="text-right text-green-700">SAIF Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedEmployee === "all" ? employeeSummary : employeeSummary.filter((e) => e.employee_name === selectedEmployee)).map((emp) => (
                    <TableRow key={emp.employee_name}>
                      <TableCell className="font-medium text-sm">{emp.employee_name}</TableCell>
                      <TableCell className="text-right text-sm text-blue-700 font-semibold">${emp.saif_wage_base.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm text-purple-700 font-semibold">${emp.total_pay.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm text-green-700 font-semibold">${emp.saif_amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {(() => {
                    const empRows = selectedEmployee === "all" ? employeeSummary : employeeSummary.filter((e) => e.employee_name === selectedEmployee);
                    const empTotals = empRows.reduce((acc, e) => ({
                      saif_wage_base: acc.saif_wage_base + e.saif_wage_base,
                      total_pay: acc.total_pay + e.total_pay,
                      saif_amount: acc.saif_amount + e.saif_amount,
                    }), { saif_wage_base: 0, total_pay: 0, saif_amount: 0 });
                    return (
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell className="font-bold text-sm">TOTAL</TableCell>
                        <TableCell className="text-right text-sm text-blue-700">${empTotals.saif_wage_base.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm text-purple-700">${empTotals.total_pay.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm text-green-700">${empTotals.saif_amount.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })()}

      {/* Detail Entry Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-medium text-muted-foreground">{sortedEntries.length} entries · {selectedLabel}</p>
        </div>
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "500px" }}>
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Loading...</div>
          ) : sortedEntries.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No data for the selected period.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 sticky top-0">
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("date")}>Date<SortIndicator field="date" /></TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("employee_name")}>Employee<SortIndicator field="employee_name" /></TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("project_name")}>Project<SortIndicator field="project_name" /></TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("cost_code")}>Cost Code<SortIndicator field="cost_code" /></TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("saif_code")}>SAIF Code<SortIndicator field="saif_code" /></TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("hours")}>Hours<SortIndicator field="hours" /></TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground text-blue-700" onClick={() => toggleSort("saif_wage_base")}>SAIF Wage Base<SortIndicator field="saif_wage_base" /></TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground text-purple-700" onClick={() => toggleSort("total_pay")}>Total Pay<SortIndicator field="total_pay" /></TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground text-green-700" onClick={() => toggleSort("saif_amount")}>SAIF Amount<SortIndicator field="saif_amount" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEntries.map((entry) => {
                  const { regHours, otHours } = getEntryRegOT(entry);
                  const wage = userWageMap[entry.employee_email] || 0;
                  const ptoHours = entry.pto_hours || 0;
                  const saifWageBase = getSaifWageBase(entry, regHours, otHours);
                  const totalPay = getTotalPay(entry, regHours, otHours);
                  const saifAmount = getSaifAmount(entry, regHours, otHours);
                  const saifCode = resolvedSaifCode(entry) || "—";
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm whitespace-nowrap">{format(parseISO(entry.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-medium text-sm">{entry.employee_name || "—"}</TableCell>
                      <TableCell className="text-sm">{entry.project_name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {entry.cost_code
                          ? <Badge variant="outline" className="text-xs">{entry.cost_code}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        <InlineSaifCodeEdit
                          entry={entry}
                          canEdit={canEdit}
                          autoMappedCode={saifMappingMap[entry.cost_code] || ""}
                          saifCodes={saifCodesMap}
                          onSaved={() => queryClient.invalidateQueries({ queryKey: ["timeEntries-all"] })}
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">{entry.hours}</TableCell>
                      <TableCell className="text-right text-sm text-blue-700 font-semibold">
                        {saifWageBase > 0 ? (
                          <ClickableTooltip
                            triggerText={`$${saifWageBase.toFixed(2)}`}
                            content={
                              <>
                                <p className="font-semibold mb-1">{entry.employee_name || "Employee"} — SAIF Wage Base</p>
                                <p>Regular Hours: {regHours.toFixed(2)}h × ${wage.toFixed(2)} = ${(regHours * wage).toFixed(2)}</p>
                                {otHours > 0 && <p>OT Hours: {otHours.toFixed(2)}h × ${wage.toFixed(2)} (straight time) = ${(otHours * wage).toFixed(2)}</p>}
                                {ptoHours > 0 && <p>PTO Hours: {ptoHours.toFixed(2)}h × ${wage.toFixed(2)} (INT CARP rate) = ${(ptoHours * wage).toFixed(2)}</p>}
                                <p className="text-xs text-muted-foreground">Trip fee/per diem: NOT included</p>
                                <p className="border-t pt-1 font-semibold mt-1">Total SAIF Wage Base: ${saifWageBase.toFixed(2)}</p>
                              </>
                            }
                          />
                        ) : "$0.00"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-purple-700 font-semibold">
                        {totalPay > 0 ? (
                          <ClickableTooltip
                            triggerText={`$${totalPay.toFixed(2)}`}
                            content={
                              <>
                                <p className="font-semibold mb-1">{entry.employee_name || "Employee"} — Total Pay</p>
                                <p>Regular Pay: {regHours.toFixed(2)}h × ${wage.toFixed(2)} = ${(regHours * wage).toFixed(2)}</p>
                                {otHours > 0 && <p>OT Pay: {otHours.toFixed(2)}h × ${wage.toFixed(2)} × 1.5 = ${(otHours * wage * 1.5).toFixed(2)}</p>}
                                {ptoHours > 0 && <p>PTO Pay: {ptoHours.toFixed(2)}h × ${wage.toFixed(2)} = ${(ptoHours * wage).toFixed(2)}</p>}
                                {(entry.per_diem || 0) > 0 && <p>Per Diem: ${(entry.per_diem || 0).toFixed(2)}</p>}
                                {(entry.trip_fee || 0) > 0 && <p>Trip Fee: ${(entry.trip_fee || 0).toFixed(2)}</p>}
                                <p className="border-t pt-1 font-semibold mt-1">Total Pay: ${totalPay.toFixed(2)}</p>
                              </>
                            }
                          />
                        ) : "$0.00"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-700 font-semibold">${saifAmount.toFixed(2)}</TableCell>
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