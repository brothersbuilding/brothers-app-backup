import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { format, parseISO, isAfter } from "date-fns";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

function StatCard({ label, value, isPercent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{isPercent ? fmtPct(value) : fmt(value)}</p>
    </div>
  );
}

function MetricRow({ label, value, subtext }) {
  return (
    <div className="border-b border-slate-200 py-4">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
}

export default function ReportView() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const results = await base44.asServiceRole.entities.SharedReport.filter({ token });
        if (!results || results.length === 0) {
          setError("This report link has expired or is invalid");
          setLoading(false);
          return;
        }

        const sharedReport = results[0];
        
        // Check expiry (2099-12-31 means never expires)
        if (sharedReport.expires_at && sharedReport.expires_at !== '2099-12-31') {
          const expiresAt = new Date(sharedReport.expires_at);
          const now = new Date();
          if (!isAfter(expiresAt, now)) {
            setError("This report link has expired or is invalid");
            setLoading(false);
            return;
          }
        }

        const reportData = JSON.parse(sharedReport.report_data ?? "{}");
        setReport(reportData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching report:", err);
        setError("This report link has expired or is invalid");
        setLoading(false);
      }
    }

    if (token) {
      fetchReport();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-slate-200 p-6 text-center max-w-sm shadow-sm">
          <p className="text-slate-700 font-medium mb-2">Report Unavailable</p>
          <p className="text-slate-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 text-sm">No report data available</p>
        </div>
      </div>
    );
  }

  const kpi = report.kpi || {};
  const summary = report.summary || {};

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4">
        <h1 className="text-xl font-bold text-slate-900">Financial Report</h1>
        <p className="text-xs text-slate-500 mt-1">Shared report • {report.period || "Report"}</p>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Key Metrics */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Key Metrics</h2>
          <div className="space-y-3">
            <StatCard label="Revenue" value={kpi.revenue} />
            <StatCard label="Gross Profit" value={kpi.grossProfit} />
            <StatCard label="Gross Margin %" value={kpi.grossMargin} isPercent />
            <StatCard label="Net Profit" value={kpi.netProfit} />
            <StatCard label="Net Margin %" value={kpi.netMargin} isPercent />
          </div>
        </section>

        {/* Profit & Loss Summary */}
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">P&L Summary</h2>
          </div>
          <div className="divide-y divide-slate-200">
            <MetricRow label="Revenue" value={fmt(kpi.revenue)} />
            <MetricRow label="Cost of Goods Sold" value={fmt(kpi.cogs)} />
            <MetricRow label="Gross Profit" value={fmt(kpi.grossProfit)} />
            <MetricRow label="Labor Cost" value={fmt(kpi.labor)} />
            <MetricRow label="Operating Expenses" value={fmt(kpi.opex)} />
            <div className="border-b-2 border-slate-300 py-4">
              <div className="flex justify-between items-baseline px-4">
                <p className="text-sm font-bold text-slate-900">Net Profit</p>
                <p className="text-xl font-bold text-slate-900">{fmt(kpi.netProfit)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Expected Revenue */}
        {summary.total_remaining_expected_revenue !== undefined && (
          <section className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Expected Revenue</h2>
            </div>
            <div className="divide-y divide-slate-200">
              <MetricRow 
                label="Total Contract Value" 
                value={fmt(summary.total_contract_value)} 
              />
              <MetricRow 
                label="Total Invoiced" 
                value={fmt(summary.total_invoiced)} 
              />
              <div className="border-b-2 border-slate-300 py-4">
                <div className="flex justify-between items-baseline px-4">
                  <p className="text-sm font-bold text-slate-900">Remaining Expected Revenue</p>
                  <p className="text-xl font-bold text-slate-900">{fmt(summary.total_remaining_expected_revenue)}</p>
                </div>
              </div>
              <MetricRow 
                label="Projected Year-End Revenue" 
                value={fmt(summary.projected_year_end_revenue)}
                subtext="YTD revenue + expected revenue"
              />
            </div>
          </section>
        )}

        {/* AR Aging */}
        {summary.total_outstanding !== undefined && (
          <section className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">AR Summary</h2>
            </div>
            <div className="divide-y divide-slate-200">
              <MetricRow 
                label="Total Outstanding" 
                value={fmt(summary.total_outstanding)}
                subtext={`${summary.unpaid_invoice_count || 0} invoices`}
              />
              <MetricRow 
                label="0–30 Days" 
                value={fmt(summary.ar_0_30 || 0)}
              />
              <MetricRow 
                label="31–60 Days" 
                value={fmt(summary.ar_31_60 || 0)}
              />
              <MetricRow 
                label="61–90 Days" 
                value={fmt(summary.ar_61_90 || 0)}
              />
              <MetricRow 
                label="90+ Days Overdue" 
                value={fmt(summary.ar_90_plus || 0)}
              />
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pb-4">
          <p>Report generated on {report.generated_at ? format(parseISO(report.generated_at), "MMM d, yyyy h:mm a") : "—"}</p>
        </div>
      </div>
    </div>
  );
}