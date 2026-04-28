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

  // Build contract backlog with matched invoice calculations
  const contractBacklog = contracts.map((contract) => {
    const projectName = (contract.project_name || '').toLowerCase().trim();

    const matchingInvoices = invoices.filter(
      (inv) => (inv.project || '').toLowerCase().trim() === projectName
    );

    const total_invoiced = matchingInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
    const remaining_backlog = (contract.contract_value ?? 0) - total_invoiced;
    const percent_billed = contract.contract_value > 0
      ? (total_invoiced / contract.contract_value) * 100
      : 0;
    const invoice_count = matchingInvoices.length;

    return {
      ...contract,
      total_invoiced,
      remaining_backlog,
      percent_billed,
      invoice_count,
    };
  });

  // Aggregate totals
  const total_contract_value = contractBacklog.reduce((s, c) => s + (c.contract_value ?? 0), 0);
  const total_invoiced = contractBacklog.reduce((s, c) => s + c.total_invoiced, 0);
  const total_remaining_backlog = contractBacklog.reduce((s, c) => s + Math.max(0, c.remaining_backlog), 0);

  // YTD invoiced revenue from Invoice entity
  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const ytdInvoiced = invoices
    .filter((inv) => inv.status === 'paid' && inv.date_sent && inv.date_sent >= ytdStart)
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  const projected_year_end_revenue = ytdInvoiced + total_remaining_backlog;

  return Response.json({
    contracts: contractBacklog,
    summary: {
      total_contract_value,
      total_invoiced,
      total_remaining_backlog,
      projected_year_end_revenue,
    },
  });
});