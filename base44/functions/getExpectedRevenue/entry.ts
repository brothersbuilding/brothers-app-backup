import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch active contracts and all invoices in parallel
  const [contracts, invoices] = await Promise.all([
    base44.asServiceRole.entities.Contract.filter({ status: 'active' }),
    base44.asServiceRole.entities.Invoice.list('-created_date', 2000),
  ]);

  // Build contract expected revenue with matched invoice calculations
  const contractExpectedRevenue = contracts.map((contract) => {
    const projectName = (contract.project_name || '').toLowerCase().trim();
    const backlogAsOfDate = contract.backlog_as_of_date || '';

    // Match invoices: same project AND date_sent after backlog_as_of_date
    const matchingInvoices = invoices.filter(
      (inv) => 
        (inv.project || '').toLowerCase().trim() === projectName &&
        (backlogAsOfDate === '' || (inv.date_sent && inv.date_sent > backlogAsOfDate))
    );

    const total_invoiced = matchingInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
    const remaining_expected_revenue = (contract.contract_value ?? 0) - total_invoiced;
    const percent_billed = contract.contract_value > 0
      ? (total_invoiced / contract.contract_value) * 100
      : 0;
    const invoice_count = matchingInvoices.length;

    return {
      ...contract,
      total_invoiced,
      remaining_expected_revenue,
      percent_billed,
      invoice_count,
    };
  });

  // Aggregate totals
  const total_contract_value = contractExpectedRevenue.reduce((s, c) => s + (c.contract_value ?? 0), 0);
  const total_invoiced = contractExpectedRevenue.reduce((s, c) => s + c.total_invoiced, 0);
  const total_remaining_expected_revenue = contractExpectedRevenue.reduce((s, c) => s + Math.max(0, c.remaining_expected_revenue), 0);

  // YTD invoiced revenue from Invoice entity
  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const ytdInvoiced = invoices
    .filter((inv) => inv.status === 'paid' && inv.date_sent && inv.date_sent >= ytdStart)
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  const projected_year_end_revenue = ytdInvoiced + total_remaining_expected_revenue;

  return Response.json({
    contracts: contractExpectedRevenue,
    summary: {
      total_contract_value,
      total_invoiced,
      total_remaining_expected_revenue,
      projected_year_end_revenue,
    },
  });
});