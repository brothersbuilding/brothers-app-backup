import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function InlineSaifCodeEdit({ entry, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(null); // null | "saving" | "ok" | "error"
  const inputRef = useRef(null);

  const currentValue = entry.saif_code || "";

  useEffect(() => {
    if (editing) {
      setDraft(currentValue);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  // Auto-clear success/error icon after 1.5s
  useEffect(() => {
    if (status === "ok" || status === "error") {
      const t = setTimeout(() => setStatus(null), 1500);
      return () => clearTimeout(t);
    }
  }, [status]);

  const save = async () => {
    setEditing(false);
    if (draft === currentValue) return;
    setStatus("saving");
    try {
      await base44.entities.TimeEntry.update(entry.id, { saif_code: draft });
      setStatus("ok");
      onSaved?.();
    } catch {
      setStatus("error");
    }
  };

  const cancel = () => {
    setEditing(false);
    setDraft(currentValue);
  };

  if (!canEdit) {
    return currentValue
      ? <Badge variant="outline" className="text-xs">{currentValue}</Badge>
      : <span className="text-muted-foreground text-xs">—</span>;
  }

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
        placeholder="SAIF code"
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1"
        title="Click to edit SAIF code"
      >
        {currentValue
          ? <Badge variant="outline" className="text-xs group-hover:border-accent transition-colors">{currentValue}</Badge>
          : <span className="text-muted-foreground text-xs italic group-hover:text-accent transition-colors">Click to add</span>
        }
      </button>
      {status === "ok" && <Check className="w-3 h-3 text-green-600 shrink-0" />}
      {status === "error" && <X className="w-3 h-3 text-destructive shrink-0" />}
    </span>
  );
}