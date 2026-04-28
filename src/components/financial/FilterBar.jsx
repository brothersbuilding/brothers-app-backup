import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

const PRESETS = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "last_quarter", label: "Last Quarter" },
  { key: "ytd", label: "YTD" },
  { key: "last_year", label: "Last Year" },
  { key: "custom", label: "Custom" },
];

const COMPARISONS = [
  { key: "previous_period", label: "vs. Prev Period" },
  { key: "previous_quarter", label: "vs. Prev Quarter" },
  { key: "previous_year", label: "vs. Prev Year" },
];

export default function FilterBar({ preset, setPreset, comparison, setComparison, headcount, setHeadcount, customRange, setCustomRange, range }) {
  const [showCustom, setShowCustom] = useState(false);

  const handlePreset = (key) => {
    setPreset(key);
    if (key === "custom") setShowCustom(true);
    else setShowCustom(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Preset buttons */}
      <div className="flex gap-1 flex-wrap">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => handlePreset(p.key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${preset === p.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={format(customRange.start, "yyyy-MM-dd")}
            onChange={e => setCustomRange(r => ({ ...r, start: new Date(e.target.value) }))}
            className="text-xs border rounded-md px-2 py-1 bg-background"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={format(customRange.end, "yyyy-MM-dd")}
            onChange={e => setCustomRange(r => ({ ...r, end: new Date(e.target.value) }))}
            className="text-xs border rounded-md px-2 py-1 bg-background"
          />
        </div>
      )}

      <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

      {/* Comparison */}
      <div className="flex gap-1">
        {COMPARISONS.map(c => (
          <button
            key={c.key}
            onClick={() => setComparison(c.key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${comparison === c.key ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

      {/* Headcount */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Headcount:</span>
        <Input
          type="number"
          min={1}
          value={headcount}
          onChange={e => setHeadcount(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 h-7 text-xs text-center"
        />
      </div>

      {/* Range display */}
      <div className="ml-auto text-xs text-muted-foreground hidden md:block">
        {format(range.start, "MMM d, yyyy")} – {format(range.end, "MMM d, yyyy")}
      </div>
    </div>
  );
}