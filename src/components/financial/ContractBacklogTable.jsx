import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

function ContractTypeBadge({ type }) {
  const styles = {
    res_gc: "bg-blue-100 text-blue-800",
    com_gc: "bg-purple-100 text-purple-800",
    sub_cont: "bg-orange-100 text-orange-800",
  };
  const labels = { res_gc: "Residential GC", com_gc: "Commercial GC", sub_cont: "Sub Contract" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[type] ?? "bg-muted text-muted-foreground"}`}>
      {labels[type] ?? type ?? "—"}
    </span>
  );
}

function ForecastStatusBadge({ status }) {
  const styles = {
    on_track: "bg-green-100 text-green-800",
    lost: "bg-red-100 text-red-700",
    delayed: "bg-blue-100 text-blue-800",
    reduced_scope: "bg-yellow-100 text-yellow-800",
  };
  const labels = { on_track: "On Track", lost: "Lost", delayed: "Delayed", reduced_scope: "Reduced Scope" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status ?? "—"}
    </span>
  );
}

function BilledProgressBar({ invoiced, contractValue }) {
  const pct = contractValue > 0 ? (invoiced / contractValue) * 100 : 0;
  const clamped = Math.min(Math.max(pct, 0), 100);
  let color = "bg-green-500";
  if (pct >= 95) color = "bg-blue-500";
  else if (pct >= 80) color = "bg-orange-500";
  else if (pct >= 50) color = "bg-yellow-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden min-w-[60px]">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function SummaryCard({ label, value, sub, muted = false }) {
  return (
    <div className={`${muted ? "bg-muted/30" : "bg-card border"} rounded-xl p-4 shadow-sm`}>
      <p className={`text-xs mb-1 ${muted ? "text-muted-foreground" : "text-muted-foreground"}`}>{label}</p>
      <p className={`text-xl font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ContractBacklogTable({ onEdit, invoices = [] }) {
  const { data: backlogData, isLoading } = useQuery({
    queryKey: ["contract-backlog"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getContractBacklog", {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const contracts = backlogData?.contracts ?? [];
  const summary = backlogData?.summary ?? {};

  // Calculate monthly forecast data for chart
  const monthlyForecast = useMemo(() => {
    const activeContracts = contracts.filter(c => c.total_invoiced <= c.contract_value);
    const months = {};
    
    activeContracts.forEach(c => {
      if (!c.projected_end_date) return;
      const endDate = new Date(c.projected_end_date);
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      
      if (endDate < currentDate) return;
      
      const monthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = endDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      if (!months[monthKey]) {
        months[monthKey] = { month: monthLabel, res_gc: 0, com_gc: 0, sub_cont: 0 };
      }
      
      const type = c.contract_type || 'res_gc';
      months[monthKey][type] = (months[monthKey][type] || 0) + (c.remaining_value || 0);
    });
    
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [contracts]);

  const sorted = useMemo(() => {
    // Separate active and complete (over-billed)
    const active = [];
    const complete = [];
    
    contracts.forEach(c => {
      const isOverBilled = c.total_invoiced > c.contract_value;
      if (isOverBilled) {
        complete.push(c);
      } else {
        active.push(c);
      }
    });
    
    // Sort each group by value
    active.sort((a, b) => b.contract_value - a.contract_value);
    complete.sort((a, b) => b.contract_value - a.contract_value);
    
    return [...active, ...complete];
  }, [contracts]);

  const totals = useMemo(() => {
    // Only include active contracts (not over-billed) in calculations
    const activeContracts = sorted.filter(c => c.total_invoiced <= c.contract_value);
    return {
      contract_value: activeContracts.reduce((s, c) => s + c.contract_value, 0),
      adjusted_value: activeContracts.reduce((s, c) => s + (c.adjusted_value ?? c.contract_value), 0),
      total_invoiced: activeContracts.reduce((s, c) => s + c.total_invoiced, 0),
      remaining_value: activeContracts.reduce((s, c) => s + c.remaining_value, 0),
      projected_this_year: activeContracts.reduce((s, c) => s + c.projected_revenue_this_year, 0),
      projected_next_year: activeContracts.reduce((s, c) => s + c.projected_revenue_next_year, 0),
    };
  }, [sorted]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Projected Revenue</h2>

        {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Original Projection" value={fmt(totals.contract_value)} />
        <SummaryCard label="Adjusted Forecast" value={fmt(totals.adjusted_value)} />
        <SummaryCard label="Projected This Year" value={fmt(totals.projected_this_year)} />
        <SummaryCard label="Carrying to 2027" value={fmt(totals.projected_next_year)} muted={true} sub="Future revenue" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading backlog…
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No active contracts found.</div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Project</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs text-right">Contract Value</TableHead>
                  <TableHead className="text-xs text-right">Invoiced to Date</TableHead>
                  <TableHead className="text-xs text-right">Remaining</TableHead>
                  <TableHead className="text-xs">% Billed</TableHead>
                  <TableHead className="text-xs">End Date <span className="text-muted-foreground font-normal text-[10px]">(click edit to add)</span></TableHead>
                  <TableHead className="text-xs text-right">Monthly Run Rate</TableHead>
                  <TableHead className="text-xs text-right">This Year</TableHead>
                  <TableHead className="text-xs text-right">Beyond 2026</TableHead>
                  <TableHead className="text-xs">Forecast Status</TableHead>
                  <TableHead className="text-right w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(c => {
                  const isComplete = c.total_invoiced > c.contract_value;
                  return (
                  <TableRow key={c.id} className={isComplete ? "bg-muted/20 hover:bg-muted/30 opacity-60" : "hover:bg-muted/50"}>
                    <TableCell className="text-sm font-medium">{c.project_name}</TableCell>
                    <TableCell><ContractTypeBadge type={c.contract_type} /></TableCell>
                    <TableCell className="text-sm text-right">{fmt(c.contract_value)}</TableCell>
                    <TableCell className="text-sm text-right text-green-700">{fmt(c.total_invoiced)}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">{fmt(c.remaining_value)}</TableCell>
                    <TableCell><BilledProgressBar invoiced={c.total_invoiced} contractValue={c.contract_value} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.projected_end_date ? format(parseISO(c.projected_end_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right">{fmt(c.monthly_run_rate)}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">{fmt(c.projected_revenue_this_year)}</TableCell>
                    <TableCell className={`text-sm text-right ${c.projected_revenue_next_year > 0 ? "text-muted-foreground font-semibold" : ""}`}>
                      {fmt(c.projected_revenue_next_year)}
                    </TableCell>
                    <TableCell>{isComplete ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Complete</span> : <ForecastStatusBadge status={c.forecast_status} />}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit?.(c)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {/* Totals Row */}
                <TableRow className="bg-muted/70 font-semibold border-t-2">
                  <TableCell className="text-sm" colSpan={2}>Totals ({sorted.length} contracts)</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.contract_value)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.total_invoiced)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.remaining_value)}</TableCell>
                  <TableCell><BilledProgressBar invoiced={totals.total_invoiced} contractValue={totals.contract_value} /></TableCell>
                  <TableCell />
                  <TableCell className="text-sm text-right">{fmt(totals.projected_this_year / sorted.length)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.projected_this_year)}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(totals.projected_next_year)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      </div>

      {/* Monthly Revenue Forecast Chart */}
      {monthlyForecast.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Monthly Revenue Forecast</h3>
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '0.75rem' }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '0.75rem' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Legend />
                <Bar dataKey="res_gc" stackId="a" fill="hsl(var(--chart-1))" name="Residential GC" />
                <Bar dataKey="com_gc" stackId="a" fill="hsl(var(--chart-2))" name="Commercial GC" />
                <Bar dataKey="sub_cont" stackId="a" fill="hsl(var(--chart-3))" name="Sub Contract" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}