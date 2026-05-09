import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fmt = (n) =>
  n == null || n === 0
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const HIGHLIGHT_LABELS = new Set(["Gross Profit", "Net Operating Income", "Net Income"]);
const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKeyToLabel(key) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[parseInt(m)]} ${y}`;
}

const SECTION_ORDER = ["Income", "Cost of Goods Sold", "Expenses", "Summary"];

export default function PLViewSection({ refreshKey }) {
  const [selectedPeriod, setSelectedPeriod] = useState("all");

  // Load all entries (up to 2000)
  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ["pl-entries", refreshKey],
    queryFn: () => base44.entities.PLEntry.list("-uploaded_date", 2000),
  });

  // Derive available periods from data
  const periods = useMemo(() => {
    const yearSet = new Set();
    const quarterSet = new Set();
    const monthSet = new Set();

    allEntries.forEach((e) => {
      yearSet.add(`year:${e.year}`);
      quarterSet.add(`quarter:${e.year}:${e.quarter}`);
      monthSet.add(`month:${e.month_key}`);
    });

    const years = [...yearSet].map((v) => {
      const yr = v.split(":")[1];
      return { value: v, label: `FY ${yr}` };
    }).sort((a, b) => b.label.localeCompare(a.label));

    const quarters = [...quarterSet].map((v) => {
      const [, yr, q] = v.split(":");
      return { value: v, label: `${q} ${yr}` };
    }).sort((a, b) => b.label.localeCompare(a.label));

    const months = [...monthSet].map((v) => {
      const key = v.split(":")[1];
      return { value: v, label: monthKeyToLabel(key), key };
    }).sort((a, b) => b.key.localeCompare(a.key));

    return [
      { value: "all", label: "All Data" },
      ...years,
      ...quarters,
      ...months,
    ];
  }, [allEntries]);

  // Filter entries to selected period
  const filteredEntries = useMemo(() => {
    if (selectedPeriod === "all") return allEntries;
    const [type, ...parts] = selectedPeriod.split(":");
    if (type === "year") return allEntries.filter((e) => String(e.year) === parts[0]);
    if (type === "quarter") return allEntries.filter((e) => String(e.year) === parts[0] && e.quarter === parts[1]);
    if (type === "month") return allEntries.filter((e) => e.month_key === parts[0]);
    return allEntries;
  }, [allEntries, selectedPeriod]);

  // Distinct month_keys in current filter, sorted
  const monthKeys = useMemo(() => {
    return [...new Set(filteredEntries.map((e) => e.month_key))].sort();
  }, [filteredEntries]);

  // Build row structure: unique rows sorted by sort_order, with amounts by month
  const tableRows = useMemo(() => {
    if (filteredEntries.length === 0) return [];

    // Collect unique labels in sort_order
    const rowMeta = {};
    filteredEntries.forEach((e) => {
      if (!rowMeta[e.label]) {
        rowMeta[e.label] = {
          label: e.label,
          section: e.section,
          parent_label: e.parent_label,
          row_type: e.row_type,
          indent_level: e.indent_level,
          sort_order: e.sort_order,
          byMonth: {},
        };
      }
      rowMeta[e.label].byMonth[e.month_key] = (rowMeta[e.label].byMonth[e.month_key] || 0) + e.amount;
    });

    return Object.values(rowMeta).sort((a, b) => a.sort_order - b.sort_order);
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

  if (!isLoading && allEntries.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        No P&L data imported yet. Use the Import section above to upload a QuickBooks CSV.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {monthKeys.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {monthKeys.length} month{monthKeys.length !== 1 ? "s" : ""} · {tableRows.length} line items
          </span>
        )}
      </div>

      {/* P&L Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide min-w-[260px] sticky left-0 bg-primary">
                Account
              </th>
              {monthKeys.map((k) => (
                <th key={k} className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[110px]">
                  {monthKeyToLabel(k)}
                </th>
              ))}
              {monthKeys.length > 1 && (
                <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide border-l border-primary-foreground/20 min-w-[110px]">
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
                const isHighlight = HIGHLIGHT_LABELS.has(row.label);
                const isGroupHeader = row.row_type === "group_header";
                const isSubtotal = row.row_type === "subtotal";
                const isTotal = row.row_type === "total";

                let rowBg = i % 2 === 0 ? "bg-white" : "bg-muted/30";
                if (isGroupHeader) rowBg = "bg-primary/5";
                if (isSubtotal) rowBg = "bg-muted/60";
                if (isTotal || isHighlight) rowBg = "bg-primary/10";

                const labelPadding =
                  row.indent_level === 2 ? "pl-10" :
                  row.indent_level === 1 ? "pl-6" : "pl-4";

                const fontWeight =
                  isGroupHeader || isTotal || isHighlight ? "font-bold" :
                  isSubtotal ? "font-semibold" : "font-normal";

                const rowTotal = monthKeys.reduce((s, k) => s + (row.byMonth[k] || 0), 0);

                return (
                  <tr key={`${row.label}-${i}`} className={`${rowBg} border-b border-border/40`}>
                    <td className={`py-2 ${labelPadding} ${fontWeight} text-xs sticky left-0 ${rowBg}`}>
                      {row.label}
                    </td>
                    {monthKeys.map((k) => {
                      const v = row.byMonth[k] ?? null;
                      const valColor =
                        isHighlight
                          ? v > 0 ? "text-green-700" : v < 0 ? "text-red-700" : ""
                          : "";
                      return (
                        <td key={k} className={`text-right px-3 py-2 font-mono text-xs ${fontWeight} ${valColor}`}>
                          {v == null ? "—" : fmt(v)}
                        </td>
                      );
                    })}
                    {monthKeys.length > 1 && (
                      <td className={`text-right px-4 py-2 font-mono text-xs border-l border-border/40 ${fontWeight} ${
                        isHighlight
                          ? rowTotal > 0 ? "text-green-700" : rowTotal < 0 ? "text-red-700" : ""
                          : ""
                      }`}>
                        {fmt(rowTotal)}
                      </td>
                    )}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}