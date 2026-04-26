import React from "react";
import StatCard from "@/components/shared/StatCard";

export default function AR() {
  const agingBuckets = [
    { label: "0-30 Days", value: "$0" },
    { label: "31-60 Days", value: "$0" },
    { label: "61-90 Days", value: "$0" },
    { label: "More than 90 Days", value: "$0" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Accounts Receivable</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track outstanding invoices by age</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {agingBuckets.map((bucket) => (
          <StatCard key={bucket.label} label={bucket.label} value={bucket.value} />
        ))}
      </div>
    </div>
  );
}