import React from "react";
import StatCard from "@/components/shared/StatCard";

export default function AR() {
  const agingBuckets = [
    { label: "0-30 Days", timeframe: "Current", value: "$0" },
    { label: "31-60 Days", timeframe: "Overdue", value: "$0" },
    { label: "61-90 Days", timeframe: "Very Overdue", value: "$0" },
    { label: "More than 90 Days", timeframe: "Critical", value: "$0" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Accounts Receivable</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track outstanding invoices by age</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Owed" value="$0" />
        {agingBuckets.map((bucket) => (
          <div key={bucket.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{bucket.label}</p>
            <p className="text-2xl font-bold text-foreground mb-2">{bucket.value}</p>
            <p className="text-xs text-muted-foreground">{bucket.timeframe}</p>
          </div>
        ))}
      </div>
    </div>
  );
}