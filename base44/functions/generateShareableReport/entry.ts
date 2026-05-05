import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getPeriodLabel(preset) {
  const now = new Date();
  const year = now.getFullYear();
  const thisMonth = MONTH_NAMES[now.getMonth()];
  const lastMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonth = MONTH_NAMES[lastMonthIdx];
  switch (preset) {
    case 'q1': return 'Q1 2026';
    case 'q2': return 'Q2 2026';
    case 'q3': return 'Q3 2026';
    case 'q4': return 'Q4 2026';
    case 'ytd': return 'Year to Date 2026';
    case 'this_month': return `${thisMonth} ${year}`;
    case 'last_month': return `${lastMonth} ${year}`;
    case 'year_to_last_month': return `January – ${lastMonth} 2026`;
    default: return 'Year to Date 2026';
  }
}

// Returns 4 prior period snapshot keys (oldest first) based on preset
function getPriorPeriodKeys(preset) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Quarter presets
  const quarterMatch = preset.match(/^q([1-4])$/);
  if (quarterMatch) {
    const currentQ = parseInt(quarterMatch[1]);
    const periods = [];
    let q = currentQ;
    let y = currentYear; // always 2026 for these presets
    for (let i = 0; i < 4; i++) {
      q--;
      if (q === 0) { q = 4; y--; }
      periods.unshift(`Q${q} ${y}`);
    }
    return periods;
  }

  // Month presets
  if (preset === 'this_month' || preset === 'last_month') {
    let monthIdx = now.getMonth(); // 0-based
    let year = currentYear;
    if (preset === 'last_month') {
      monthIdx--;
      if (monthIdx < 0) { monthIdx = 11; year--; }
    }
    const periods = [];
    for (let i = 0; i < 4; i++) {
      monthIdx--;
      if (monthIdx < 0) { monthIdx = 11; year--; }
      periods.unshift(`${MONTH_SHORT[monthIdx]} ${year}`);
    }
    return periods;
  }

  // Year / YTD presets — go back 4 years
  const baseYear = currentYear; // 2026
  return [
    String(baseYear - 4),
    String(baseYear - 3),
    String(baseYear - 2),
    String(baseYear - 1),
  ];
}

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

const CONTRACT_TYPE_LABELS = { res_gc: 'Residential GC', com_gc: 'Commercial GC', sub_cont: 'Sub Contract' };

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const expires_in_days = body.expires_in_days;
    const preset = body.preset || 'ytd';
    const periodLabel = body.period_label || getPeriodLabel(preset);

    const token = crypto.randomUUID();
    const today = new Date().toISOString().split('T')[0];

    // Compute the 4 prior period keys for trend lookup
    const priorPeriodKeys = getPriorPeriodKeys(preset);

    // Fetch all data in parallel — include FinancialSnapshot for trend periods
    const [invoices, expenses, contracts, budgetLines, allSnapshots] = await Promise.all([
      base44.asServiceRole.entities.Invoice.list('-updated_date', 2000),
      base44.asServiceRole.entities.Expense.list('-date', 2000),
      base44.asServiceRole.entities.Contract.list('-contract_value', 1000),
      base44.asServiceRole.entities.BudgetLine.filter({ year: 2026 }),
      base44.asServiceRole.entities.FinancialSnapshot.list('-period_start', 100),
    ]);

    // Build trend rows from snapshots
    const snapshotByPeriod = {};
    allSnapshots.forEach(s => {
      if (s.period) snapshotByPeriod[s.period] = s;
    });

    const trendPeriods = priorPeriodKeys.map(key => {
      const snap = snapshotByPeriod[key];
      if (!snap) return { label: key, revenue: null, gross_margin: null, net_margin: null, labor_pct: null };
      const rev = snap.revenue ?? 0;
      const labor = snap.labor_cost ?? 0;
      const laborPct = rev > 0 ? (labor / rev) * 100 : 0;
      return {
        label: key,
        revenue: rev,
        gross_margin: snap.gross_margin ?? null,
        net_margin: snap.net_margin ?? null,
        labor_pct: laborPct,
      };
    });

    // Revenue
    const paidInvoices = invoices.filter(inv => inv.status === 'paid' && inv.date_sent && inv.date_sent.startsWith('2026'));
    const revenueYTD = paidInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

    // AR aging
    const unpaidInvoices = invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'partial');
    const todayDate = new Date();
    const agingBuckets = { ar_0_30: 0, ar_31_60: 0, ar_61_90: 0, ar_90_plus: 0 };
    const unpaidWithDays = unpaidInvoices.map(inv => {
      const daysOverdue = inv.due_date ? Math.floor((todayDate - new Date(inv.due_date)) / (1000 * 60 * 60 * 24)) : 0;
      return { ...inv, daysOverdue };
    });
    unpaidWithDays.forEach(inv => {
      const balance = inv.open_balance ?? 0;
      if (inv.daysOverdue <= 30) agingBuckets.ar_0_30 += balance;
      else if (inv.daysOverdue <= 60) agingBuckets.ar_31_60 += balance;
      else if (inv.daysOverdue <= 90) agingBuckets.ar_61_90 += balance;
      else agingBuckets.ar_90_plus += balance;
    });
    const arOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (inv.open_balance ?? 0), 0);
    const topUnpaidInvoices = unpaidWithDays.sort((a, b) => (b.open_balance ?? 0) - (a.open_balance ?? 0)).slice(0, 5);

    // Expenses
    const exp2026 = expenses.filter(exp => exp.date && exp.date.startsWith('2026'));
    const expensesYTD = exp2026.reduce((sum, exp) => sum + (exp.amount ?? 0), 0);
    const cogsYTD = exp2026.filter(e => e.expense_type === 'cogs').reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const laborCostYTD = exp2026.filter(e => e.expense_type === 'labor').reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const operatingExpenses = expensesYTD - cogsYTD - laborCostYTD;

    // P&L
    const grossProfit = revenueYTD - cogsYTD;
    const grossMargin = revenueYTD > 0 ? (grossProfit / revenueYTD) * 100 : 0;
    const netProfit = grossProfit - operatingExpenses - laborCostYTD;
    const netMargin = revenueYTD > 0 ? (netProfit / revenueYTD) * 100 : 0;
    const laborPct = revenueYTD > 0 ? (laborCostYTD / revenueYTD) * 100 : 0;

    // Budget vs actual
    const expByCategory = {};
    exp2026.forEach(exp => {
      const cat = (exp.category || 'Unbudgeted').toLowerCase().trim();
      expByCategory[cat] = (expByCategory[cat] ?? 0) + (exp.amount ?? 0);
    });
    const budgetRows = budgetLines.map(b => {
      const cat = (b.category ?? '').toLowerCase().trim();
      const actual = expByCategory[cat] ?? 0;
      const variance = b.budget_amount - actual;
      const variancePct = b.budget_amount > 0 ? (variance / b.budget_amount) * 100 : 0;
      return { category: b.category, budget: b.budget_amount, actual, variance, variancePct };
    }).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).slice(0, 10);

    // Contracts / projected revenue
    const activeContracts = contracts.filter(c => c.status === 'active');
    const contractRows = activeContracts.map(c => {
      const invoicedAmt = invoices
        .filter(inv => inv.project === c.project_name && inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
      const remaining = (c.contract_value ?? 0) - invoicedAmt;
      const pctBilled = c.contract_value > 0 ? (invoicedAmt / c.contract_value) * 100 : 0;
      return {
        name: c.project_name,
        type: CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type || '—',
        value: c.contract_value ?? 0,
        invoiced: invoicedAmt,
        remaining,
        pctBilled,
        endDate: c.projected_end_date || c.estimated_completion || '',
      };
    }).sort((a, b) => b.value - a.value);
    const totalContractValue = contracts.reduce((sum, c) => sum + (c.contract_value ?? 0), 0);

    const reportData = {
      period: periodLabel,
      preset,
      revenue: revenueYTD,
      cogs: cogsYTD,
      gross_profit: grossProfit,
      gross_margin: grossMargin,
      labor: laborCostYTD,
      labor_pct: laborPct,
      opex: operatingExpenses,
      net_profit: netProfit,
      net_margin: netMargin,
      ar_outstanding: arOutstanding,
      ar_invoice_count: unpaidInvoices.length,
      ar_0_30: agingBuckets.ar_0_30,
      ar_31_60: agingBuckets.ar_31_60,
      ar_61_90: agingBuckets.ar_61_90,
      ar_90_plus: agingBuckets.ar_90_plus,
      top_unpaid_invoices: topUnpaidInvoices.map(inv => ({
        invoice_number: inv.invoice_number,
        customer: inv.customer,
        project: inv.project,
        open_balance: inv.open_balance,
        days_overdue: inv.daysOverdue,
      })),
      total_contract_value: totalContractValue,
      contract_rows: contractRows,
      budget_rows: budgetRows,
      trend_periods: trendPeriods,
      generated_at: new Date().toISOString(),
    };

    let finalExpiresAt = '2099-12-31';
    if (expires_in_days !== null && expires_in_days !== undefined && expires_in_days > 0) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + expires_in_days);
      finalExpiresAt = futureDate.toISOString().split('T')[0];
    }

    await base44.asServiceRole.entities.SharedReport.create({
      token,
      report_data: JSON.stringify(reportData),
      created_at: today,
      expires_at: finalExpiresAt,
      created_by: user.email || 'system',
    });

    const shareUrl = `https://brothers-build-hub.base44.app/report/${token}`;
    return Response.json({ success: true, token, share_url: shareUrl });
  } catch (error) {
    console.error('[ERROR]', error.message, error.stack);
    return Response.json({ success: false, error: error.message, errorType: error.name, errorStack: error.stack }, { status: 500 });
  }
});