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

function fmtAmt(n) {
  if (n == null) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `$(${abs})` : `$${abs}`;
}

function monthToQuarter(monthKey) {
  const m = parseInt(monthKey.split("-")[1]);
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

function parseMonthlyAmounts(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}

export default function PLViewSection({ refreshKey }) {
  const [viewMode, setViewMode] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedQuarterYear, setSelectedQuarterYear] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");

  // Load all entries (one record per label now)
  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ["pl-entries", refreshKey],
    queryFn: () => base44.entities.PLEntry.list("sort_order", 2000),
  });

  // Derived options from available month keys
  const { availableMonths, availableYears, quartersByYear, allMonthKeys } = useMemo(() => {
    const months = new Set();
    const years = new Set();
    const qByYear = {};
    allEntries.forEach((e) => {
      const keys = (e.month_keys || e.month_key || "").split(",").filter(Boolean);
      keys.forEach((k) => {
        months.add(k);
        const y = k.split("-")[0];
        years.add(y);
        const q = monthToQuarter(k);
        if (!qByYear[y]) qByYear[y] = new Set();
        qByYear[y].add(q);
      });
    });
    const sortedMonths = [...months].sort().reverse();
    return {
      availableMonths: sortedMonths,
      availableYears: [...years].sort().reverse(),
      quartersByYear: Object.fromEntries(
        Object.entries(qByYear).map(([y, qs]) => [y, [...qs].sort()])
      ),
      allMonthKeys: [...months].sort(),
    };
  }, [allEntries]);

  const effectiveMonth = selectedMonth || availableMonths[0] || "";
  const effectiveYear = selectedYear || availableYears[0] || "";
  const quarterYears = Object.keys(quartersByYear).sort().reverse();
  const effectiveQuarterYear = selectedQuarterYear || quarterYears[0] || "";
  const quartersForYear = quartersByYear[effectiveQuarterYear] || [];
  const effectiveQuarter = (quartersForYear.includes(selectedQuarter) ? selectedQuarter : null) || quartersForYear[quartersForYear.length - 1] || "";

  // Determine which month_keys are in scope for the selected period
  const scopedMonthKeys = useMemo(() => {
    if (viewMode === "month") {
      return effectiveMonth ? [effectiveMonth] : [];
    }
    if (viewMode === "quarter") {
      return allMonthKeys.filter((k) => {
        const y = k.split("-")[0];
        return y === effectiveQuarterYear && monthToQuarter(k) === effectiveQuarter;
      });
    }
    if (viewMode === "year") {
      return allMonthKeys.filter((k) => k.split("-")[0] === effectiveYear);
    }
    return [];
  }, [viewMode, effectiveMonth, effectiveYear, effectiveQuarterYear, effectiveQuarter, allMonthKeys]);

  const monthKeys = scopedMonthKeys;

  // Build table rows: one row per label, merging amounts across any duplicate label entries
  const tableRows = useMemo(() => {
    if (scopedMonthKeys.length === 0) return [];
    const rowMap = {};
    allEntries.forEach((e) => {
      const amounts = parseMonthlyAmounts(e.monthly_amounts);
      const hasRelevantData = scopedMonthKeys.some((k) => amounts[k] != null);
      const isAlwaysShow = e.row_type === "group_header" ||
                           e.row_type === "subtotal" ||
                           e.row_type === "total";
      if (!hasRelevantData && !isAlwaysShow) return;
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
      scopedMonthKeys.forEach((k) => {
        const v = amounts[k];
        if (v != null) {
          rowMap[e.label].byMonth[k] = (rowMap[e.label].byMonth[k] ?? 0) + v;
        }
      });
    });
    return Object.values(rowMap).sort((a, b) => a.sort_order - b.sort_order);
  }, [allEntries, scopedMonthKeys]);

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
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-8 w-40 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="h-9 bg-muted/80 animate-pulse" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5 border-t border-border/40"
              style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#faf9f7" }}>
              <div className="h-3 bg-muted animate-pulse rounded flex-1" style={{ maxWidth: `${40 + (i % 4) * 10}%` }} />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
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
            <Select value={effectiveQuarterYear} onValueChange={(v) => { setSelectedQuarterYear(v); setSelectedQuarter(""); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {quarterYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={effectiveQuarter} onValueChange={setSelectedQuarter}>
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

                  let rowStyle = {};
                  if (isGroupHeader) rowStyle = { backgroundColor: "#f0ede7" };
                  else if (isSubtotal) rowStyle = { backgroundColor: "#f5f4f1" };
                  else if (isHighlight) rowStyle = { backgroundColor: "#eef5ee" };
                  else rowStyle = { backgroundColor: i % 2 === 0 ? "#ffffff" : "#faf9f7" };

                  const labelPl = isGroupHeader || isTotal ? 16 : row.indent_level === 2 ? 40 : 24;

                  const getAmtColor = (val) => {
                    if (!isHighlight) return undefined;
                    if (val > 0) return "#15803d";
                    if (val < 0) return "#dc2626";
                    return undefined;
                  };

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