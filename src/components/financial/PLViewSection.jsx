import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SECTION_ORDER = ["Income", "Cost of Goods Sold", "Expenses", "Summary"];
const HIGHLIGHT_LABELS = new Set(["Gross Profit", "Net Operating Income", "Net Other Income", "Net Income"]);

function fmtMonthKey(k) {
  const [y, m] = k.split("-");
  return `${MONTH_NAMES[parseInt(m)]} ${y}`;
}

// Format per spec: no $, comma separated, 2 decimal places, negatives in parens
function fmtAmt(n) {
  if (n == null) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}

export default function PLViewSection({ refreshKey }) {
  const [viewMode, setViewMode] = useState("month"); // "month" | "quarter" | "year"
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedQuarterYear, setSelectedQuarterYear] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");

  // Load all entries
  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ["pl-entries", refreshKey],
    queryFn: () => base44.entities.PLEntry.list("sort_order", 2000),
  });

  // Derived options — all dynamic from data, nothing hardcoded
  const { availableMonths, availableYears, quartersByYear } = useMemo(() => {
    const months = new Set();
    const years = new Set();
    const qByYear = {}; // { "2026": Set(["Q1","Q2"]) }
    allEntries.forEach((e) => {
      if (e.month_key) months.add(e.month_key);
      if (e.year) {
        const y = String(e.year);
        years.add(y);
        if (e.quarter) {
          if (!qByYear[y]) qByYear[y] = new Set();
          qByYear[y].add(e.quarter);
        }
      }
    });
    return {
      availableMonths: [...months].sort().reverse(),
      availableYears: [...years].sort().reverse(),
      quartersByYear: Object.fromEntries(
        Object.entries(qByYear).map(([y, qs]) => [y, [...qs].sort()])
      ),
    };
  }, [allEntries]);

  // Auto-select defaults when data arrives
  const effectiveMonth = selectedMonth || availableMonths[0] || "";
  const effectiveYear = selectedYear || availableYears[0] || "";

  // Quarter mode: effective year comes from its own state, defaulting to the most recent year that has quarters
  const quarterYears = Object.keys(quartersByYear).sort().reverse();
  const effectiveQuarterYear = selectedQuarterYear || quarterYears[0] || "";
  const quartersForYear = quartersByYear[effectiveQuarterYear] || [];
  const effectiveQuarter = (quartersForYear.includes(selectedQuarter) ? selectedQuarter : null) || quartersForYear[quartersForYear.length - 1] || "";

  // Filter entries for selected period
  const filteredEntries = useMemo(() => {
    if (viewMode === "month") {
      return allEntries.filter((e) => e.month_key === effectiveMonth);
    }
    if (viewMode === "quarter") {
      return allEntries.filter((e) =>
        String(e.year) === effectiveQuarterYear && e.quarter === effectiveQuarter && !!e.month_key
      );
    }
    if (viewMode === "year") {
      return allEntries.filter((e) => String(e.year) === effectiveYear);
    }
    return [];
  }, [allEntries, viewMode, effectiveMonth, effectiveYear, effectiveQuarter, effectiveQuarterYear]);

  // Distinct month_keys in filtered data, sorted
  const monthKeys = useMemo(() => {
    return [...new Set(filteredEntries.map((e) => e.month_key))].sort();
  }, [filteredEntries]);

  // Pivot: unique rows with amounts by month_key
  const tableRows = useMemo(() => {
    const rowMap = {};
    filteredEntries.forEach((e) => {
      if (!rowMap[e.label]) {
        rowMap[e.label] = {
          label: e.label,
          section: e.section,
          row_type: e.row_type,
          indent_level: e.indent_level ?? 1,
          sort_order: e.sort_order ?? 0,
          byMonth: {},
        };
      }
      // Only store non-null amounts
      if (e.amount != null) {
        rowMap[e.label].byMonth[e.month_key] = (rowMap[e.label].byMonth[e.month_key] ?? 0) + e.amount;
      }
    });
    return Object.values(rowMap).sort((a, b) => a.sort_order - b.sort_order);
  }, [filteredEntries]);

  const rowsBySection = useMemo(() => {
    const map = {};
    SECTION_ORDER.forEach((s) => { map[s] = []; });
    tableRows.forEach((r) => {
      const sec = map[r.section] ? r.section : "Summary";
      map[sec].push(r);
    });
    return map;
  }, [tableRows]);

  const showTotal = monthKeys.length > 1;

  if (isLoading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (allEntries.length === 0) {
    return (
      <div className="p-10 text-center text-muted-foreground text-sm">
        No P&L data yet. Import a QuickBooks CSV above.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {["month","quarter","year"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 font-medium capitalize transition-colors ${
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {viewMode === "month" && (
          <Select value={effectiveMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableMonths.map((k) => (
                <SelectItem key={k} value={k}>{fmtMonthKey(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {viewMode === "quarter" && (
          <>
            <Select
              value={effectiveQuarterYear}
              onValueChange={(v) => { setSelectedQuarterYear(v); setSelectedQuarter(""); }}
            >
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {quarterYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={effectiveQuarter}
              onValueChange={(v) => setSelectedQuarter(v)}
            >
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {quartersForYear.map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {viewMode === "year" && (
          <Select value={effectiveYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {tableRows.length > 0 && (
          <span className="text-xs text-muted-foreground ml-1">
            {monthKeys.length} month{monthKeys.length !== 1 ? "s" : ""} · {tableRows.filter(r => r.row_type === "item").length} line items
          </span>
        )}
      </div>

      {/* Table */}
      {tableRows.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground text-sm border rounded-lg">No data for the selected period.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ backgroundColor: "#1C2331" }}>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-white min-w-[260px] sticky left-0" style={{ backgroundColor: "#1C2331" }}>
                  Account
                </th>
                {monthKeys.map((k) => (
                  <th key={k} className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-white whitespace-nowrap min-w-[120px]">
                    {fmtMonthKey(k)}
                  </th>
                ))}
                {showTotal && (
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-white min-w-[120px] border-l border-white/20">
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {SECTION_ORDER.map((section) => {
                const sectionRows = rowsBySection[section];
                if (!sectionRows || sectionRows.length === 0) return null;

                return sectionRows.map((row, i) => {
                  const isGroupHeader = row.row_type === "group_header";
                  const isSubtotal = row.row_type === "subtotal";
                  const isTotal = row.row_type === "total";
                  const isHighlight = HIGHLIGHT_LABELS.has(row.label);

                  // Row background
                  let rowStyle = {};
                  if (isGroupHeader) rowStyle = { backgroundColor: "#f0ede7" };
                  else if (isSubtotal) rowStyle = { backgroundColor: "#f5f4f1" };
                  else if (isHighlight) rowStyle = { backgroundColor: "#eef5ee" };
                  else rowStyle = { backgroundColor: i % 2 === 0 ? "#ffffff" : "#faf9f7" };

                  // Label padding
                  const labelPl = isGroupHeader || isTotal ? 16 : row.indent_level === 2 ? 40 : 24;

                  // Amount color for total/highlight rows
                  const getAmtColor = (val) => {
                    if (!isHighlight) return undefined;
                    if (val > 0) return "#15803d";
                    if (val < 0) return "#dc2626";
                    return undefined;
                  };

                  // Group header: full-width label, no amounts
                  if (isGroupHeader) {
                    return (
                      <tr key={row.label} style={rowStyle}>
                        <td
                          colSpan={monthKeys.length + (showTotal ? 2 : 1)}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-widest"
                          style={{ paddingLeft: labelPl, color: "#6b7280", letterSpacing: "0.1em" }}
                        >
                          {row.label}
                        </td>
                      </tr>
                    );
                  }

                  const rowTotal = monthKeys.reduce((s, k) => {
                    const v = row.byMonth[k];
                    return v != null ? s + v : s;
                  }, 0);
                  const hasAnyData = monthKeys.some((k) => row.byMonth[k] != null);

                  return (
                    <tr
                      key={row.label}
                      style={rowStyle}
                      className={`${isSubtotal || isTotal ? "border-t border-border/60" : ""} ${isHighlight ? "border-t-2" : ""}`}
                    >
                      <td
                        className={`py-2 pr-4 sticky left-0 ${isTotal || isHighlight ? "text-base font-bold" : isSubtotal ? "font-semibold" : "font-normal"}`}
                        style={{ paddingLeft: labelPl, fontSize: isTotal || isHighlight ? 14 : 13, ...rowStyle }}
                      >
                        {row.label}
                      </td>
                      {monthKeys.map((k) => {
                        const v = row.byMonth[k] ?? null;
                        return (
                          <td
                            key={k}
                            className={`text-right px-3 py-2 font-mono ${isTotal || isHighlight ? "text-sm font-bold" : isSubtotal ? "font-semibold text-xs" : "text-xs"}`}
                            style={{ color: getAmtColor(v) }}
                          >
                            {fmtAmt(v)}
                          </td>
                        );
                      })}
                      {showTotal && (
                        <td
                          className={`text-right px-4 py-2 font-mono border-l border-border/40 ${isTotal || isHighlight ? "text-sm font-bold" : isSubtotal ? "font-semibold text-xs" : "text-xs"}`}
                          style={{ color: hasAnyData ? getAmtColor(rowTotal) : undefined }}
                        >
                          {hasAnyData ? fmtAmt(rowTotal) : "—"}
                        </td>
                      )}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}