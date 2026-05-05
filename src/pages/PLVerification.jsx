import React, { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, Save, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const CSV_URL = "https://media.base44.com/files/public/69eb9340275cd4b3cf9a27c2/9d5c02209_BrothersBuildingLLC_ProfitandLoss9.csv";

// ── CSV Parser ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split("\n");
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    if (!line.trim()) return null;
    const cols = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return row;
  }).filter(Boolean);
}

function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { result.push(cur.trim()); cur = ""; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function parseNum(s) {
  if (!s || s === "") return 0;
  const cleaned = s.replace(/[$,\s]/g, "").replace(/[()]/g, match => match === "(" ? "-" : "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

const fmt = (n) => {
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
};

// Key rows to extract from the CSV (label must match exactly)
const KEY_ROWS = [
  "Total for Income",
  "Total for Cost of Goods Sold",
  "Gross Profit",
  "Total for Expenses",
  "Net Operating Income",
  "Net Income",
];

const SECTION_ROWS = {
  "Income": [
    "Billable Expense Income",
    "Builder's Risk Insurance Billing",
    "CAT Tax billable",
    "Credit Card Rewards",
    "Equipment Income",
    "Total for Equipment Income",
    "General Liability Insurance Billing",
    "Interest Income",
    "Total for Labor",
    "Management Fees",
    "Mobilization Fees",
    "Overhead & Profit Markup",
    "Sales",
    "Warranty Fees",
    "Total for Income",
  ],
  "Cost of Goods Sold": [
    "Direct Costs",
    "Total for Direct Labor",
    "Total for Job Expenses",
    "Subcontractors Commercial",
    "Subcontractors Residential",
    "Total for Cost of Goods Sold",
  ],
  "Expenses": [
    "Advertising & Marketing",
    "Bank Fees",
    "Builder's Risk Insurance",
    "Business License/Fees",
    "CAT Tax",
    "Computers/Software",
    "Consumable Goods",
    "Contracted Services",
    "Total for Contracted Services",
    "General Liability Insurance",
    "Total for Guaranteed Payments",
    "Interest Paid",
    "Legal & Professional Services",
    "Total for Maintenance",
    "Meals",
    "Office Supplies",
    "Ownership Salaries",
    "Total for Ownership Salaries",
    "Total for Payroll Expenses",
    "PPE",
    "QuickBooks Payments Fees",
    "Tools",
    "Training",
    "Total for Vehicles",
    "Warranty Repairs",
    "Total for Expenses",
  ],
};

const YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];

const TOTAL_LABELS = new Set([
  "Total for Income",
  "Total for Cost of Goods Sold",
  "Gross Profit",
  "Total for Expenses",
  "Net Operating Income",
  "Net Income",
  "Total for Equipment Income",
  "Total for Labor",
  "Total for Direct Labor",
  "Total for Job Expenses",
  "Total for Contracted Services",
  "Total for Guaranteed Payments",
  "Total for Maintenance",
  "Total for Ownership Salaries",
  "Total for Payroll Expenses",
  "Total for Vehicles",
]);

export default function PLVerification() {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2024");
  const [view, setView] = useState("summary"); // "summary" | "detail"
  const [uploadStatus, setUploadStatus] = useState(null); // null | "success" | "error"
  const [uploadMessage, setUploadMessage] = useState("");
  const [availableYears, setAvailableYears] = useState([...YEARS]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "success" | "error"
  const fileInputRef = useRef(null);

  const loadCSV = async () => {
    setLoading(true);
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const parsed = parseCSV(text);
    setCsvData(parsed);
    setLoaded(true);
    setLoading(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const newData = parseCSV(text);
        // Detect years from header columns
        const headers = Object.keys(newData[0] || {});
        const yearSet = new Set();
        headers.forEach(h => {
          const m = h.match(/\d{4}/);
          if (m) yearSet.add(m[0]);
        });
        const newYears = [...yearSet].sort();

        // Merge with existing data: update rows by label
        setCsvData(prev => {
          if (!prev) return newData;
          const map = {};
          prev.forEach(row => { if (row[""]) map[row[""]] = { ...row }; });
          newData.forEach(row => {
            const label = row[""];
            if (!label) return;
            if (map[label]) {
              // Merge columns
              Object.keys(row).forEach(k => { if (row[k] !== "") map[label][k] = row[k]; });
            } else {
              map[label] = row;
            }
          });
          return Object.values(map);
        });

        setAvailableYears(prev => {
          const merged = new Set([...prev, ...newYears]);
          return [...merged].sort();
        });

        setUploadStatus("success");
        setUploadMessage(`Loaded ${file.name} — ${newYears.join(", ")} data merged successfully.`);
        setLoaded(true);
      } catch (err) {
        setUploadStatus("error");
        setUploadMessage(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Build month columns for a given year
  const monthCols = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map(m => `${m} ${selectedYear}`);
  }, [selectedYear]);

  // Build a lookup: label -> { [col]: value }
  const dataMap = useMemo(() => {
    if (!csvData) return {};
    const map = {};
    csvData.forEach(row => {
      const label = row[""] || "";
      if (!label) return;
      map[label] = row;
    });
    return map;
  }, [csvData]);

  // Get year total for a label (sum of all 12 months)
  const getYearTotal = (label) => {
    const row = dataMap[label];
    if (!row) return 0;
    return monthCols.reduce((s, col) => s + parseNum(row[col]), 0);
  };

  const getMonthVal = (label, col) => {
    const row = dataMap[label] || dataMap[label.replace("Total for ", "")];
    if (!row) return 0;
    return parseNum(row[col]);
  };

  // Resolve a key checking both "Total for X" and "X" variants
  const resolveKey = (key) => dataMap[key] ? key : key.replace("Total for ", "");

  // Summary: annual totals for all years
  const summaryData = useMemo(() => {
    if (!csvData) return [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const getAnnual = (key, y) => {
      const row = dataMap[key] || dataMap[key.replace("Total for ", "")];
      return months.reduce((s, m) => s + parseNum((row || {})[`${m} ${y}`]), 0);
    };

    // QB's "Net Operating Income" already has GP subtracted. Add it back to show NOI before GP.
    const summaryRows = [
      { label: "Total Revenue", key: "Total for Income", section: "income" },
      { label: "Total COGS", key: "Total for Cost of Goods Sold", section: "cogs" },
      { label: "Gross Profit", key: "Gross Profit", section: "gross", isTotal: true },
      { label: "Total Expenses", key: "Total for Expenses", section: "expenses" },
      { label: "Net Operating Income (Before Guaranteed Payments)", key: "_noi_before_gp", section: "net", isTotal: true },
      { label: "Guaranteed Payments", key: "Total for Guaranteed Payments", section: "gp", isGP: true },
      { label: "Net Operating Income (After GP)", key: "Net Operating Income", section: "net", isTotal: true },
      { label: "Other Income / Adjustments", key: "_other_income", section: "other", isOther: true },
      { label: "Net Income", key: "Net Income", section: "net", isTotal: true },
    ];
    return summaryRows.map(r => {
      const yearTotals = {};
      availableYears.forEach(y => {
        if (r.key === "_noi_before_gp") {
          // NOI from QB + GP (add back the GP that QB already subtracted)
          yearTotals[y] = getAnnual("Net Operating Income", y) + getAnnual("Total for Guaranteed Payments", y);
        } else if (r.key === "_other_income") {
          // Other Income = Net Income - Net Operating Income
          yearTotals[y] = getAnnual("Net Income", y) - getAnnual("Net Operating Income", y);
        } else {
          yearTotals[y] = getAnnual(r.key, y);
        }
      });
      return { ...r, yearTotals };
    });
  }, [csvData, dataMap, availableYears]);

  const saveToDashboard = async () => {
    if (!csvData) return;
    setSaving(true);
    setSaveStatus(null);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const getAnnual = (key, y) => {
      const row = dataMap[key] || dataMap[key.replace("Total for ", "")];
      return months.reduce((s, m) => s + parseNum((row || {})[`${m} ${y}`]), 0);
    };

    try {
      // Build one FinancialSnapshot per available year
      const snapshots = availableYears.map(y => {
        const revenue = getAnnual("Total for Income", y);
        const cogs = getAnnual("Total for Cost of Goods Sold", y);
        const grossProfit = getAnnual("Gross Profit", y);
        const operatingExpenses = getAnnual("Total for Expenses", y);
        const laborCost = getAnnual("Total for Payroll Expenses", y);
        const netProfit = getAnnual("Net Income", y);
        const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
        const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
        const guaranteedPayments = getAnnual("Total for Guaranteed Payments", y);
        const noiBeforeGP = getAnnual("Net Operating Income", y) + guaranteedPayments;

        return {
          period: `Full Year ${y}`,
          period_start: `${y}-01-01`,
          period_end: `${y}-12-31`,
          revenue,
          cogs,
          gross_profit: grossProfit,
          gross_margin: grossMargin,
          operating_expenses: operatingExpenses,
          labor_cost: laborCost,
          net_profit: netProfit,
          net_margin: netMargin,
          // Store extra P&L fields as JSON in a notes-style field isn't ideal,
          // so we store the key derived values:
          cash_in: revenue,
          cash_out: cogs + operatingExpenses,
        };
      });

      // Also build monthly snapshots
      const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlySnapshots = [];
      availableYears.forEach(y => {
        MONTH_NAMES.forEach((mon, mi) => {
          const col = `${mon} ${y}`;
          const revenue = parseNum((dataMap["Total for Income"] || {})[col]);
          const cogs = parseNum((dataMap["Total for Cost of Goods Sold"] || {})[col]);
          const grossProfit = parseNum((dataMap["Gross Profit"] || {})[col]);
          const operatingExpenses = parseNum((dataMap["Total for Expenses"] || {})[col]);
          const laborCost = parseNum((dataMap["Total for Payroll Expenses"] || {})[col]);
          const netProfit = parseNum((dataMap["Net Income"] || {})[col]);
          const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
          const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
          const paddedMonth = String(mi + 1).padStart(2, "0");
          const lastDay = new Date(parseInt(y), mi + 1, 0).getDate();
          monthlySnapshots.push({
            period: `${mon} ${y}`,
            period_start: `${y}-${paddedMonth}-01`,
            period_end: `${y}-${paddedMonth}-${lastDay}`,
            revenue, cogs, gross_profit: grossProfit, gross_margin: grossMargin,
            operating_expenses: operatingExpenses, labor_cost: laborCost,
            net_profit: netProfit, net_margin: netMargin,
            cash_in: revenue, cash_out: cogs + operatingExpenses,
          });
        });
      });

      // Upsert: delete existing full-year AND monthly snapshots for these years, then create fresh
      const existing = await base44.entities.FinancialSnapshot.list("-period_start", 500);
      const toDelete = existing.filter(s =>
        availableYears.some(y => s.period === `Full Year ${y}` || MONTH_NAMES.some((m, i) => s.period === `${m} ${y}`))
      );
      await Promise.all(toDelete.map(s => base44.entities.FinancialSnapshot.delete(s.id)));
      await base44.entities.FinancialSnapshot.bulkCreate([...snapshots, ...monthlySnapshots]);

      setSaveStatus("success");
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const C = {
    navy: "#1C2331",
    gold: "#C9A96E",
    bg: "#F7F6F3",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Link to="/financial-dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-wider uppercase font-barlow text-foreground">
              P&L Verification
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              QuickBooks Profit & Loss — Import Verification
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Upload new CSV */}
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload New P&L CSV
          </button>
          {loaded && (
            <button
              onClick={saveToDashboard}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-60"
              style={{ background: "#15803D" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save to Dashboard"}
            </button>
          )}
          {!loaded && (
            <button
              onClick={loadCSV}
              disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-medium text-white"
              style={{ background: C.navy }}
            >
              {loading ? "Loading…" : "Load Original P&L"}
            </button>
          )}
        </div>
      </div>

      {/* Upload status banner */}
      {uploadStatus && (
        <div className={`flex items-center gap-2 px-6 py-2.5 text-sm border-b ${uploadStatus === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {uploadStatus === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {uploadMessage}
        </div>
      )}

      {/* Save status banner */}
      {saveStatus && (
        <div className={`flex items-center gap-2 px-6 py-2.5 text-sm border-b ${saveStatus === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {saveStatus === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {saveStatus === "success"
            ? `✓ Saved ${availableYears.length} years of P&L data to the Financial Dashboard.`
            : "Failed to save data. Please try again."}
        </div>
      )}

      {!loaded && !loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Click "Load P&L Data" to fetch the QuickBooks CSV</p>
            <button
              onClick={loadCSV}
              className="px-6 py-3 rounded-md text-sm font-semibold text-white"
              style={{ background: C.navy }}
            >
              Load P&L Data
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Loading CSV…</p>
          </div>
        </div>
      )}

      {loaded && (
        <div className="px-6 py-6 space-y-6">

          {/* View Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("summary")}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${view === "summary" ? "text-white border-transparent" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
              style={view === "summary" ? { background: C.navy } : {}}
            >
              Annual Summary
            </button>
            <button
              onClick={() => setView("detail")}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${view === "detail" ? "text-white border-transparent" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
              style={view === "detail" ? { background: C.navy } : {}}
            >
              Monthly Detail
            </button>
          </div>

          {/* SUMMARY VIEW */}
          {view === "summary" && (
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b" style={{ background: C.navy }}>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Annual P&L Summary — 2019–2025</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: C.navy }}>
                      <th className="text-left px-4 py-2 text-white font-semibold text-xs uppercase tracking-wide w-48">Line Item</th>
                      {availableYears.map(y => (
                        <th key={y} className="text-right px-4 py-2 text-white font-semibold text-xs uppercase tracking-wide">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.map((row, i) => {
                      const isGross = row.key === "Gross Profit";
                      const isNetOp = row.key === "_noi_before_gp" || (row.key === "Net Operating Income" && !row.isGP);
                      const isNetIncome = row.key === "Net Income";
                      const isGP = row.isGP;
                      const isOther = row.isOther;
                      const isSeparator = isGross || row.key === "_noi_before_gp";
                      return (
                        <React.Fragment key={row.label}>
                          {isSeparator && <tr><td colSpan={availableYears.length + 1} style={{ height: 4, background: "#E2DDD6" }} /></tr>}
                          <tr style={{
                            background: isNetIncome ? C.navy : isNetOp ? "#2C3347" : isGP ? "#F7F2EA" : isOther ? "#EEF2FF" : isGross ? "#F0EDE7" : i % 2 === 0 ? "#fff" : "#F7F6F3",
                          }}>
                            <td className="px-4 py-2.5 text-sm"
                              style={{ color: (isNetIncome || isNetOp) ? "#FFF" : isGP ? "#92400E" : isOther ? "#3730A3" : "#1A1A1A", fontWeight: row.isTotal ? 700 : isGP ? 500 : 400, fontStyle: isGP ? "italic" : "normal" }}>
                              {isGP ? `  ↳ ${row.label}` : isOther ? `  + ${row.label}` : row.label}
                            </td>
                            {availableYears.map(y => {
                              const v = row.yearTotals[y];
                              const isNeg = v < 0;
                              return (
                                <td key={y} className="text-right px-4 py-2.5 font-mono text-xs"
                                  style={{
                                    color: isNetIncome ? (isNeg ? "#FCA5A5" : "#86EFAC") : isNetOp ? (isNeg ? "#FCA5A5" : "#86EFAC") : isGP ? "#92400E" : isOther ? (isNeg ? "#DC2626" : "#3730A3") : isNeg ? "#DC2626" : "#1A1A1A",
                                    fontWeight: row.isTotal ? 700 : isGP ? 500 : 400,
                                  }}>
                                  {fmt(v)}
                                </td>
                              );
                            })}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DETAIL VIEW */}
          {view === "detail" && (
            <div className="space-y-6">
              {/* Year Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Year:</span>
                {availableYears.map(y => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${selectedYear === y ? "text-white border-transparent" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
                    style={selectedYear === y ? { background: C.navy } : {}}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* Detail Sections */}
              {Object.entries(SECTION_ROWS).map(([section, rows]) => (
                <div key={section} className="bg-card border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b flex items-center gap-3" style={{ background: C.navy }}>
                    <div className="w-1 h-5 rounded" style={{ background: C.gold }} />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">{section}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: "#2C3347" }}>
                          <th className="text-left px-4 py-2 text-white text-xs font-semibold uppercase tracking-wide w-56">Line Item</th>
                          {monthCols.map(m => (
                            <th key={m} className="text-right px-3 py-2 text-white text-xs font-semibold whitespace-nowrap">{m.replace(` ${selectedYear}`, "")}</th>
                          ))}
                          <th className="text-right px-4 py-2 text-white text-xs font-semibold" style={{ borderLeft: `2px solid ${C.gold}` }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((label, i) => {
                          const isTotal = TOTAL_LABELS.has(label);
                          const yearTotal = getYearTotal(label);
                          return (
                            <tr key={label} style={{ background: isTotal ? "#F0EDE7" : i % 2 === 0 ? "#fff" : "#F7F6F3" }}>
                              <td className="px-4 py-2 text-xs truncate max-w-[220px]"
                                style={{ fontWeight: isTotal ? 700 : 400, color: "#1A1A1A" }}
                                title={label}>
                                {isTotal ? label.replace("Total for ", "Total ") : label}
                              </td>
                              {monthCols.map(col => {
                                const v = getMonthVal(label, col);
                                return (
                                  <td key={col} className="text-right px-3 py-2 font-mono text-xs"
                                    style={{ color: v < 0 ? "#DC2626" : v === 0 ? "#9CA3AF" : "#1A1A1A", fontWeight: isTotal ? 700 : 400 }}>
                                    {v === 0 ? "—" : fmt(v)}
                                  </td>
                                );
                              })}
                              <td className="text-right px-4 py-2 font-mono text-xs"
                                style={{
                                  borderLeft: `2px solid ${C.gold}`,
                                  fontWeight: 700,
                                  color: yearTotal < 0 ? "#DC2626" : "#1A1A1A",
                                  background: isTotal ? "#E8E3DB" : undefined,
                                }}>
                                {fmt(yearTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Net Income Summary for Year */}
              <div className="rounded-xl overflow-hidden shadow-sm border">
                <div className="px-5 py-3" style={{ background: C.navy }}>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Net Income — {selectedYear}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#2C3347" }}>
                        <th className="text-left px-4 py-2 text-white text-xs font-semibold uppercase tracking-wide w-56">Line Item</th>
                        {monthCols.map(m => (
                          <th key={m} className="text-right px-3 py-2 text-white text-xs font-semibold whitespace-nowrap">{m.replace(` ${selectedYear}`, "")}</th>
                        ))}
                        <th className="text-right px-4 py-2 text-white text-xs font-semibold" style={{ borderLeft: `2px solid ${C.gold}` }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                       { label: "Total Revenue", key: "Total for Income" },
                       { label: "Total COGS", key: "Total for Cost of Goods Sold" },
                       { label: "Gross Profit", key: "Gross Profit" },
                       { label: "Total Expenses", key: "Total for Expenses" },
                       { label: "Net Operating Income (Before Guaranteed Payments)", key: "_noi_before_gp" },
                       { label: "Guaranteed Payments", key: "Total for Guaranteed Payments", isGP: true },
                       { label: "Net Operating Income (After GP)", key: "Net Operating Income" },
                       { label: "Other Income / Adjustments", key: "_other_income", isOther: true },
                       { label: "Net Income", key: "Net Income" },
                       ].map((row, i) => {
                        const isNetIncome = row.key === "Net Income";
                        const isNetOp = row.key === "_noi_before_gp" || row.key === "Net Operating Income";
                        const isGP = row.isGP;
                        const isOther = row.isOther;
                        const getVal = (col) => {
                          if (row.key === "_noi_before_gp") return getMonthVal("Net Operating Income", col) + getMonthVal("Total for Guaranteed Payments", col);
                          if (row.key === "_other_income") return getMonthVal("Net Income", col) - getMonthVal("Net Operating Income", col);
                          return getMonthVal(row.key, col);
                        };
                        const yearTotal = row.key === "_noi_before_gp"
                          ? getYearTotal("Net Operating Income") + getYearTotal("Total for Guaranteed Payments")
                          : row.key === "_other_income"
                          ? getYearTotal("Net Income") - getYearTotal("Net Operating Income")
                          : getYearTotal(row.key);
                       return (
                         <tr key={row.label} style={{ background: isNetIncome ? C.navy : isNetOp ? "#2C3347" : isGP ? "#F7F2EA" : isOther ? "#EEF2FF" : i % 2 === 0 ? "#fff" : "#F7F6F3" }}>
                           <td className="px-4 py-2.5 text-xs"
                             style={{ color: (isNetIncome || isNetOp) ? "#FFF" : isGP ? "#92400E" : isOther ? "#3730A3" : "#1A1A1A", fontWeight: isGP ? 500 : 700, fontStyle: isGP ? "italic" : "normal" }}>
                             {isGP ? `  ↳ ${row.label}` : isOther ? `  + ${row.label}` : row.label}
                           </td>
                           {monthCols.map(col => {
                             const v = getVal(col);
                             return (
                               <td key={col} className="text-right px-3 py-2 font-mono text-xs font-bold"
                                 style={{ color: (isNetIncome || isNetOp) ? (v < 0 ? "#FCA5A5" : v === 0 ? "#6B7280" : "#86EFAC") : isGP ? "#92400E" : isOther ? (v < 0 ? "#DC2626" : v === 0 ? "#9CA3AF" : "#3730A3") : v < 0 ? "#DC2626" : v === 0 ? "#9CA3AF" : "#1A1A1A" }}>
                                 {v === 0 ? "—" : fmt(v)}
                               </td>
                             );
                           })}
                           <td className="text-right px-4 py-2.5 font-mono text-xs font-bold"
                             style={{
                               borderLeft: `2px solid ${C.gold}`,
                               color: (isNetIncome || isNetOp) ? (yearTotal < 0 ? "#FCA5A5" : "#86EFAC") : isGP ? "#92400E" : isOther ? (yearTotal < 0 ? "#DC2626" : "#3730A3") : yearTotal < 0 ? "#DC2626" : "#1A1A1A",
                               background: (isNetIncome || isNetOp) ? (isNetIncome ? C.navy : "#2C3347") : undefined,
                             }}>
                             {fmt(yearTotal)}
                           </td>
                         </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}