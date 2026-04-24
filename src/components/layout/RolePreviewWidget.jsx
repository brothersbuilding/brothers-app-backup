import React, { useState } from "react";
import { Eye, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = ["admin", "manager", "labor"];

export default function RolePreviewWidget({ previewRole, onSetPreview, realIsOwner }) {
  const [open, setOpen] = useState(false);

  if (!realIsOwner) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {previewRole && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" />
          Previewing as <span className="uppercase">{previewRole}</span>
          <button onClick={() => { onSetPreview(null); setOpen(false); }} className="ml-1 hover:opacity-70">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {open && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-3 w-44">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preview Role As</p>
          <div className="space-y-1">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => { onSetPreview(role === previewRole ? null : role); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors",
                  previewRole === role
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted text-foreground"
                )}
              >
                {role}
              </button>
            ))}
            <button
              onClick={() => { onSetPreview(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Reset (my real role)
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-sidebar text-sidebar-foreground rounded-full shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Eye className="w-4 h-4 text-sidebar-primary" />
        Preview Role
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}