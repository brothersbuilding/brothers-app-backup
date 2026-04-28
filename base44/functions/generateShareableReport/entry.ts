import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { format, addDays, parseISO, isWithinInterval, startOfYear } from 'npm:date-fns@3.6.0';

function generateToken() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
}

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try {
    return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end });
  } catch {
    return false;
  }
}

function filterByRange(records, dateField, range) {
  return records.filter(r => inRange(r[dateField], range));
}

function sumField(records, field) {
  return records.reduce((s, r) => s + (r[field] ?? 0), 0);
}

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
    const expires_in_days = body.expires_in_days ?? 7;
    const recipient_email = body.recipient_email ?? null;

    // Fetch all financial data in parallel
    const [invoices, expenses, payments, budgetLines, contracts, employees] = await Promise.all([
      base44.asServiceRole.entities.Invoice.list('-updated_date', 2000),
      base44.asServiceRole.entities.Expense.list('-date', 2000),
      base44.asServiceRole.entities.Payment.list('-date', 2000),
      base44.asServiceRole.entities.BudgetLine.filter({ year: 2026 }),
      base44.asServiceRole.entities.Contract.filter({ status: 'active' }),
      base44.asServiceRole.entities.Employee.list(),
    ]);

    const now = new Date();
    const ytdStart = startOfYear(now);
    const ytdRange = { start: ytdStart, end: now };

    // Calculate KPIs
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const ytdRevenue = sumField(filterByRange(paidInvoices, 'date_sent', ytdRange), 'amount');
    const ytdExpenses = filterByRange(expenses, 'date', ytdRange);
    const ytdCogs = sumField(ytdExpenses.filter(e => e.expense_type === 'cogs'), 'amount');
    const ytdLabor = sumField(ytdExpenses.filter(e => e.expense_type === 'labor'), 'amount');
    const ytdOpex = sumField(ytdExpenses.filter(e => ['operating', 'overhead'].includes(e.expense_type)), 'amount');

    const grossProfit = ytdRevenue - ytdCogs;
    const grossMargin = ytdRevenue > 0 ? (grossProfit / ytdRevenue) * 100 : 0;
    const totalExpenses = ytdCogs + ytdLabor + ytdOpex;
    const netProfit = ytdRevenue - totalExpenses;
    const netMargin = ytdRevenue > 0 ? (netProfit / ytdRevenue) * 100 : 0;

    // Contract backlog
    const contractValue = sumField(contracts, 'contract_value');
    const contractInvoiced = contracts.reduce((s, c) => s + (c.total_invoiced ?? 0), 0);
    const contractBacklog = sumField(contracts, 'remaining_backlog');

    // AR Outstanding
    const unpaidInvoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'partial');
    const totalOutstanding = unpaidInvoices.reduce((s, i) => s + (i.open_balance ?? i.amount ?? 0), 0);

    // Budget vs actual
    const categoryActuals = {};
    ytdExpenses.forEach(e => {
      const cat = e.category || 'Uncategorized';
      categoryActuals[cat] = (categoryActuals[cat] ?? 0) + (e.amount ?? 0);
    });

    // Generate token and dates
    const token = generateToken();
    const createdAt = format(now, 'yyyy-MM-dd');
    const expiresAt = format(addDays(now, expires_in_days), 'yyyy-MM-dd');

    // Build report data snapshot
    const reportData = {
      period: `${format(ytdStart, 'MMM d')} – ${format(now, 'MMM d, yyyy')}`,
      generated_at: new Date().toISOString(),
      kpi: {
        revenue: ytdRevenue,
        cogs: ytdCogs,
        grossProfit,
        grossMargin,
        labor: ytdLabor,
        opex: ytdOpex,
        netProfit,
        netMargin,
      },
      summary: {
        total_contract_value: contractValue,
        total_invoiced: contractInvoiced,
        total_remaining_backlog: contractBacklog,
        projected_year_end_revenue: contractBacklog + ytdRevenue,
        total_outstanding: totalOutstanding,
        unpaid_invoice_count: unpaidInvoices.length,
      },
      contracts: contracts.map(c => ({
        id: c.id,
        project_name: c.project_name,
        customer: c.customer,
        contract_value: c.contract_value,
        total_invoiced: c.total_invoiced ?? 0,
        remaining_backlog: c.remaining_backlog ?? 0,
        percent_billed: c.percent_billed ?? 0,
        status: c.status,
      })),
      budgetVsActual: {
        budgetLines: budgetLines.map(b => ({
          category: b.category,
          budget_amount: b.budget_amount,
          actual: categoryActuals[b.category] ?? 0,
        })),
      },
    };

    // Create SharedReport
    const sharedReport = await base44.asServiceRole.entities.SharedReport.create({
      token,
      created_at: createdAt,
      expires_at: expiresAt,
      created_by: user.email,
      report_data: JSON.stringify(reportData),
    });

    const shareUrl = `https://brothers-build-hub.base44.app/report/${token}`;

    return Response.json({
      success: true,
      token,
      share_url: shareUrl,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('[ERROR] generateShareableReport:', error.message);
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});