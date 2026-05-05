import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CSV_URL = "https://media.base44.com/files/public/69eb9340275cd4b3cf9a27c2/9d5c02209_BrothersBuildingLLC_ProfitandLoss9.csv";

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

function parseNum(s) {
  if (!s || s === "") return 0;
  const cleaned = s.replace(/[$,\s]/g, "").replace(/\(/g, "-").replace(/\)/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

const YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch and parse CSV
  const res = await fetch(CSV_URL);
  const text = await res.text();
  const rows = parseCSV(text);

  // Build lookup: label -> row
  const dataMap = {};
  rows.forEach(row => {
    const label = row[""] || "";
    if (label) dataMap[label] = row;
  });

  const getAnnual = (key, y) => {
    const row = dataMap[key] || dataMap[key.replace("Total for ", "")];
    if (!row) return 0;
    return MONTHS.reduce((s, m) => s + parseNum((row)[`${m} ${y}`]), 0);
  };

  const snapshots = YEARS.map(y => {
    const revenue = getAnnual("Total for Income", y);
    const cogs = getAnnual("Total for Cost of Goods Sold", y);
    const grossProfit = getAnnual("Gross Profit", y);
    const operatingExpenses = getAnnual("Total for Expenses", y);
    const laborCost = getAnnual("Total for Payroll Expenses", y);
    const netProfit = getAnnual("Net Income", y);
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

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
      cash_in: revenue,
      cash_out: cogs + operatingExpenses,
    };
  });

  await base44.asServiceRole.entities.FinancialSnapshot.bulkCreate(snapshots);

  return Response.json({ success: true, created: snapshots.length, years: YEARS });
});