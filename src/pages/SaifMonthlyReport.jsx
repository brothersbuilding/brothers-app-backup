import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isWithinInterval } from "date-fns";

export default function SaifMonthlyReport() {
  // selectedPeriod can be "all", a month key like "2026-04" (covers both periods), or a period label
  const [selectedPeriod, setSelectedPeriod] = useState("all");

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

  const userWageMap = useMemo(() => {
    return Object.fromEntries(users.map((u) => [u.email, parseFloat(u.hourly_wage) || 0]));
  }, [users]);

  // Load saved pay periods and group by month
  const { payPeriods, monthGroups } = useMemo(() => {
    const record = appSettings.find((s) => s.key === "pay_periods");
    const periods = record ? JSON.parse(record.value) : [];
    const sorted = [...periods].sort((a, b) => new Date(b.start) - new Date(a.start));

    // Group periods by "YYYY-MM" of the start date
    const months = {};
    sorted.forEach((p) => {
      const monthKey = p.start.slice(0, 7); // "2026-04"
      if (!months[monthKey]) months[monthKey] = [];
      months[monthKey].push(p);
    });

    // Sort month keys descending
    const sortedMonths = Object.keys(months).sort((a, b) => b.localeCompare(a));
    const monthGroups = sortedMonths.map((key) => ({
      key,
      label: format(parseISO(key + "-01"), "MMMM yyyy"),
      periods: months[key],
      // The month's date range spans from earliest start to latest end
      start: months[key].reduce((min, p) => p.start < min ? p.start : min, months[key][0].start),
      end: months[key].reduce((max, p) => p.end > max ? p.end : max, months[key][0].end),
    }));

    return { payPeriods: sorted, monthGroups };
  }, [appSettings]);

  const filteredEntries = useMemo(() => {
    if (selectedPeriod === "all") return entries;

    // Month selection: key is "YYYY-MM"
    const monthGroup = monthGroups.find((m) => m.key === selectedPeriod);
    if (monthGroup) {
      return entries.filter((e) => {
        if (!e.date) return false;
        const d = parseISO(e.date);
        return isWithinInterval(d, { start: new Date(monthGroup.start), end: new Date(monthGroup.end) });
      });
    }

    // Individual period selection
    const period = payPeriods.find((p) => p.label === selectedPeriod);
    if (period) {
      return entries.filter((e) => {
        if (!e.date) return false;
        const d = parseISO(e.date);
        return isWithinInterval(d, { start: new Date(period.start), end: new Date(period.end) });
      });
    }

    return entries;
  }, [entries, selectedPeriod, monthGroups, payPeriods]);

  // Group by employee+week for OT calculation
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

  const getSaifAmount = (entry) => {
    const wage = userWageMap[entry.employee_email] || 0;
    const totalHours = entry.hours || 0;
    const saifCode = entry.saif_code || saifMappingMap[entry.cost_code] || "";
    const saifPercentage = saifCodesMap[saifCode] || 0;
    return totalHours * wage * (saifPercentage / 100);
  };

  const reportRows = useMemo(() => {
    const map = {};
    filteredEntries.forEach((entry) => {
      const saifCode = entry.saif_code || saifMappingMap[entry.cost_code] || "—";
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
          gross_wages: 0,
          saif_amount: 0,
        };
      }
      const wage = userWageMap[entry.employee_email] || 0;
      const { regHours, otHours } = getEntryRegOT(entry);
      map[key].total_hours += entry.hours || 0;
      map[key].reg_hours += regHours;
      map[key].ot_hours += otHours;
      map[key].gross_wages += regHours * wage + otHours * wage * 1.5;
      map[key].saif_amount += getSaifAmount(entry);
    });
    return Object.values(map).sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  }, [filteredEntries, userWageMap, saifCodesMap, saifMappingMap, groupedByWeek]);

  const totals = useMemo(() => reportRows.reduce(
    (acc, r) => ({
      total_hours: acc.total_hours + r.total_hours,
      reg_hours: acc.reg_hours + r.reg_hours,
      ot_hours: acc.ot_hours + r.ot_hours,
      gross_wages: acc.gross_wages + r.gross_wages,
      saif_amount: acc.saif_amount + r.saif_amount,
    }),
    { total_hours: 0, reg_hours: 0, ot_hours: 0, gross_wages: 0, saif_amount: 0 }
  ), [reportRows]);

  const selectedLabel = useMemo(() => {
    if (selectedPeriod === "all") return "All Periods";
    const month = monthGroups.find((m) => m.key === selectedPeriod);
    if (month) return month.label;
    const period = payPeriods.find((p) => p.label === selectedPeriod);
    return period?.label || selectedPeriod;
  }, [selectedPeriod, monthGroups, payPeriods]);

  const handleExportExcel = () => {
    const headers = ["Employee", "Email", "SAIF Code", "SAIF Rate (%)", "Total Hours", "Reg Hours", "OT Hours", "Gross Wages", "SAIF Amount"];
    const rows = reportRows.map((r) => [
      r.employee_name, r.employee_email, r.saif_code,
      r.saif_rate.toFixed(4), r.total_hours.toFixed(2),
      r.reg_hours.toFixed(2), r.ot_hours.toFixed(2),
      r.gross_wages.toFixed(2), r.saif_amount.toFixed(2),
    ]);
    rows.push(["TOTAL", "", "", "", totals.total_hours.toFixed(2), totals.reg_hours.toFixed(2), totals.ot_hours.toFixed(2), totals.gross_wages.toFixed(2), totals.saif_amount.toFixed(2)]);

    const csv = [
      [`SAIF Monthly Report — ${selectedLabel}`],
      [],
      headers,
      ...rows,
    ].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saif-monthly-report.csv`;
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
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">SAIF Monthly Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Workers' comp classification summary by employee and pay period</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
          <Download className="w-4 h-4" /> Export to Excel
        </Button>
      </div>

      {/* Filter */}
      <Card className="p-5 mb-6">
        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs">Pay Period</Label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="All periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              {monthGroups.map((month) => (
                <SelectGroup key={month.key}>
                  <SelectLabel className="text-xs font-bold text-foreground px-2 py-1.5 bg-muted/50">
                    {month.label}
                  </SelectLabel>
                  <SelectItem value={month.key}>
                    {month.label} (Full Month)
                  </SelectItem>
                  {month.periods.map((p) => (
                    <SelectItem key={p.label} value={p.label} className="pl-5">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Hours</p>
          <p className="text-2xl font-bold font-barlow mt-1">{totals.total_hours.toFixed(1)}</p>
        </Card>
        <Card className="p-4 text-center bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-700 uppercase tracking-wide font-semibold">OT Hours</p>
          <p className="text-2xl font-bold font-barlow text-amber-700 mt-1">{totals.ot_hours.toFixed(1)}</p>
        </Card>
        <Card className="p-4 text-center bg-blue-50 border-blue-100">
          <p className="text-xs text-blue-700 uppercase tracking-wide font-semibold">Gross Wages</p>
          <p className="text-2xl font-bold font-barlow text-blue-700 mt-1">${totals.gross_wages.toFixed(2)}</p>
        </Card>
        <Card className="p-4 text-center bg-green-50 border-green-100">
          <p className="text-xs text-green-700 uppercase tracking-wide font-semibold">SAIF Amount</p>
          <p className="text-2xl font-bold font-barlow text-green-700 mt-1">${totals.saif_amount.toFixed(2)}</p>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-medium text-muted-foreground">{reportRows.length} rows · {selectedLabel}</p>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Loading...</div>
          ) : reportRows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No data for the selected period.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Employee</TableHead>
                  <TableHead>SAIF Code</TableHead>
                  <TableHead className="text-right">Rate (%)</TableHead>
                  <TableHead className="text-right">Total Hrs</TableHead>
                  <TableHead className="text-right">Reg Hrs</TableHead>
                  <TableHead className="text-right text-amber-700">OT Hrs</TableHead>
                  <TableHead className="text-right text-blue-700">Gross Wages</TableHead>
                  <TableHead className="text-right text-green-700">SAIF Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{row.employee_name}</TableCell>
                    <TableCell>
                      {row.saif_code !== "—"
                        ? <Badge variant="outline" className="text-xs">{row.saif_code}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm">{row.saif_rate > 0 ? `${row.saif_rate}%` : "—"}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{row.total_hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-sm">{row.reg_hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-sm text-amber-700 font-semibold">{row.ot_hours > 0 ? row.ot_hours.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right text-sm text-blue-700 font-semibold">${row.gross_wages.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-sm text-green-700 font-semibold">${row.saif_amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell className="font-bold text-sm">TOTAL</TableCell>
                  <TableCell /><TableCell />
                  <TableCell className="text-right text-sm">{totals.total_hours.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm">{totals.reg_hours.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm text-amber-700">{totals.ot_hours.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm text-blue-700">${totals.gross_wages.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm text-green-700">${totals.saif_amount.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}