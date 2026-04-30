import React, { useState, useRef, useEffect } from "react";
import { Check, X } from "lucide-react";

/**
 * Renders a clickable display value that turns into a time or number input on click.
 * Props:
 *   value        — display string (e.g. "8:30 am" or "4.0h")
 *   inputValue   — the raw value for the input (HH:MM or number string)
 *   type         — "time" | "number"
 *   step         — step for number inputs (default "0.25")
 *   disabled     — if true, renders read-only span
 *   onSave(val)  — called with the new raw value string; must return a Promise
 *   className    — extra classes for the outer wrapper
 */
export default function InlineTimeEdit({ value, inputValue, type = "time", step = "0.25", disabled = false, onSave, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(inputValue ?? "");
  const [status, setStatus] = useState(null); // null | "saving" | "success" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type === "time") inputRef.current.select?.();
    }
  }, [editing, type]);

  // Reset draft when entry value changes from outside
  useEffect(() => {
    setDraft(inputValue ?? "");
  }, [inputValue]);

  const handleOpen = () => {
    if (disabled) return;
    setDraft(inputValue ?? "");
    setStatus(null);
    setErrorMsg("");
    setEditing(true);
  };

  const handleSave = async () => {
    if (draft === (inputValue ?? "")) {
      setEditing(false);
      return;
    }
    setStatus("saving");
    try {
      await onSave(draft);
      setStatus("success");
      setTimeout(() => {
        setStatus(null);
        setEditing(false);
      }, 800);
    } catch (err) {
      setErrorMsg(err?.message || "Save failed");
      setStatus("error");
      setTimeout(() => {
        setStatus(null);
        setDraft(inputValue ?? "");
        setEditing(false);
      }, 1500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setEditing(false); setDraft(inputValue ?? ""); }
  };

  if (!editing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          onClick={handleOpen}
          disabled={disabled}
          className={`text-xs px-1 py-0.5 rounded transition-colors ${disabled ? "cursor-default" : "hover:bg-muted cursor-pointer"}`}
        >
          {value || "—"}
        </button>
        {status === "success" && <Check className="w-3 h-3 text-green-500 shrink-0" />}
        {status === "error" && <X className="w-3 h-3 text-red-500 shrink-0" />}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        ref={inputRef}
        type={type}
        step={type === "number" ? step : undefined}
        min={type === "number" ? "0" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-6 text-xs border border-ring rounded px-1 bg-background w-20 focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {status === "saving" && <span className="text-[10px] text-muted-foreground">…</span>}
      {status === "success" && <Check className="w-3 h-3 text-green-500 shrink-0" />}
      {status === "error" && (
        <span className="text-[10px] text-red-500 shrink-0" title={errorMsg}><X className="w-3 h-3 inline" /></span>
      )}
    </div>
  );
}