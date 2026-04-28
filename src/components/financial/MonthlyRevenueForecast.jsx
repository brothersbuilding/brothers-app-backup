import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { format, addMonths, startOfMonth } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

const TYPE_COLORS = {
  res_gc: "#3b82f6",    // blue
  com_gc: "#a855f7",    // purple
  sub_cont: "#f97316",  // orange
};

const TYPE_LABELS = {
  res_gc: "Residential GC",
  com_gc: "Commercial GC",
  sub_cont: "Sub Contract",
};

function isDateInMonth(date, month) {
  const d = new Date(date);
  return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
}

function isContractActiveInMonth(contract, month) {
  if (!contract.projected_end_date) return true;
  const endDate = new Date(contract.projected_end_date);
  return endDate >= month && endDate < addMonths(month, 1);
}

export default function MonthlyRevenueForecast() {
  const { data: backlogData, isLoading } = useQuery({
    queryKey: ["contract-backlog"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getContractBacklog", {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const chartData = useMemo(() => {
    if (!backlogData?.contracts) return [];

    const now = new Date();
    const startMonth = startOfMonth(now);
    const months = [];
    
    // Generate 12 months of forecast
    for (let i = 0; i < 12; i++) {
      const month = addMonths(startMonth, i);
      months.push(month);
    }

    // For each month, sum monthly run rates by contract type
    const data = months.map(month => {
      const monthLabel = format(month, "MMM yyyy");
      const monthData = {
        month: monthLabel,
        res_gc: 0,
        com_gc: 0,
        sub_cont: 0,
      };

      backlogData.contracts.forEach(contract => {
        if (isContractActiveInMonth(contract, month)) {
          monthData[contract.contract_type] = (monthData[contract.contract_type] ?? 0) + contract.monthly_run_rate;
        }
      });

      return monthData;
    });

    return data;
  }, [backlogData]);

  const totalByType = useMemo(() => {
    if (chartData.length === 0) return {};
    return {
      res_gc: chartData.reduce((s, d) => s + d.res_gc, 0),
      com_gc: chartData.reduce((s, d) => s + d.com_gc, 0),
      sub_cont: chartData.reduce((s, d) => s + d.sub_cont, 0),
    };
  }, [chartData]);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading forecast…</div>;
  }

  if (chartData.length === 0 || Object.values(totalByType).every(v => v === 0)) {
    return <div className="text-center py-8 text-muted-foreground text-sm">No forecast data available.</div>;
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">12-Month Revenue Forecast by Contract Type</h2>
      
      <div className="bg-card border rounded-xl p-4 shadow-sm">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 10 }} 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tick={{ fontSize: 10 }} 
              tickFormatter={v => `$${Math.round(v / 1000)}k`}
            />
            <Tooltip 
              formatter={v => fmt(v)}
              contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.95)", border: "1px solid #e5e7eb", borderRadius: "6px" }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="square"
            />
            <Bar dataKey="res_gc" stackId="a" fill={TYPE_COLORS.res_gc} name={TYPE_LABELS.res_gc} radius={[2, 2, 0, 0]} />
            <Bar dataKey="com_gc" stackId="a" fill={TYPE_COLORS.com_gc} name={TYPE_LABELS.com_gc} radius={[2, 2, 0, 0]} />
            <Bar dataKey="sub_cont" stackId="a" fill={TYPE_COLORS.sub_cont} name={TYPE_LABELS.sub_cont} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary by type */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Residential GC</p>
          <p className="text-sm font-semibold" style={{ color: TYPE_COLORS.res_gc }}>{fmt(totalByType.res_gc)}</p>
        </div>
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Commercial GC</p>
          <p className="text-sm font-semibold" style={{ color: TYPE_COLORS.com_gc }}>{fmt(totalByType.com_gc)}</p>
        </div>
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Sub Contract</p>
          <p className="text-sm font-semibold" style={{ color: TYPE_COLORS.sub_cont }}>{fmt(totalByType.sub_cont)}</p>
        </div>
      </div>
    </div>
  );
}