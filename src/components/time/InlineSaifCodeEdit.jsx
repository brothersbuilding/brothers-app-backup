import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X, Pencil, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Priority: saif_code_override → saifMappingMap[cost_code] → ""
 * Edits are saved to saif_code_override (not saif_code).
 */
export default function InlineSaifCodeEdit({ entry, canEdit, autoMappedCode, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(null); // null | "saving" | "ok" | "error"
  const inputRef = useRef(null);

  const isOverridden = !!(entry.saif_code_override && entry.saif_code_override.trim());
  // Resolved display value
  const displayValue = isOverridden
    ? entry.saif_code_override
    : (autoMappedCode || "");

  useEffect(() => {
    if (editing) {
      setDraft(displayValue);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  useEffect(() => {
    if (status === "ok" || status === "error") {
      const t = setTimeout(() => setStatus(null), 1500);
      return () => clearTimeout(t);
    }
  }, [status]);

  const save = async () => {
    setEditing(false);
    if (draft === displayValue) return;
    setStatus("saving");
    try {
      await base44.entities.TimeEntry.update(entry.id, { saif_code_override: draft });
      setStatus("ok");
      onSaved?.();
    } catch {
      setStatus("error");
    }
  };

  const reset = async (e) => {
    e.stopPropagation();
    setStatus("saving");
    try {
      await base44.entities.TimeEntry.update(entry.id, { saif_code_override: "" });
      setStatus("ok");
      onSaved?.();
    } catch {
      setStatus("error");
    }
  };

  const cancel = () => {
    setEditing(false);
    setDraft(displayValue);
  };

  // Read-only view
  if (!canEdit) {
    return displayValue
      ? <Badge variant="outline" className="text-xs">{displayValue}</Badge>
      : <span className="text-muted-foreground text-xs">—</span>;
  }

  // Edit input
  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className="h-6 w-24 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder={autoMappedCode || "SAIF code"}
      />
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

      {/* Override indicator + reset */}
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