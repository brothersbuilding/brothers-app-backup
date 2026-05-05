import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { format, parseISO, isAfter } from "date-fns";
import PerformanceTrends from "@/components/report/PerformanceTrends";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

const COLORS = {
  navy: "#1A1A2E",
  gold: "#C9A96E",
  bg: "#FFFFFF",
  sectionBg: "#F7F7F5",
  border: "#E8E4DC",
  text: "#1A1A1A",
  muted: "#6B7280",
  positive: "#15803D",
  negative: "#DC2626",
};

const styles = {
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    backgroundColor: COLORS.sectionBg,
    color: COLORS.text,
    margin: 0,
    padding: 0,
    minHeight: "100vh",
  },
  topBar: {
    height: 6,
    backgroundColor: COLORS.navy,
    width: "100%",
  },
  page: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "0 24px 48px",
  },
  header: {
    backgroundColor: COLORS.bg,
    borderBottom: `1px solid ${COLORS.border}`,
    padding: "28px 0 24px",
    marginBottom: 32,
  },
  logo: { width: 180, display: "block", marginBottom: 12 },
  headerPeriod: { fontSize: 13, color: COLORS.muted, marginBottom: 4 },
  headerGenerated: { fontSize: 11, color: COLORS.muted },
  sectionHeader: {
    backgroundColor: COLORS.navy,
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    padding: "8px 10px 8px 14px",
    borderLeft: `4px solid ${COLORS.gold}`,
    marginBottom: 0,
  },
  sectionWrap: { marginBottom: 32 },
  card: {
    backgroundColor: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderTop: `4px solid ${COLORS.gold}`,
    borderRadius: 6,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    padding: 16,
  },
  cardLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    color: COLORS.muted,
    letterSpacing: "0.08em",
    marginBottom: 6,
  },
  cardValue: { fontSize: 22, fontWeight: "bold", color: COLORS.text },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 0 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    backgroundColor: COLORS.navy,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 600,
    padding: "8px 10px",
    textAlign: "left",
    letterSpacing: "0.04em",
  },
  thRight: {
    backgroundColor: COLORS.navy,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 600,
    padding: "8px 10px",
    textAlign: "right",
    letterSpacing: "0.04em",
  },
  tdEven: { backgroundColor: COLORS.bg, padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` },
  tdOdd: { backgroundColor: COLORS.sectionBg, padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` },
  tdRight: { textAlign: "right" },
  positive: { color: COLORS.positive, fontWeight: "bold" },
  negative: { color: COLORS.negative, fontWeight: "bold" },
  footer: {
    borderTop: `4px solid ${COLORS.gold}`,
    display: "flex",
    justifyContent: "space-between",
    padding: "16px 0",
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 40,
  },
};

function StatCard({ label, value, isPercent }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{isPercent ? fmtPct(value) : fmt(value)}</div>
    </div>
  );
}

function SectionHeader({ children }) {
  return <div style={styles.sectionHeader}>{children}</div>;
}

function TableRow({ cells, rowIndex }) {
  const bg = rowIndex % 2 === 0 ? styles.tdEven : styles.tdOdd;
  return (
    <tr>
      {cells.map((cell, i) => (
        <td
          key={i}
          style={{
            ...bg,
            ...(cell.right ? styles.tdRight : {}),
            ...(cell.positive ? styles.positive : {}),
            ...(cell.negative ? styles.negative : {}),
            fontWeight: cell.bold ? 600 : undefined,
          }}
        >
          {cell.value}
        </td>
      ))}
    </tr>
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
          setError("This report link has expired or is invalid.");
          setLoading(false);
          return;
        }
        const sharedReport = results[0];
        if (sharedReport.expires_at && sharedReport.expires_at !== "2099-12-31") {
          const expiresAt = new Date(sharedReport.expires_at);
          if (!isAfter(expiresAt, new Date())) {
            setError("This report link has expired.");
            setLoading(false);
            return;
          }
        }
        setReport(JSON.parse(sharedReport.report_data ?? "{}"));
        setLoading(false);
      } catch (err) {
        setError("This report link has expired or is invalid.");
        setLoading(false);
      }
    }
    if (token) fetchReport();
  }, [token]);

  if (loading) {
    return (
      <div style={{ ...styles.body, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.navy, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: COLORS.muted, fontSize: 13 }}>Loading report…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ ...styles.body, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 32, textAlign: "center", maxWidth: 360 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Report Unavailable</p>
          <p style={{ color: COLORS.muted, fontSize: 13 }}>{error || "No report data found."}</p>
        </div>
      </div>
    );
  }

  const generatedAt = report.generated_at ? format(parseISO(report.generated_at), "MMM d, yyyy") : format(new Date(), "MMM d, yyyy");
  const contractRows = report.contract_rows || [];
  const budgetRows = report.budget_rows || [];
  const topUnpaid = report.top_unpaid_invoices || [];

  return (
    <div style={styles.body}>
      {/* Top accent bar */}
      <div style={styles.topBar} />

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <img
            src="https://cdn.prod.website-files.com/696f077aa9ae206c99d75a1f/696f09b2c7052fbb4c30089d_Brothers-Building-Logo.svg"
            alt="Brothers Building LLC"
            style={styles.logo}
          />
          <p style={styles.headerPeriod}>Financial Report · {report.period || "—"}</p>
          <p style={styles.headerGenerated}>Generated {generatedAt}</p>
        </div>

        {/* Key Metrics */}
        <div style={styles.sectionWrap}>
          <SectionHeader>Key Metrics</SectionHeader>
          <div style={{ ...styles.grid3, marginTop: 12 }}>
            <StatCard label="Revenue" value={report.revenue} />
            <StatCard label="COGS" value={report.cogs} />
            <StatCard label="Gross Profit" value={report.gross_profit} />
            <StatCard label="Gross Margin %" value={report.gross_margin} isPercent />
            <StatCard label="Labor Cost" value={report.labor} />
            <StatCard label="Labor % of Revenue" value={report.labor_pct} isPercent />
            <StatCard label="Operating Expenses" value={report.opex} />
            <StatCard label="Net Profit" value={report.net_profit} />
            <StatCard label="Net Margin %" value={report.net_margin} isPercent />
          </div>
        </div>

        {/* Performance Trends */}
        {report.trend_periods && report.trend_periods.length > 0 && (
          <PerformanceTrends periods={report.trend_periods} />
        )}

        {/* Labor P&L */}
        <div style={styles.sectionWrap}>
          <SectionHeader>Labor P&L</SectionHeader>
          <div style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: "none" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Line Item</th>
                  <th style={styles.thRight}>Amount</th>
                  <th style={styles.thRight}>% of Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Revenue", value: fmt(report.revenue), pct: "100.0%" },
                  { label: "COGS", value: fmt(report.cogs), pct: fmtPct(report.revenue > 0 ? (report.cogs / report.revenue) * 100 : 0) },
                  { label: "Gross Profit", value: fmt(report.gross_profit), pct: fmtPct(report.gross_margin), bold: true },
                  { label: "Labor Cost", value: fmt(report.labor), pct: fmtPct(report.labor_pct) },
                  { label: "Operating Expenses", value: fmt(report.opex), pct: fmtPct(report.revenue > 0 ? (report.opex / report.revenue) * 100 : 0) },
                  { label: "Net Profit", value: fmt(report.net_profit), pct: fmtPct(report.net_margin), bold: true },
                ].map((row, i) => (
                  <tr key={row.label}>
                    <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), fontWeight: row.bold ? 600 : undefined }}>{row.label}</td>
                    <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight, fontWeight: row.bold ? 600 : undefined }}>{row.value}</td>
                    <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight, color: COLORS.muted }}>{row.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Projected Revenue */}
        {contractRows.length > 0 && (
          <div style={styles.sectionWrap}>
            <SectionHeader>Projected Revenue — Active Contracts</SectionHeader>
            <div style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: "none" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.thRight}>Contract Value</th>
                    <th style={styles.thRight}>Invoiced</th>
                    <th style={styles.thRight}>Remaining</th>
                    <th style={styles.thRight}>% Billed</th>
                  </tr>
                </thead>
                <tbody>
                  {contractRows.map((row, i) => (
                    <tr key={row.name}>
                      <td style={i % 2 === 0 ? styles.tdEven : styles.tdOdd}>{row.name}</td>
                      <td style={i % 2 === 0 ? styles.tdEven : styles.tdOdd}>{row.type}</td>
                      <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight }}>{fmt(row.value)}</td>
                      <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight }}>{fmt(row.invoiced)}</td>
                      <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight }}>{fmt(row.remaining)}</td>
                      <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight }}>{fmtPct(row.pctBilled)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ ...styles.tdEven, fontWeight: 700 }}>Total</td>
                    <td style={{ ...styles.tdEven, ...styles.tdRight, fontWeight: 700 }}>{fmt(contractRows.reduce((s, r) => s + r.value, 0))}</td>
                    <td style={{ ...styles.tdEven, ...styles.tdRight, fontWeight: 700 }}>{fmt(contractRows.reduce((s, r) => s + r.invoiced, 0))}</td>
                    <td style={{ ...styles.tdEven, ...styles.tdRight, fontWeight: 700 }}>{fmt(contractRows.reduce((s, r) => s + r.remaining, 0))}</td>
                    <td style={styles.tdEven} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Budget vs Actual */}
        {budgetRows.length > 0 && (
          <div style={styles.sectionWrap}>
            <SectionHeader>Budget vs Actual — Top Expense Categories</SectionHeader>
            <div style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: "none" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Category</th>
                    <th style={styles.thRight}>Budget</th>
                    <th style={styles.thRight}>Actual</th>
                    <th style={styles.thRight}>Variance</th>
                    <th style={styles.thRight}>Var %</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((row, i) => {
                    const isPos = row.variance >= 0;
                    return (
                      <tr key={row.category}>
                        <td style={i % 2 === 0 ? styles.tdEven : styles.tdOdd}>{row.category}</td>
                        <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight }}>{fmt(row.budget)}</td>
                        <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight }}>{fmt(row.actual)}</td>
                        <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight, ...(isPos ? styles.positive : styles.negative) }}>
                          {(isPos ? "+" : "") + fmt(row.variance)}
                        </td>
                        <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight, ...(isPos ? styles.positive : styles.negative) }}>
                          {(isPos ? "+" : "") + fmtPct(row.variancePct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Accounts Receivable */}
        <div style={styles.sectionWrap}>
          <SectionHeader>Accounts Receivable</SectionHeader>
          <div style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: "none" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Metric</th>
                  <th style={styles.thRight}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Total Outstanding", value: fmt(report.ar_outstanding), bold: true },
                  { label: `Open Invoices`, value: `${report.ar_invoice_count || 0}` },
                ].map((row, i) => (
                  <tr key={row.label}>
                    <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), fontWeight: row.bold ? 600 : undefined }}>{row.label}</td>
                    <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight, fontWeight: row.bold ? 600 : undefined }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* AR Aging Buckets */}
            <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>AR Aging</th>
                    <th style={styles.thRight}>Balance</th>
                    <th style={styles.thRight}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "0–30 Days", value: report.ar_0_30 || 0 },
                    { label: "31–60 Days", value: report.ar_31_60 || 0 },
                    { label: "61–90 Days", value: report.ar_61_90 || 0 },
                    { label: "90+ Days Overdue", value: report.ar_90_plus || 0 },
                  ].map((row, i) => {
                    const pct = report.ar_outstanding > 0 ? (row.value / report.ar_outstanding) * 100 : 0;
                    const isOverdue = i >= 2;
                    return (
                      <tr key={row.label}>
                        <td style={i % 2 === 0 ? styles.tdEven : styles.tdOdd}>{row.label}</td>
                        <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight, ...(isOverdue && row.value > 0 ? styles.negative : {}) }}>
                          {fmt(row.value)}
                        </td>
                        <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight, color: COLORS.muted }}>
                          {fmtPct(pct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Top Unpaid Invoices */}
            {topUnpaid.length > 0 && (
              <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Invoice</th>
                      <th style={styles.th}>Customer / Project</th>
                      <th style={styles.thRight}>Balance</th>
                      <th style={styles.thRight}>Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUnpaid.map((inv, i) => (
                      <tr key={inv.invoice_number || i}>
                        <td style={i % 2 === 0 ? styles.tdEven : styles.tdOdd}>{inv.invoice_number || "—"}</td>
                        <td style={i % 2 === 0 ? styles.tdEven : styles.tdOdd}>
                          {inv.customer}{inv.project ? ` · ${inv.project}` : ""}
                        </td>
                        <td style={{ ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd), ...styles.tdRight, fontWeight: 600 }}>
                          {fmt(inv.open_balance)}
                        </td>
                        <td style={{
                          ...(i % 2 === 0 ? styles.tdEven : styles.tdOdd),
                          ...styles.tdRight,
                          ...(inv.days_overdue > 60 ? styles.negative : inv.days_overdue > 30 ? { color: "#D97706", fontWeight: "bold" } : {}),
                        }}>
                          {inv.days_overdue > 0 ? `${inv.days_overdue}d` : "Current"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span>Brothers Building LLC — Confidential</span>
          <span>Generated {generatedAt}</span>
        </div>
      </div>
    </div>
  );
}