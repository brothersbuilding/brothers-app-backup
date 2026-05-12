import React, { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList
} from "recharts";
import { X, Share2, LayoutDashboard, FolderKanban, FileText, TrendingUp } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const BG = "#1C2331";
const CARD = "#243040";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#CA9F50";
const GREEN = "#22c55e";
const RED = "#ef4444";

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseMonthlyAmounts(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}

function fmtD(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const s = abs >= 1000000
    ? "$" + (abs / 1000000).toFixed(2) + "M"
    : abs >= 1000
    ? "$" + Math.round(abs).toLocaleString("en-US")
    : "$" + abs.toFixed(2);
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

function autoColor(v) {
  if (v > 0) return GREEN;
  if (v < 0) return RED;
  return TEXT;
}

function monthToQuarter(k) {
  const m = parseInt(k.split("-")[1]);
  if (m <= 3) return "Q1"; if (m <= 6) return "Q2";
  if (m <= 9) return "Q3"; return "Q4";
}

// ── Shared dark card ─────────────────────────────────────────────────────────

function DarkCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
    >
      {children}
    </div>
  );
}

// ── TAB 1: Summary ───────────────────────────────────────────────────────────

function SummaryTab({ labelTotals, scopedMonthKeys, periodLabel }) {
  const lt = labelTotals;
  const revenue = lt["Total for Income"] ?? 0;
  const grossProfit = lt["Gross Profit"] ?? 0;
  const grossMarginPct = revenue !== 0 ? (grossProfit / revenue) * 100 : null;
  const netIncome = lt["Net Income"] ?? 0;
  const netMarginPct = revenue !== 0 ? (netIncome / revenue) * 100 : null;
  const laborRevenue = lt["Total for Labor"] ?? 0;
  const laborCost = lt["Total for Direct Labor"] ?? 0;
  const laborNet = laborRevenue - laborCost;
  const laborNetPct = laborRevenue !== 0 ? (laborNet / laborRevenue) * 100 : null;

  function KPI({ label, value, pct }) {
    const isNeg = value < 0;
    return (
      <div className="rounded-xl p-4 flex flex-col gap-1" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>{label}</p>
        <p className="text-xl font-bold font-barlow mt-1" style={{ color: isNeg ? RED : TEXT }}>{fmtD(value)}</p>
        {pct != null && (
          <p className="text-xs font-semibold" style={{ color: isNeg ? RED : GREEN }}>
            {(pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"}
          </p>
        )}
      </div>
    );
  }

  function Row({ label, value, bold, thick, autoC }) {
    const color = autoC ? autoColor(value) : TEXT;
    return (
      <div
        className={`flex justify-between items-center py-2.5 ${thick ? "mt-1" : ""}`}
        style={{ borderTop: thick ? `2px solid ${BORDER}` : bold ? `1px solid ${BORDER}` : undefined }}
      >
        <span className="text-sm" style={{ color: bold ? TEXT : MUTED }}>{label}</span>
        <span className="font-mono text-sm" style={{ color, fontWeight: bold ? 700 : 400 }}>
          {value == null ? "—" : fmtD(value)}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        <KPI label="Revenue" value={revenue} />
        <KPI label="Gross Margin" value={grossProfit} pct={grossMarginPct} />
        <KPI label="Net Margin" value={netIncome} pct={netMarginPct} />
        <KPI label="Labor Net" value={laborNet} pct={laborNetPct} />
      </div>

      {/* P&L Snapshot */}
      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>P&L Snapshot</p>
        {periodLabel && <p className="text-xs mb-3" style={{ color: MUTED }}>{periodLabel}</p>}
        <Row label="Revenue" value={lt["Total for Income"] ?? null} />
        <Row label="Cost of Goods" value={lt["Total for Cost of Goods Sold"] ?? null} />
        <Row label="Gross Profit" value={lt["Gross Profit"] ?? null} bold autoC />
        <Row label="Expenses" value={lt["Total for Expenses"] ?? null} />
        <Row label="Net Income" value={lt["Net Income"] ?? null} bold thick autoC />
      </DarkCard>

      {/* Labor P&L */}
      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>Labor P&L</p>
        {periodLabel && <p className="text-xs mb-3" style={{ color: MUTED }}>{periodLabel}</p>}
        <Row label="Labor Income" value={lt["Total for Labor"] ?? null} />
        <Row label="Labor Costs" value={lt["Total for Direct Labor"] ?? null} />
        <Row label="Net" value={scopedMonthKeys.length > 0 ? laborNet : null} bold thick autoC />
      </DarkCard>
    </div>
  );
}

// ── TAB 2: Projects ──────────────────────────────────────────────────────────

function ProjectsTab({ projects, billings }) {
  const activeProjects = useMemo(() =>
    projects.filter(p => p.status !== "cancelled"),
  [projects]);

  function calcProject(p) {
    const total_billed = billings
      .filter(b => b.project_id === p.id)
      .reduce((s, b) => s + (b.amount_billed || 0), 0);
    const remaining = (p.projected_total || 0) - total_billed;
    const pct = p.projected_total > 0 ? Math.min(100, (total_billed / p.projected_total) * 100) : 0;
    return { total_billed, remaining, pct };
  }

  const totals = useMemo(() => {
    return activeProjects.reduce((acc, p) => {
      const c = calcProject(p);
      return {
        projected: acc.projected + (p.projected_total || 0),
        billed: acc.billed + c.total_billed,
        remaining: acc.remaining + c.remaining,
      };
    }, { projected: 0, billed: 0, remaining: 0 });
  }, [activeProjects, billings]);

  function StatusBadge({ status }) {
    const styles = {
      active: { backgroundColor: "rgba(34,197,94,0.15)", color: GREEN },
      complete: { backgroundColor: "rgba(59,130,246,0.15)", color: "#3b82f6" },
      cancelled: { backgroundColor: "rgba(255,255,255,0.08)", color: MUTED },
    };
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
        style={styles[status] || styles.active}>
        {status}
      </span>
    );
  }

  function MetricCol({ label, value }) {
    return (
      <div className="flex flex-col gap-1 text-center">
        <p className="text-xs uppercase tracking-wide" style={{ color: GOLD }}>{label}</p>
        <p className="text-sm font-mono font-semibold" style={{ color: TEXT }}>{fmtShort(value)}</p>
      </div>
    );
  }

  if (activeProjects.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p style={{ color: MUTED }} className="text-sm italic">No projects found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeProjects.map(p => {
        const { total_billed, remaining, pct } = calcProject(p);
        const pctColor = pct >= 90 ? GREEN : pct >= 50 ? "#3b82f6" : GOLD;
        return (
          <DarkCard key={p.id}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="font-semibold text-sm leading-snug" style={{ color: TEXT }}>{p.project_name}</p>
              <StatusBadge status={p.status} />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <MetricCol label="Projected" value={p.projected_total} />
              <MetricCol label="Billed" value={total_billed} />
              <MetricCol label="Remaining" value={remaining} />
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: pctColor }} />
              </div>
              <span className="text-xs font-mono font-semibold" style={{ color: pctColor }}>
                {pct.toFixed(0)}%
              </span>
            </div>
          </DarkCard>
        );
      })}

      {/* Totals footer */}
      <DarkCard className="border-t-2" style={{ borderTopColor: GOLD }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: GOLD }}>Totals</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1 text-center">
            <p className="text-xs uppercase tracking-wide" style={{ color: GOLD }}>Projected</p>
            <p className="text-sm font-mono font-bold" style={{ color: TEXT }}>{fmtShort(totals.projected)}</p>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <p className="text-xs uppercase tracking-wide" style={{ color: GOLD }}>Billed</p>
            <p className="text-sm font-mono font-bold" style={{ color: TEXT }}>{fmtShort(totals.billed)}</p>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <p className="text-xs uppercase tracking-wide" style={{ color: GOLD }}>Remaining</p>
            <p className="text-sm font-mono font-bold" style={{ color: totals.remaining < 0 ? RED : GREEN }}>
              {fmtShort(totals.remaining)}
            </p>
          </div>
        </div>
      </DarkCard>
    </div>
  );
}

// ── TAB 3: P&L ───────────────────────────────────────────────────────────────

const SECTION_ORDER = ["Income", "Cost of Goods Sold", "Expenses", "Summary"];
const HIGHLIGHT_LABELS = new Set(["Gross Profit", "Net Income"]);

function PLTab({ allEntries, viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear }) {
  const [showByMonth, setShowByMonth] = useState(false);

  const allMonthKeys = useMemo(() => {
    const months = new Set();
    allEntries.forEach(e => {
      (e.month_keys || "").split(",").filter(Boolean).forEach(k => months.add(k));
    });
    return [...months].sort();
  }, [allEntries]);

  const monthKeys = useMemo(() => {
    if (viewMode === "month") return effectiveMonth ? [effectiveMonth] : [];
    if (viewMode === "quarter") {
      return allMonthKeys.filter(k => k.split("-")[0] === effectiveQuarterYear && monthToQuarter(k) === effectiveQuarter);
    }
    if (viewMode === "year") return allMonthKeys.filter(k => k.split("-")[0] === effectiveYear);
    return [];
  }, [viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear, allMonthKeys]);

  const isMultiMonth = monthKeys.length > 1;

  // Build tableRows with correct dedup and sort (mirrors PLViewSection logic)
  const tableRows = useMemo(() => {
    if (monthKeys.length === 0) return [];
    const rowMap = {};
    allEntries.forEach((e) => {
      const rowKey = e.row_key || `${e.label}__${e.sort_order}`;
      let amounts = {};
      try { amounts = JSON.parse(e.monthly_amounts || "{}"); } catch { amounts = {}; }
      const hasRelevantData = monthKeys.some(k => amounts[k] != null);
      const isAlwaysShow = e.row_type === "group_header" ||
                           e.row_type === "subtotal" ||
                           e.row_type === "total";
      if (!hasRelevantData && !isAlwaysShow) return;
      if (!rowMap[rowKey]) {
        rowMap[rowKey] = {
          label: e.label,
          section: e.section,
          row_type: e.row_type,
          indent_level: e.indent_level ?? 1,
          sort_order: e.sort_order ?? 0,
          byMonth: {},
        };
      } else {
        if ((e.sort_order ?? 0) < rowMap[rowKey].sort_order) {
          rowMap[rowKey].sort_order = e.sort_order ?? 0;
        }
      }
      monthKeys.forEach((k) => {
        const v = amounts[k];
        if (v != null) rowMap[rowKey].byMonth[k] = (rowMap[rowKey].byMonth[k] ?? 0) + v;
      });
    });
    return Object.values(rowMap).sort((a, b) => a.sort_order - b.sort_order);
  }, [allEntries, monthKeys]);

  const rowsBySection = useMemo(() => {
    const map = {};
    ["Income", "Cost of Goods Sold", "Expenses", "Summary"].forEach(s => { map[s] = []; });
    tableRows.forEach(r => {
      const sec = map[r.section] ? r.section : "Summary";
      map[sec].push(r);
    });
    return map;
  }, [tableRows]);

  const scopedMonthKeys = monthKeys;

  function fmtAmt(v) {
    if (v == null || v === 0) return "—";
    return fmtShort(v);
  }

  function PLRow({ row }) {
    const isGroupHeader = row.row_type === "group_header";
    const isSubtotal = row.row_type === "subtotal";
    const isTotal = row.row_type === "total";
    const isHighlight = HIGHLIGHT_LABELS.has(row.label);
    const indent = isGroupHeader || isTotal ? 0 : row.indent_level === 2 ? 24 : 12;

    if (isGroupHeader) {
      return (
        <div className="pt-4 pb-1 px-1">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>{row.label}</p>
          <div className="mt-1 h-px" style={{ backgroundColor: BORDER }} />
        </div>
      );
    }

    const borderStyle = isTotal || isHighlight
      ? { borderTop: `2px solid ${BORDER}`, marginTop: 4, paddingTop: 8 }
      : isSubtotal
      ? { borderTop: `1px solid ${BORDER}` }
      : {};

    const valueColor = isHighlight || isTotal ? autoColor(row.total) : TEXT;

    return (
      <div style={{ paddingLeft: indent, ...borderStyle }}>
        <div className="flex justify-between items-start py-1.5">
          <span
            className="text-sm leading-snug flex-1 pr-3"
            style={{
              color: isTotal || isHighlight ? GOLD : TEXT,
              fontWeight: isTotal || isHighlight || isSubtotal ? 700 : 400,
              fontSize: isTotal || isHighlight ? 15 : 13,
            }}
          >
            {row.label}
          </span>
          <span className="font-mono shrink-0" style={{ color: valueColor, fontWeight: isTotal || isHighlight ? 700 : 400, fontSize: isTotal || isHighlight ? 14 : 12 }}>
            {fmtAmt(row.total)}
          </span>
        </div>
        {isMultiMonth && showByMonth && Object.keys(row.byMonth).length > 0 && (
          <div className="ml-2 mb-1 space-y-0.5">
            {scopedMonthKeys.filter(k => row.byMonth[k] != null).map(k => (
              <div key={k} className="flex justify-between text-xs" style={{ color: MUTED }}>
                <span>{MONTH_NAMES[parseInt(k.split("-")[1])]} {k.split("-")[0]}</span>
                <span className="font-mono">{fmtAmt(row.byMonth[k])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (allEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p style={{ color: MUTED }} className="text-sm italic">No P&L data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle: Total vs By Month */}
      {isMultiMonth && (
        <div className="flex rounded-lg overflow-hidden border text-sm" style={{ borderColor: BORDER }}>
          {["Total", "By Month"].map(opt => (
            <button key={opt} onClick={() => setShowByMonth(opt === "By Month")}
              className="flex-1 px-3 py-1.5 font-medium transition-colors"
              style={{
                backgroundColor: (opt === "By Month") === showByMonth ? GOLD : "transparent",
                color: (opt === "By Month") === showByMonth ? "#1C2331" : MUTED,
              }}>
              {opt}
            </button>
          ))}
        </div>
      )}

      <DarkCard>
        {SECTION_ORDER.map(section => {
          const rows = rowsBySection[section];
          if (!rows || rows.length === 0) return null;
          return (
            <div key={section}>
              {rows.map((row, i) => <PLRow key={`${row.label}__${i}`} row={row} />)}
            </div>
          );
        })}
      </DarkCard>
    </div>
  );
}

// ── TAB 4: Trends ────────────────────────────────────────────────────────────

function TrendsTab({ trendData }) {
  function DarkLabel({ x, y, value, color, fmt }) {
    if (value == null) return null;
    return (
      <text x={x} y={y - 10} fill={color} fontSize={9} fontWeight={600} textAnchor="middle">
        {fmt(value)}
      </text>
    );
  }

  function TrendCard({ title, dataKey, color, yFmt, labelFmt }) {
    const hasData = trendData.some(d => d[dataKey] != null);
    const CustomLabel = (props) => <DarkLabel {...props} color={color} fmt={labelFmt} />;
    return (
      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: TEXT }}>{title}</p>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm italic" style={{ color: MUTED }}>No data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 24, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={yFmt} tick={{ fontSize: 9, fill: MUTED }} width={44} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 8 }}
                labelStyle={{ color: TEXT, fontSize: 11 }}
                itemStyle={{ color: color, fontSize: 11 }}
                formatter={(v) => v != null ? labelFmt(v) : "—"}
              />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
                dot={{ r: 3, fill: color }} connectNulls={false}>
                <LabelList dataKey={dataKey} content={<CustomLabel />} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </DarkCard>
    );
  }

  const fmtRev = v => v >= 1000000 ? "$" + (v / 1000000).toFixed(2) + "M" : v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v);
  const fmtPct = v => v.toFixed(1) + "%";

  return (
    <div className="space-y-4">
      <TrendCard title="Revenue Trend" dataKey="revenue" color="#3b82f6"
        yFmt={v => v >= 1000000 ? "$" + (v / 1000000).toFixed(1) + "M" : v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + v}
        labelFmt={fmtRev} />
      <TrendCard title="Gross Margin % Trend" dataKey="grossMarginPct" color={GREEN}
        yFmt={v => v.toFixed(0) + "%"} labelFmt={fmtPct} />
      <TrendCard title="Net Margin % Trend" dataKey="netMarginPct" color={GOLD}
        yFmt={v => v.toFixed(0) + "%"} labelFmt={fmtPct} />
    </div>
  );
}

// ── Main Viewer ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "summary", label: "Summary", Icon: LayoutDashboard },
  { id: "projects", label: "Projects", Icon: FolderKanban },
  { id: "pl", label: "P&L", Icon: FileText },
  { id: "trends", label: "Trends", Icon: TrendingUp },
];

export default function FinancialReportViewer({
  open, onClose,
  periodLabel,
  viewMode, effectiveMonth, effectiveQuarter, effectiveQuarterYear, effectiveYear,
  allEntries = [], projects = [], billings = [],
  labelTotals = {}, scopedMonthKeys = [], trendData = [],
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  // Share / copy summary
  function buildSummaryText() {
    const revenue = labelTotals["Total for Income"] ?? 0;
    const grossProfit = labelTotals["Gross Profit"] ?? 0;
    const netIncome = labelTotals["Net Income"] ?? 0;
    const grossPct = revenue !== 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "—";
    const netPct = revenue !== 0 ? ((netIncome / revenue) * 100).toFixed(1) : "—";
    return [
      `Brothers Building — ${periodLabel || "Financial Report"}`,
      `Revenue: ${fmtD(revenue)}`,
      `Gross Margin: ${fmtD(grossProfit)} (${grossPct}%)`,
      `Net Income: ${fmtD(netIncome)} (${netPct}%)`,
    ].join("\n");
  }

  async function handleShare() {
    const text = buildSummaryText();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Brothers Building — ${periodLabel}`, text });
      } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: BG }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 h-14"
        style={{ backgroundColor: "#0F1520", borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex flex-col">
          <p className="text-xs font-semibold" style={{ color: TEXT }}>Brothers Building</p>
          <p className="text-xs" style={{ color: GOLD }}>{periodLabel || "Financial Report"}</p>
        </div>
        <div className="flex items-center gap-2">
          {copied && <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: GOLD, color: "#1C2331" }}>Copied!</span>}
          <button onClick={handleShare}
            className="p-2 rounded-lg transition-colors"
            style={{ color: MUTED }}
            aria-label="Share">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: MUTED }}
            aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}>
        <div className="p-4">
          {activeTab === "summary" && (
            <SummaryTab labelTotals={labelTotals} scopedMonthKeys={scopedMonthKeys} periodLabel={periodLabel} />
          )}
          {activeTab === "projects" && (
            <ProjectsTab projects={projects} billings={billings} />
          )}
          {activeTab === "pl" && (
            <PLTab
              allEntries={allEntries}
              viewMode={viewMode}
              effectiveMonth={effectiveMonth}
              effectiveQuarter={effectiveQuarter}
              effectiveQuarterYear={effectiveQuarterYear}
              effectiveYear={effectiveYear}
            />
          )}
          {activeTab === "trends" && (
            <TrendsTab trendData={trendData} />
          )}
        </div>
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 flex z-10 h-[60px]"
        style={{ backgroundColor: "#0F1520", borderTop: `1px solid ${BORDER}` }}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{
                color: isActive ? GOLD : MUTED,
                borderTop: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
              }}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}