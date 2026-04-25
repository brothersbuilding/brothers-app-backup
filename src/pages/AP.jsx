import React from "react";
import OutstandingChecks from "@/components/vendors/OutstandingChecks";
import CompletedChecks from "@/components/vendors/CompletedChecks";

export default function AP() {
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

      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Completed</h2>
      </div>

      <CompletedChecks />
    </div>
  );
}