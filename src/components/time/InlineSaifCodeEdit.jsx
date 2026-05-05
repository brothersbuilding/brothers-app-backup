import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Priority: saif_code_override → autoMappedCode → ""
 * Edits are saved to saif_code_override (not saif_code).
 * Editing shows a dropdown populated from saifCodes map.
 */
export default function InlineSaifCodeEdit({ entry, canEdit, autoMappedCode, saifCodes = {}, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(null); // null | "ok" | "error"
  const selectRef = useRef(null);

  const isOverridden = !!(entry.saif_code_override && entry.saif_code_override.trim());
  const displayValue = isOverridden ? entry.saif_code_override.trim() : (autoMappedCode || "");

  useEffect(() => {
    if (editing) setTimeout(() => selectRef.current?.focus(), 0);
  }, [editing]);

  useEffect(() => {
    if (status === "ok" || status === "error") {
      const t = setTimeout(() => setStatus(null), 1500);
      return () => clearTimeout(t);
    }
  }, [status]);

  const save = async (value) => {
    setEditing(false);
    // value === "" means reset to default
    const newOverride = value === "" ? "" : value;
    if (newOverride === (entry.saif_code_override || "")) return;
    try {
      await base44.entities.TimeEntry.update(entry.id, { saif_code_override: newOverride });
      setStatus("ok");
      onSaved?.();
    } catch {
      setStatus("error");
    }
  };

  const reset = async (e) => {
    e.stopPropagation();
    try {
      await base44.entities.TimeEntry.update(entry.id, { saif_code_override: "" });
      setStatus("ok");
      onSaved?.();
    } catch {
      setStatus("error");
    }
  };

  // Read-only view
  if (!canEdit) {
    return displayValue
      ? <Badge variant="outline" className="text-xs">{displayValue}</Badge>
      : <span className="text-muted-foreground text-xs">—</span>;
  }

  // Dropdown edit mode
  if (editing) {
    return (
      <select
        ref={selectRef}
        defaultValue={entry.saif_code_override || ""}
        onChange={(e) => save(e.target.value)}
        onBlur={() => setEditing(false)}
        className="h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— Use cost code default —</option>
        {Object.entries(saifCodes).map(([name, rate]) => (
          <option key={name} value={name}>
            {name} ({rate}%)
          </option>
        ))}
      </select>
    );
  }

  // Display mode
  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1"
        title="Click to edit SAIF code"
      >
        {displayValue ? (
          <Badge
            variant="outline"
            className={`text-xs group-hover:border-accent transition-colors ${isOverridden ? "border-amber-400 text-amber-700" : ""}`}
          >
            {displayValue}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs italic group-hover:text-accent transition-colors">
            Click to add
          </span>
        )}
      </button>

      {isOverridden && (
        <span className="inline-flex items-center gap-0.5">
          <Pencil className="w-2.5 h-2.5 text-amber-500 shrink-0" title="Manually overridden" />
          <button
            onClick={reset}
            className="text-[10px] text-muted-foreground hover:text-destructive underline leading-none"
            title="Reset to auto-mapped value"
          >
            Reset
          </button>
        </span>
      )}

      {status === "ok" && <Check className="w-3 h-3 text-green-600 shrink-0" />}
      {status === "error" && <X className="w-3 h-3 text-destructive shrink-0" />}
    </span>
  );
}