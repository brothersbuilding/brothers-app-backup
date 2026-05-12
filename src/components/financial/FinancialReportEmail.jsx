import React, { useState, useMemo } from "react";
import { X, Mail, Copy, CheckCircle } from "lucide-react";
import { calcProject } from "@/utils/projectCalcs";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseMonthlyAmounts(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}

function monthToQuarter(monthKey) {
  const m = parseInt(monthKey.split("-")[1]);
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

function getScopeKeys({ viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear, allMonthKeys }) {
  if (viewMode === "month") return effectiveMonth ? [effectiveMonth] : [];
  if (viewMode === "quarter") {
    return allMonthKeys.filter(k => {
      const y = k.split("-")[0];
      return y === effectiveQuarterYear && monthToQuarter(k) === effectiveQuarter;
    });
  }
  if (viewMode === "year") return allMonthKeys.filter(k => k.split("-")[0] === effectiveYear);
  return [];
}

function computeLabelTotals(allEntries, scopeKeys) {
  const totals = {};
  if (!scopeKeys.length) return totals;
  allEntries.forEach(e => {
    const amounts = parseMonthlyAmounts(e.monthly_amounts);
    scopeKeys.forEach(k => {
      const v = amounts[k];
      if (v != null) totals[e.label] = (totals[e.label] ?? 0) + v;
    });
  });
  return totals;
}

function computeTrendData({ viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear, allMonthKeys, allEntries }) {
  const periods = [];
  const qMonths = { 1: ["01","02","03"], 2: ["04","05","06"], 3: ["07","08","09"], 4: ["10","11","12"] };

  if (viewMode === "month" && effectiveMonth) {
    const [y, m] = effectiveMonth.split("-").map(Number);
    for (let i = 3; i >= 0; i--) {
      let pm = m - i, py = y;
      while (pm <= 0) { pm += 12; py--; }
      const key = `${py}-${String(pm).padStart(2, "0")}`;
      periods.push({ label: `${MONTH_NAMES[pm]} ${String(py).slice(2)}`, scopeKeys: [key] });
    }
  } else if (viewMode === "quarter" && effectiveQuarter && effectiveQuarterYear) {
    const qNum = parseInt(effectiveQuarter.replace("Q", ""));
    const yr = parseInt(effectiveQuarterYear);
    for (let i = 3; i >= 0; i--) {
      let pq = qNum - i, py = yr;
      while (pq <= 0) { pq += 4; py--; }
      const keys = qMonths[pq].map(m => `${py}-${m}`).filter(k => allMonthKeys.includes(k));
      periods.push({ label: `Q${pq} ${String(py).slice(2)}`, scopeKeys: keys });
    }
  } else if (viewMode === "year" && effectiveYear) {
    const yr = parseInt(effectiveYear);
    for (let i = 3; i >= 0; i--) {
      const py = yr - i;
      const keys = allMonthKeys.filter(k => k.startsWith(String(py)));
      periods.push({ label: String(py), scopeKeys: keys });
    }
  }

  return periods.map(({ label, scopeKeys }) => {
    if (!scopeKeys.length) return { label, revenue: null, grossMarginPct: null, netMarginPct: null };
    const totalsMap = {};
    allEntries.forEach(e => {
      const amounts = parseMonthlyAmounts(e.monthly_amounts);
      scopeKeys.forEach(k => {
        const v = amounts[k];
        if (v != null) totalsMap[e.label] = (totalsMap[e.label] ?? 0) + v;
      });
    });
    const revenue = totalsMap["Total for Income"] ?? null;
    const grossProfit = totalsMap["Gross Profit"] ?? null;
    const netIncome = totalsMap["Net Income"] ?? null;
    const grossMarginPct = revenue && revenue !== 0 ? (grossProfit / revenue) * 100 : null;
    const netMarginPct = revenue && revenue !== 0 ? (netIncome / revenue) * 100 : null;
    return { label, revenue, grossMarginPct, netMarginPct };
  });
}

function fmtDollar(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const s = abs >= 1000000
    ? "$" + (abs / 1000000).toFixed(2) + "M"
    : "$" + Math.round(abs).toLocaleString("en-US");
  return n < 0 ? "-" + s : s;
}

function fmtShort(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const s = abs >= 1000000
    ? "$" + (abs / 1000000).toFixed(2) + "M"
    : abs >= 1000
    ? "$" + Math.round(abs / 1000) + "k"
    : "$" + Math.round(abs);
  return n < 0 ? "-" + s : s;
}

function fmtPct(n) {
  if (n == null) return "—";
  return n.toFixed(1) + "%";
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m] = dateStr.split("-");
  return `${MONTH_NAMES[parseInt(m)]} ${y}`;
}

function trendArrow(data, key) {
  const vals = data.map(d => d[key]).filter(v => v != null);
  if (vals.length < 2) return "";
  const first = vals[0], last = vals[vals.length - 1];
  const diff = key === "revenue" ? ((last - first) / Math.abs(first)) * 100 : last - first;
  if (diff > 2) return '<span style="color:#16a34a;font-size:14px;">▲</span>';
  if (diff < -2) return '<span style="color:#dc2626;font-size:14px;">▼</span>';
  return '<span style="color:#6b7280;font-size:14px;">—</span>';
}

// ── HTML Generator ────────────────────────────────────────────────────────────

function generateEmailHTML({ periodLabel, lt, trendData, projects, billings }) {
  const NAVY = "#1C2331";
  const GOLD = "#CA9F50";
  const GRAY = "#6B7280";
  const LIGHT = "#F8F9FA";

  const revenue = lt["Total for Income"] ?? null;
  const grossProfit = lt["Gross Profit"] ?? null;
  const netIncome = lt["Net Income"] ?? null;
  const cogs = lt["Total for Cost of Goods Sold"] ?? null;
  const expenses = lt["Total for Expenses"] ?? null;
  const laborRevenue = lt["Total for Labor"] ?? null;
  const laborCost = lt["Total for Direct Labor"] ?? null;
  const laborNet = laborRevenue != null && laborCost != null ? laborRevenue - laborCost : null;

  const grossMarginPct = revenue && revenue !== 0 ? (grossProfit / revenue) * 100 : null;
  const netMarginPct = revenue && revenue !== 0 ? (netIncome / revenue) * 100 : null;
  const laborNetMarginPct = laborRevenue && laborRevenue !== 0 ? (laborNet / laborRevenue) * 100 : null;

  const today = new Date();
  const genDate = today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const currentYear = today.getFullYear();

  // KPI card helper
  function kpiCard(label, value, secondary) {
    return `
      <td style="width:50%;padding:6px;">
        <div style="background:#F8F9FA;border-left:3px solid ${GOLD};padding:16px;font-family:Arial,sans-serif;">
          <div style="color:${GRAY};font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${label}</div>
          <div style="color:${NAVY};font-size:24px;font-weight:bold;margin-bottom:4px;">${value}</div>
          ${secondary ? `<div style="color:${GRAY};font-size:12px;">${secondary}</div>` : ""}
        </div>
      </td>`;
  }

  // Trend table
  const trendHeaderCells = trendData.map((d, i) => {
    const isLast = i === trendData.length - 1;
    return `<th style="background:${NAVY};color:white;font-size:11px;padding:8px;text-align:center;font-weight:600;">${d.label}</th>`;
  }).join("");

  const revRow = trendData.map(d => `<td style="text-align:right;padding:8px;font-size:12px;font-weight:600;">${fmtShort(d.revenue)}</td>`).join("");
  const gmRow = trendData.map(d => `<td style="text-align:right;padding:8px;font-size:12px;">${fmtPct(d.grossMarginPct)}</td>`).join("");
  const nmRow = trendData.map(d => `<td style="text-align:right;padding:8px;font-size:12px;">${fmtPct(d.netMarginPct)}</td>`).join("");

  // P&L snapshot rows
  function plRow(label, value, opts = {}) {
    const color = opts.autoColor
      ? (value > 0 ? "#16a34a" : value < 0 ? "#dc2626" : NAVY)
      : NAVY;
    const size = opts.large ? "18px" : "13px";
    const weight = opts.bold ? "bold" : "normal";
    const padding = opts.thick ? "12px 8px" : "8px";
    const borderTop = opts.thick ? `2px solid ${NAVY}` : opts.divider ? `1px solid ${GOLD}` : "none";
    return `
      <tr>
        <td style="padding:${padding};font-size:${size};font-weight:${weight};border-top:${borderTop};color:${NAVY};">${label}</td>
        <td style="padding:${padding};font-size:${size};font-weight:${weight};border-top:${borderTop};text-align:right;color:${color};font-family:monospace;">${fmtDollar(value)}</td>
      </tr>`;
  }

  function dividerRow(thick) {
    return `<tr><td colspan="2" style="padding:0;"><div style="height:${thick ? 2 : 1}px;background:${thick ? NAVY : GOLD};margin:4px 0;"></div></td></tr>`;
  }

  // Projects table
  const activeProjects = (projects || [])
    .filter(p => p.status === "active")
    .sort((a, b) => (b.projected_total || 0) - (a.projected_total || 0));

  const showProjects = activeProjects.slice(0, 8);
  const extraCount = activeProjects.length - showProjects.length;

  const projectRows = showProjects.map((p, i) => {
    const calc = calcProject(p, billings || [], currentYear);
    const pct = p.projected_total > 0 ? Math.round((calc.total_billed / p.projected_total) * 100) : 0;
    const pctColor = pct > 100 ? "#dc2626" : pct >= 100 ? "#2563eb" : "#16a34a";
    const remColor = calc.remaining < 0 ? "#dc2626" : NAVY;
    const bg = i % 2 === 0 ? "white" : LIGHT;
    return `
      <tr style="background:${bg};">
        <td style="padding:8px;font-size:12px;color:${NAVY};">${p.project_name}</td>
        <td style="padding:8px;font-size:12px;color:${GRAY};text-align:center;">${fmtDate(p.end_date)}</td>
        <td style="padding:8px;font-size:12px;text-align:right;font-family:monospace;">${fmtDollar(p.projected_total)}</td>
        <td style="padding:8px;font-size:12px;text-align:right;font-family:monospace;">${fmtDollar(calc.total_billed)}</td>
        <td style="padding:8px;font-size:12px;text-align:right;font-family:monospace;color:${remColor};">${fmtDollar(calc.remaining)}</td>
        <td style="padding:8px;font-size:12px;text-align:center;font-weight:bold;color:${pctColor};">${pct}%</td>
      </tr>`;
  }).join("");

  const projTotals = showProjects.reduce((acc, p) => {
    const calc = calcProject(p, billings || [], currentYear);
    return {
      projected_total: acc.projected_total + (p.projected_total || 0),
      total_billed: acc.total_billed + calc.total_billed,
      remaining: acc.remaining + calc.remaining,
    };
  }, { projected_total: 0, total_billed: 0, remaining: 0 });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Brothers Building Financial Report</title></head>
<body style="margin:0;padding:0;background:#E5E7EB;font-family:Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#E5E7EB;padding:24px 0;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:white;">

  <!-- HEADER -->
  <tr>
    <td style="background:${NAVY};padding:32px 24px;text-align:center;">
      <div style="height:1px;background:${GOLD};margin-bottom:20px;"></div>
      <div style="color:white;font-size:22px;font-weight:bold;letter-spacing:3px;margin-bottom:4px;">BROTHERS BUILDING</div>
      <div style="color:#9CA3AF;font-size:14px;margin-bottom:20px;">Financial Report</div>
      <div style="height:1px;background:${GOLD};margin-bottom:16px;"></div>
      <div style="color:${GOLD};font-size:28px;font-weight:bold;margin-bottom:16px;">${periodLabel || "—"}</div>
      <div style="height:1px;background:${GOLD};margin-bottom:16px;"></div>
      <div style="color:#6B7280;font-size:11px;">Generated ${genDate}</div>
    </td>
  </tr>

  <!-- KPI CARDS -->
  <tr>
    <td style="background:white;padding:24px;">
      <div style="color:${NAVY};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">Key Metrics</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          ${kpiCard("Revenue", fmtDollar(revenue), null)}
          ${kpiCard("Gross Margin", fmtDollar(grossProfit), grossMarginPct != null ? `${grossMarginPct.toFixed(1)}% of revenue` : null)}
        </tr>
        <tr>
          ${kpiCard("Net Margin", fmtDollar(netIncome), netMarginPct != null ? `${netMarginPct.toFixed(1)}% of revenue` : null)}
          ${kpiCard("Labor Net Margin", fmtDollar(laborNet), laborNetMarginPct != null ? `${laborNetMarginPct.toFixed(1)}% of labor revenue` : null)}
        </tr>
      </table>
    </td>
  </tr>

  <!-- TREND SUMMARY -->
  <tr>
    <td style="background:${LIGHT};padding:24px;">
      <div style="color:${NAVY};font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">
        Trend Summary — Last 4 Periods
      </div>
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <thead>
          <tr>
            <th style="background:${NAVY};color:white;font-size:11px;padding:8px;text-align:left;font-weight:600;">Metric</th>
            ${trendHeaderCells}
            <th style="background:${NAVY};color:white;font-size:11px;padding:8px;text-align:center;font-weight:600;">Trend</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:white;">
            <td style="padding:8px;font-size:12px;font-weight:600;color:${NAVY};">Revenue</td>
            ${revRow}
            <td style="text-align:center;padding:8px;">${trendArrow(trendData, "revenue")}</td>
          </tr>
          <tr style="background:${LIGHT};">
            <td style="padding:8px;font-size:12px;color:${NAVY};">Gross Margin %</td>
            ${gmRow}
            <td style="text-align:center;padding:8px;">${trendArrow(trendData, "grossMarginPct")}</td>
          </tr>
          <tr style="background:white;">
            <td style="padding:8px;font-size:12px;color:${NAVY};">Net Margin %</td>
            ${nmRow}
            <td style="text-align:center;padding:8px;">${trendArrow(trendData, "netMarginPct")}</td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>

  <!-- P&L SNAPSHOT -->
  <tr>
    <td style="background:white;padding:24px;">
      <div style="color:${NAVY};font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Profit &amp; Loss Snapshot</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${plRow("Revenue", revenue)}
        ${plRow("Cost of Goods", cogs)}
        ${dividerRow(false)}
        ${plRow("Gross Profit", grossProfit, { bold: true, autoColor: true })}
        ${plRow("Expenses", expenses)}
        ${dividerRow(true)}
        ${plRow("Net Income", netIncome, { bold: true, large: true, thick: true, autoColor: true })}
      </table>
    </td>
  </tr>

  <!-- LABOR P&L SNAPSHOT -->
  <tr>
    <td style="background:${LIGHT};padding:24px;">
      <div style="color:${NAVY};font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Labor P&amp;L Snapshot</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${plRow("Labor Income", laborRevenue)}
        ${plRow("Labor Costs", laborCost)}
        ${dividerRow(true)}
        ${plRow("Net", laborNet, { bold: true, large: true, thick: true, autoColor: true })}
        <tr>
          <td style="padding:8px;font-size:13px;color:${GRAY};">Labor Net Margin</td>
          <td style="padding:8px;font-size:13px;text-align:right;font-weight:bold;color:${laborNet > 0 ? "#16a34a" : "#dc2626"};">${fmtPct(laborNetMarginPct)}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- PROJECTED REVENUE -->
  <tr>
    <td style="background:white;padding:24px;">
      <div style="color:${NAVY};font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Projected Revenue — Active Projects</div>
      ${activeProjects.length === 0 ? `<p style="color:${GRAY};font-size:13px;">No active projects.</p>` : `
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <thead>
          <tr style="background:${NAVY};">
            <th style="color:white;font-size:11px;padding:8px;text-align:left;font-weight:600;text-transform:uppercase;">Project</th>
            <th style="color:white;font-size:11px;padding:8px;text-align:center;font-weight:600;text-transform:uppercase;">End</th>
            <th style="color:white;font-size:11px;padding:8px;text-align:right;font-weight:600;text-transform:uppercase;">Projected</th>
            <th style="color:white;font-size:11px;padding:8px;text-align:right;font-weight:600;text-transform:uppercase;">Billed</th>
            <th style="color:white;font-size:11px;padding:8px;text-align:right;font-weight:600;text-transform:uppercase;">Remaining</th>
            <th style="color:white;font-size:11px;padding:8px;text-align:center;font-weight:600;text-transform:uppercase;">%</th>
          </tr>
        </thead>
        <tbody>
          ${projectRows}
        </tbody>
        <tfoot>
          <tr style="background:${NAVY};">
            <td colspan="2" style="padding:8px;color:white;font-size:12px;font-weight:bold;">Totals</td>
            <td style="padding:8px;color:white;font-size:12px;font-weight:bold;text-align:right;font-family:monospace;">${fmtDollar(projTotals.projected_total)}</td>
            <td style="padding:8px;color:white;font-size:12px;font-weight:bold;text-align:right;font-family:monospace;">${fmtDollar(projTotals.total_billed)}</td>
            <td style="padding:8px;color:white;font-size:12px;font-weight:bold;text-align:right;font-family:monospace;">${fmtDollar(projTotals.remaining)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      ${extraCount > 0 ? `<p style="color:${GRAY};font-size:12px;margin-top:8px;text-align:right;">...and ${extraCount} more project${extraCount > 1 ? "s" : ""}</p>` : ""}
      `}
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:${NAVY};padding:24px;text-align:center;">
      <div style="color:white;font-size:16px;font-weight:bold;margin-bottom:8px;">Brothers Building</div>
      <div style="color:#9CA3AF;font-size:11px;margin-bottom:8px;">This report was generated automatically</div>
      <div style="color:${GOLD};font-size:13px;font-weight:bold;margin-bottom:8px;">${periodLabel || ""}</div>
      <div style="color:#6B7280;font-size:10px;">${genDate}</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Modal Component ───────────────────────────────────────────────────────────

export default function FinancialReportEmail({
  open,
  onClose,
  periodLabel,
  allEntries = [],
  projects = [],
  billings = [],
  viewMode,
  effectiveMonth,
  effectiveQuarter,
  effectiveQuarterYear,
  effectiveYear,
}) {
  const [toField, setToField] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const allMonthKeys = useMemo(() => {
    const months = new Set();
    allEntries.forEach(e => {
      (e.month_keys || e.month_key || "").split(",").filter(Boolean).forEach(k => months.add(k));
    });
    return [...months].sort();
  }, [allEntries]);

  const scopeKeys = useMemo(() =>
    getScopeKeys({ viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear, allMonthKeys }),
    [viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear, allMonthKeys]
  );

  const lt = useMemo(() => computeLabelTotals(allEntries, scopeKeys), [allEntries, scopeKeys]);

  const trendData = useMemo(() =>
    computeTrendData({ viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear, allMonthKeys, allEntries }),
    [viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear, allMonthKeys, allEntries]
  );

  const htmlContent = useMemo(() =>
    generateEmailHTML({ periodLabel, lt, trendData, projects, billings }),
    [periodLabel, lt, trendData, projects, billings]
  );

  const subject = `Brothers Building Financial Report — ${periodLabel}`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSend = async () => {
    await navigator.clipboard.writeText(htmlContent);
    const to = encodeURIComponent(toField.trim());
    const sub = encodeURIComponent(subject);
    window.location.href = `mailto:${to}?subject=${sub}`;
    setSent(true);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Email Report</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
            <input
              type="text"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="email@example.com, another@example.com"
              value={toField}
              onChange={e => setToField(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</label>
            <div className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted/30 text-muted-foreground select-all">
              {subject}
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">About email size limits:</strong> When you click Send, the HTML report is automatically copied to your clipboard and your email client opens with the subject pre-filled. Paste the HTML into the email body.
          </div>

          {sent && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-xs text-green-800 leading-relaxed">
              <strong>Your email client has been opened</strong> with the subject pre-filled. Due to email size limits, please paste the report HTML from your clipboard into the email body. The HTML has been automatically copied.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-border bg-background hover:bg-muted transition-colors flex-1 justify-center"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy HTML"}
          </button>
          <button
            onClick={handleSend}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-1 justify-center"
          >
            <Mail className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}