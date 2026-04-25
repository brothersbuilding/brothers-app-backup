import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import OutstandingChecks from "@/components/vendors/OutstandingChecks";
import RetentionTable from "@/components/vendors/RetentionTable";
import CompletedChecks from "@/components/vendors/CompletedChecks";

export default function AP() {
  const [completedExpanded, setCompletedExpanded] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Accounts Payable</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage outstanding checks and payments</p>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Outstanding Checks</h2>
      </div>

      <div className="mb-8">
        <OutstandingChecks />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Retention</h2>
      </div>

      <div className="mb-8">
        <RetentionTable />
      </div>

      <button
        onClick={() => setCompletedExpanded(!completedExpanded)}
        className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity"
      >
        <ChevronDown className={`w-5 h-5 transition-transform ${completedExpanded ? "" : "rotate-90"}`} />
        <h2 className="text-xl font-bold text-foreground">Completed</h2>
      </button>

      {completedExpanded && <CompletedChecks />}
    </div>
  );
}