import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const fmt = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const HIGHLIGHT_LABELS = new Set(["Gross Profit", "Net Operating Income", "Net Income"]);
const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKeyToLabel(key) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[parseInt(m)]} ${y}`;
}

export default function PLViewSection({ refreshKey }) {
  const [selectedStatementId, setSelectedStatementId] = useState("all");

  const { data: statements = [] } = useQuery({
    queryKey: ["pl-statements", refreshKey],
    queryFn: () => base44.entities.PLStatement.list("-uploaded_date", 50),
  });

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["pl-rows", selectedStatementId, refreshKey],
    queryFn: () =>
      selectedStatementId === "all"
        ? base44.entities.PLRow.list("-created_date", 500)
        : base44.entities.PLRow.filter({ statement_id: selectedStatementId }),
    enabled: true,
  });

  // Most recent upload date for "New" badge logic
  const mostRecentUpload = useMemo(() => {
    if (!statements.length) return null;
    return statements[0]?.uploaded_date;
  }, [statements]);

  // Determine which statement is selected (for column headers)
  const selectedStatement = useMemo(() => {
    if (selectedStatementId === "all") return statements[0] || null;
    return statements.find((s) => s.id === selectedStatementId) || null;
  }, [selectedStatementId, statements]);

  // Rows for selected statement
  const rows = useMemo(() => {
    if (selectedStatementId === "all") {
      if (!statements.length) return [];
      // Show the most recent statement's rows
      const latest = statements[0];
      return allRows.filter((r) => r.statement_id === latest?.id);
    }
    return allRows;
  }, [allRows, selectedStatementId, statements]);

  // Month columns from the statement
  const monthKeys = useMemo(() => {
    if (!selectedStatement?.months) return [];
    return selectedStatement.months.split(",").filter(Boolean).sort();
  }, [selectedStatement]);

  // New labels: rows created in the most recent statement
  const newLabels = useMemo(() => {
    if (!mostRecentUpload || !statements.length) return new Set();
    // Find rows created on or after the most recent uploaded_date
    const cutoff = new Date(mostRecentUpload);
    return new Set(
      rows
        .filter((r) => r.created_date && new Date(r.created_date) >= cutoff)
        .map((r) => r.label)
    );
  }, [rows, mostRecentUpload]);

  const sectionOrder = ["Income", "Cost of Goods Sold", "Expenses", "Summary"];

  const rowsBySection = useMemo(() => {
    const map = {};
    sectionOrder.forEach((s) => { map[s] = []; });
    rows.forEach((r) => {
      const sec = map[r.section] ? r.section : "Summary";
      map[sec].push(r);
    });
    return map;
  }, [rows]);

  if (!statements.length && !isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        No P&L statements imported yet. Use the Import section above to upload a QuickBooks CSV.
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
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        <Select value={selectedStatementId} onValueChange={setSelectedStatementId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statements.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.period_label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* P&L Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide min-w-[260px]">
                Account
              </th>
              {monthKeys.map((k) => (
                <th key={k} className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">
                  {monthKeyToLabel(k)}
                </th>
              ))}
              <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide border-l border-primary-foreground/20">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {sectionOrder.map((section) => {
              const sectionRows = rowsBySection[section];
              if (!sectionRows || sectionRows.length === 0) return null;

              return sectionRows.map((row, i) => {
                const isHighlight = HIGHLIGHT_LABELS.has(row.label);
                const isGroupHeader = row.row_type === "group_header";
                const isSubtotal = row.row_type === "subtotal";
                const isTotal = row.row_type === "total";
                const isNew = newLabels.has(row.label);

                const monthlyValues = (() => {
                  try { return JSON.parse(row.monthly_values || "{}"); } catch { return {}; }
                })();

                const totalVal = row.total_value;
                const isPositive = totalVal > 0;
                const isNegative = totalVal < 0;

                let rowBg = i % 2 === 0 ? "bg-white" : "bg-muted/30";
                if (isGroupHeader) rowBg = "bg-primary/5";
                if (isSubtotal) rowBg = "bg-muted/50";
                if (isTotal || isHighlight) rowBg = "bg-primary/10";

                const labelPadding =
                  row.indent_level === 2 ? "pl-10" :
                  row.indent_level === 1 ? "pl-6" : "pl-4";

                const fontWeight =
                  isGroupHeader || isTotal || isHighlight ? "font-bold" :
                  isSubtotal ? "font-semibold" : "font-normal";

                const totalColor =
                  isHighlight
                    ? isPositive ? "text-green-700 font-bold" : isNegative ? "text-red-700 font-bold" : "font-bold"
                    : isSubtotal || isTotal
                    ? "font-semibold"
                    : "";

                return (
                  <tr key={row.id || `${row.label}-${i}`} className={`${rowBg} border-b border-border/50`}>
                    <td className={`py-2 ${labelPadding} ${fontWeight} text-xs`}>
                      <span className="flex items-center gap-2">
                        {row.label}
                        {isNew && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-blue-100 text-blue-700 border-blue-200">
                            New
                          </Badge>
                        )}
                      </span>
                    </td>
                    {monthKeys.map((k) => {
                      const v = monthlyValues[k];
                      const isPos = v > 0;
                      const isNeg = v < 0;
                      const colColor =
                        isHighlight
                          ? isPos ? "text-green-700" : isNeg ? "text-red-700" : ""
                          : "";
                      return (
                        <td key={k} className={`text-right px-3 py-2 font-mono text-xs ${fontWeight} ${colColor}`}>
                          {v == null ? "—" : fmt(v)}
                        </td>
                      );
                    })}
                    <td className={`text-right px-4 py-2 font-mono text-xs border-l border-border/50 ${totalColor}`}>
                      {fmt(totalVal)}
                    </td>
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