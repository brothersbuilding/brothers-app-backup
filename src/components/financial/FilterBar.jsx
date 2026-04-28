import React, { useState } from "react";
import { format } from "date-fns";

const PRESETS = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "q1", label: "Q1" },
  { key: "q2", label: "Q2" },
  { key: "q3", label: "Q3" },
  { key: "q4", label: "Q4" },
  { key: "year_to_last_month", label: "Year to Last Month End" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];

const COMPARISONS = [
  { key: "previous_period", label: "vs. Prev Period" },
  { key: "previous_quarter", label: "vs. Prev Quarter" },
  { key: "previous_year", label: "vs. Prev Year" },
];

export default function FilterBar({ preset, setPreset, comparison, setComparison, customRange, setCustomRange, range }) {
  const [pendingStart, setPendingStart] = useState(format(customRange.start, "yyyy-MM-dd"));
  const [pendingEnd, setPendingEnd] = useState(format(customRange.end, "yyyy-MM-dd"));

  const handlePreset = (key) => {
    setPreset(key);
  };

  const handleApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      setCustomRange({
        start: new Date(pendingStart + "T00:00:00"),
        end: new Date(pendingEnd + "T23:59:59"),
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset buttons */}
        <div className="flex gap-1 flex-wrap flex-1">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border ${
                preset === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

        {/* Comparison */}
        <div className="flex gap-1 flex-wrap">
          {COMPARISONS.map(c => (
            <button
              key={c.key}
              onClick={() => setComparison(c.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border ${
                comparison === c.key
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Range display */}
        <div className="ml-auto text-xs text-muted-foreground hidden md:block whitespace-nowrap">
          {format(range.start, "MMM d, yyyy")} – {format(range.end, "MMM d, yyyy")}
        </div>
      </div>

      {/* Custom range picker — inline below when active */}
      {preset === "custom" && (
        <div className="flex items-center gap-3 pt-1 pl-1">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Start</label>
            <input
              type="date"
              value={pendingStart}
              onChange={e => setPendingStart(e.target.value)}
              className="text-xs border rounded-md px-2 py-1 bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">End</label>
            <input
              type="date"
              value={pendingEnd}
              onChange={e => setPendingEnd(e.target.value)}
              className="text-xs border rounded-md px-2 py-1 bg-background"
            />
          </div>
          <button
            onClick={handleApplyCustom}
            className="px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground border border-primary hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}