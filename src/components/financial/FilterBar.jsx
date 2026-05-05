import React, { useState } from "react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRESETS = [
  { key: "last_month", label: "Last Month" },
  { key: "q1", label: "Q1 2026" },
  { key: "q2", label: "Q2 2026" },
  { key: "q3", label: "Q3 2026" },
  { key: "q4", label: "Q4 2026" },
  { key: "ytd", label: "Year to Date 2026" },
  { key: "year_2025", label: "Full Year 2025" },
  { key: "year_2024", label: "Full Year 2024" },
  { key: "year_2023", label: "Full Year 2023" },
  { key: "year_2022", label: "Full Year 2022" },
  { key: "year_2021", label: "Full Year 2021" },
  { key: "year_2020", label: "Full Year 2020" },
  { key: "year_2019", label: "Full Year 2019" },
  { key: "custom", label: "Custom Range" },
];

export default function FilterBar({ preset, setPreset, customRange, setCustomRange, range }) {
  const [pendingStart, setPendingStart] = useState(format(customRange.start, "yyyy-MM-dd"));
  const [pendingEnd, setPendingEnd] = useState(format(customRange.end, "yyyy-MM-dd"));

  const currentPresetLabel = PRESETS.find(p => p.key === preset)?.label || "Select Period";

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
      <div className="flex flex-wrap items-center gap-4">
        {/* Period dropdown */}
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select Period" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map(p => (
              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Range display */}
        <div className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
          {format(range.start, "MMM d, yyyy")} – {format(range.end, "MMM d, yyyy")}
        </div>
      </div>

      {/* Custom range picker — inline below when active */}
      {preset === "custom" && (
        <div className="flex items-center gap-3 pt-1">
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