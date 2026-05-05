import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { format, parseISO, isAfter } from "date-fns";
import PerformanceTrends from "@/components/report/PerformanceTrends";

const C = {
  navy: "#1C2331",
  gold: "#C9A96E",
  bg: "#FFFFFF",
  sectionBg: "#F7F6F3",
  border: "#E2DDD6",
  text: "#1A1A1A",
  muted: "#6B7280",
  mutedLight: "#9CA3AF",
  positive: "#15803D",
  negative: "#DC2626",
};

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

function SectionHeader({ children }) {
  return (
    <div style={{
      background: C.navy,
      color: "#FFF",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "8px 12px",
      margin: "28px 0 0 0",
      borderLeft: `4px solid ${C.gold}`,
    }}>
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderTop: `4px solid ${C.gold}`,
      borderRadius: 6,
      padding: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{value}</div>
    </div>
  );
}

// Shared table styles
const TH_LEFT = { background: C.navy, color: "#FFF", padding: "8px 12px", fontSize: 11, fontWeight: 600, textAlign: "left", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const TH_RIGHT = { ...TH_LEFT, textAlign: "right" };
const td = (i, right = false, extra = {}) => ({
  padding: "8px 12px",
  borderBottom: `1px solid ${C.border}`,
  backgroundColor: i % 2 === 0 ? C.bg : C.sectionBg,
  textAlign: right ? "right" : "left",
  fontSize: 12,
  ...extra,
});

function pctBilledColor(pct) {
  if (pct > 100) return C.negative;
  if (pct > 80) return C.positive;
  if (pct >= 50) return C.gold;
  return C.text;
}

const CONTRACT_TYPE_SHORT = { res_gc: "Res GC", com_gc: "Com GC", sub_cont: "Sub Cont" };

export default function ReportView() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const results = await base44.asServiceRole.entities.SharedReport.filter({ token });
        if (!results || results.length === 0) { setError("This report link has expired or is invalid."); setLoading(false); return; }
        const sharedReport = results[0];
        if (sharedReport.expires_at && sharedReport.expires_at !== "2099-12-31") {
          if (!isAfter(new Date(sharedReport.expires_at), new Date())) { setError("This report link has expired."); setLoading(false); return; }
        }
        setReport(JSON.parse(sharedReport.report_data ?? "{}"));
        setLoading(false);
      } catch {
        setError("This report link has expired or is invalid.");
        setLoading(false);
      }
    }
    if (token) fetchReport();
  }, [token]);

  if (loading) {
    return (
      <div style={{ fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.sectionBg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.navy, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: C.muted, fontSize: 13 }}>Loading report…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.sectionBg }}>
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 32, textAlign: "center", maxWidth: 360 }}>
          <p style={{ fontWeight: 600, marginBottom: 8, color: C.text }}>Report Unavailable</p>
          <p style={{ color: C.muted, fontSize: 13 }}>{error || "No report data found."}</p>
        </div>
      </div>
    );
  }

  const generatedAt = report.generated_at ? format(parseISO(report.generated_at), "MMM d, yyyy") : format(new Date(), "MMM d, yyyy");
  const contractRows = report.contract_rows || [];
  const budgetRows = (report.budget_rows || []).slice(0, 15);
  const topUnpaid = report.top_unpaid_invoices || [];

  return (
    <div style={{ fontFamily: font, backgroundColor: C.sectionBg, color: C.text, margin: 0, padding: 0, minHeight: "100vh" }}>
      {/* 8px top bar */}
      <div style={{ height: 8, backgroundColor: C.navy, width: "100%" }} />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 48px" }}>

        {/* Header */}
        <div style={{ padding: "24px 0 20px" }}>
          <img
            src="https://cdn.prod.website-files.com/696f077aa9ae206c99d75a1f/696f09b2c7052fbb4c30089d_Brothers-Building-Logo.svg"
            alt="Brothers Building LLC"
            style={{ height: 48, display: "block", margin: "20px 0 4px 0" }}
          />
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 2px 0" }}>Financial Report · {report.period || "—"}</p>
          <p style={{ fontSize: 11, color: C.mutedLight, margin: 0 }}>Generated {generatedAt}</p>
          <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "16px 0 0 0" }} />
        </div>

        {/* 1. KEY METRICS */}
        <SectionHeader>Key Metrics</SectionHeader>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
          <StatCard label="Revenue" value={fmt(report.revenue)} />
          <StatCard label="COGS" value={fmt(report.cogs)} />
          <StatCard label="Gross Profit" value={fmt(report.gross_profit)} />
          <StatCard label="Gross Margin %" value={fmtPct(report.gross_margin)} />
          <StatCard label="Labor Cost" value={fmt(report.labor)} />
          <StatCard label="Labor % of Revenue" value={fmtPct(report.labor_pct)} />
          <StatCard label="Operating Expenses" value={fmt(report.opex)} />
          <StatCard label="Net Profit" value={fmt(report.net_profit)} />
          <StatCard label="Net Margin %" value={fmtPct(report.net_margin)} />
        </div>

        {/* 2. PERFORMANCE TRENDS */}
        {report.trend_periods && report.trend_periods.length > 0 && (
          <>
            <SectionHeader>Performance Trends</SectionHeader>
            <PerformanceTrends periods={report.trend_periods} noHeader />
          </>
        )}

        {/* 3. LABOR P&L */}
        <SectionHeader>Labor P&L</SectionHeader>
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderTop: "none" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={TH_LEFT}>Line Item</th>
                <th style={TH_RIGHT}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Labor Cost", value: fmt(report.labor), bold: false },
                { label: "Total Revenue", value: fmt(report.revenue), bold: false },
                { label: "Labor as % of Revenue", value: fmtPct(report.labor_pct), bold: true },
              ].map((row, i) => (
                <tr key={row.label}>
                  <td style={td(i, false, { fontWeight: row.bold ? 700 : undefined })}>{row.label}</td>
                  <td style={td(i, true, { fontWeight: row.bold ? 700 : undefined })}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. PROJECTED REVENUE */}
        {contractRows.length > 0 && (
          <>
            <SectionHeader>Projected Revenue</SectionHeader>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderTop: "none", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={TH_LEFT}>Project</th>
                    <th style={TH_LEFT}>Type</th>
                    <th style={TH_RIGHT}>Contract Value</th>
                    <th style={TH_RIGHT}>Invoiced to Date</th>
                    <th style={TH_RIGHT}>Remaining</th>
                    <th style={TH_RIGHT}>% Billed</th>
                    <th style={TH_RIGHT}>End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {contractRows.map((row, i) => (
                    <tr key={row.name || i}>
                      <td style={td(i)}>{row.name}</td>
                      <td style={td(i)}>{CONTRACT_TYPE_SHORT[row.type] || row.type || "—"}</td>
                      <td style={td(i, true)}>{fmt(row.value)}</td>
                      <td style={td(i, true)}>{fmt(row.invoiced)}</td>
                      <td style={td(i, true)}>{fmt(row.remaining)}</td>
                      <td style={td(i, true, { color: pctBilledColor(row.pctBilled), fontWeight: 600 })}>{fmtPct(row.pctBilled)}</td>
                      <td style={td(i, true)}>{row.endDate || "—"}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ ...td(1, false, { fontWeight: 700, backgroundColor: C.sectionBg }) }}>Total</td>
                    <td style={{ ...td(1, true, { fontWeight: 700, backgroundColor: C.sectionBg }) }}>{fmt(contractRows.reduce((s, r) => s + r.value, 0))}</td>
                    <td style={{ ...td(1, true, { fontWeight: 700, backgroundColor: C.sectionBg }) }}>{fmt(contractRows.reduce((s, r) => s + r.invoiced, 0))}</td>
                    <td style={{ ...td(1, true, { fontWeight: 700, backgroundColor: C.sectionBg }) }}>{fmt(contractRows.reduce((s, r) => s + r.remaining, 0))}</td>
                    <td style={{ ...td(1, false, { backgroundColor: C.sectionBg }) }} />
                    <td style={{ ...td(1, false, { backgroundColor: C.sectionBg }) }} />
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 5. BUDGET VS ACTUAL */}
        {budgetRows.length > 0 && (
          <>
            <SectionHeader>Budget vs Actual</SectionHeader>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderTop: "none", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={TH_LEFT}>Category</th>
                    <th style={TH_RIGHT}>Annual Budget</th>
                    <th style={TH_RIGHT}>YTD Actual</th>
                    <th style={TH_RIGHT}>Variance $</th>
                    <th style={TH_RIGHT}>Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((row, i) => {
                    const isPos = row.variance >= 0;
                    return (
                      <tr key={row.category || i}>
                        <td style={td(i)}>{row.category}</td>
                        <td style={td(i, true)}>{fmt(row.budget)}</td>
                        <td style={td(i, true)}>{fmt(row.actual)}</td>
                        <td style={td(i, true, { color: isPos ? C.positive : C.negative, fontWeight: 600 })}>
                          {(isPos ? "+" : "") + fmt(row.variance)}
                        </td>
                        <td style={td(i, true, { color: isPos ? C.positive : C.negative, fontWeight: 600 })}>
                          {(isPos ? "+" : "") + fmtPct(row.variancePct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 6. ACCOUNTS RECEIVABLE */}
        <SectionHeader>Accounts Receivable</SectionHeader>
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderTop: "none" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={TH_LEFT}>Metric</th>
                <th style={TH_RIGHT}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Total Outstanding", value: fmt(report.ar_outstanding), bold: true },
                { label: "Open Invoices", value: String(report.ar_invoice_count ?? 0), bold: false },
                { label: "0–30 Days", value: fmt(report.ar_0_30), bold: false },
                { label: "31–60 Days", value: fmt(report.ar_31_60), bold: false },
                { label: "61–90 Days", value: fmt(report.ar_61_90), bold: false, overdue: true },
                { label: "90+ Days", value: fmt(report.ar_90_plus), bold: false, overdue: true },
              ].map((row, i) => (
                <tr key={row.label}>
                  <td style={td(i, false, { fontWeight: row.bold ? 700 : undefined })}>{row.label}</td>
                  <td style={td(i, true, {
                    fontWeight: row.bold ? 700 : undefined,
                    color: row.overdue && (i === 4 ? report.ar_61_90 > 0 : report.ar_90_plus > 0) ? C.negative : undefined,
                  })}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Top unpaid invoices */}
          {topUnpaid.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={TH_LEFT}>Invoice</th>
                    <th style={TH_LEFT}>Customer / Project</th>
                    <th style={TH_RIGHT}>Balance</th>
                    <th style={TH_RIGHT}>Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {topUnpaid.map((inv, i) => (
                    <tr key={inv.invoice_number || i}>
                      <td style={td(i)}>{inv.invoice_number || "—"}</td>
                      <td style={td(i)}>{inv.customer}{inv.project ? ` · ${inv.project}` : ""}</td>
                      <td style={td(i, true, { fontWeight: 600 })}>{fmt(inv.open_balance)}</td>
                      <td style={td(i, true, {
                        color: inv.days_overdue > 60 ? C.negative : inv.days_overdue > 30 ? "#D97706" : undefined,
                        fontWeight: inv.days_overdue > 30 ? 600 : undefined,
                      })}>
                        {inv.days_overdue > 0 ? `${inv.days_overdue}d` : "Current"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 12, borderTop: `4px solid ${C.gold}`, display: "flex", justifyContent: "space-between", fontSize: 10, color: C.mutedLight }}>
          <span>Brothers Building LLC — Confidential</span>
          <span>Generated {generatedAt}</span>
        </div>
      </div>
    </div>
  );
}