import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function monthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();
  return Math.max(1, Math.ceil(months + 1));
}

function getMonthsRemainingThisYear() {
  const now = new Date();
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const months = (yearEnd.getFullYear() - now.getFullYear()) * 12 + (yearEnd.getMonth() - now.getMonth());
  return Math.max(0, months + 1);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contracts = await base44.asServiceRole.entities.Contract.list();
    const invoices = await base44.asServiceRole.entities.Invoice.list();

    const now = new Date();
    const yearEndDate = new Date(now.getFullYear(), 11, 31);
    const monthsRemainingThisYear = getMonthsRemainingThisYear();

    const backlog = contracts
      .filter(c => c.status === 'active')
      .map(contract => {
        const backlogDate = new Date(contract.backlog_as_of_date);
        const manualIds = contract.manual_invoice_ids ?? [];
        const excludedIds = contract.excluded_invoice_ids ?? [];
        
        const totalInvoiced = invoices
          .filter(inv => {
            // Exclude if in excluded_invoice_ids
            if (excludedIds.includes(inv.id)) return false;
            
            // Include if manually linked (regardless of payment status)
            if (manualIds.includes(inv.id)) return true;
            
            // Include if auto-matched by project name (case-insensitive, partial) and date (regardless of payment status)
            if (!inv.date_sent) return false;
            const invDate = new Date(inv.date_sent);
            if (invDate < backlogDate) return false;
            
            const invProject = (inv.project || "").toLowerCase().trim();
            const contractProject = (contract.project_name || "").toLowerCase().trim();
            return invProject.includes(contractProject) || contractProject.includes(invProject);
          })
          .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

        const billingValue = contract.adjusted_value ?? contract.contract_value ?? 0;
        const remainingValue = Math.max(0, billingValue - totalInvoiced);

        let monthlyRunRate = 0;
        let projectedRevenueThisYear = 0;
        let projectedRevenueNextYear = 0;

        if (contract.projected_end_date) {
          const monthsUntilCompletion = monthsBetween(new Date(), new Date(contract.projected_end_date));
          monthlyRunRate = remainingValue > 0 ? remainingValue / monthsUntilCompletion : 0;

          const endDate = new Date(contract.projected_end_date);
          const monthsUntilYearEnd = endDate <= yearEndDate
            ? monthsBetween(new Date(), endDate)
            : monthsRemainingThisYear;

          projectedRevenueThisYear = Math.min(remainingValue, monthlyRunRate * monthsUntilYearEnd);
          projectedRevenueNextYear = Math.max(0, remainingValue - projectedRevenueThisYear);
        } else if (contract.backlog_as_of_date) {
          // If no projected_end_date, estimate based on backlog date + 12 months
          const estimatedEnd = new Date(contract.backlog_as_of_date);
          estimatedEnd.setFullYear(estimatedEnd.getFullYear() + 1);
          const months = monthsBetween(new Date(contract.backlog_as_of_date), estimatedEnd);
          monthlyRunRate = remainingValue > 0 ? remainingValue / months : 0;
          projectedRevenueThisYear = Math.min(remainingValue, monthlyRunRate * monthsRemainingThisYear);
          projectedRevenueNextYear = Math.max(0, remainingValue - projectedRevenueThisYear);
        }

        return {
          id: contract.id,
          project_name: contract.project_name,
          customer: contract.customer,
          contract_type: contract.contract_type,
          contract_value: contract.contract_value,
          adjusted_value: contract.adjusted_value,
          backlog_as_of_date: contract.backlog_as_of_date,
          projected_end_date: contract.projected_end_date,
          forecast_status: contract.forecast_status,
          manual_invoice_ids: contract.manual_invoice_ids,
          excluded_invoice_ids: contract.excluded_invoice_ids,
          total_invoiced: totalInvoiced,
          remaining_value: remainingValue,
          monthly_run_rate: monthlyRunRate,
          projected_revenue_this_year: projectedRevenueThisYear,
          projected_revenue_next_year: projectedRevenueNextYear,
        };
      });

    const summary = {
      total_contract_value: backlog.reduce((s, c) => s + c.contract_value, 0),
      total_adjusted_value: backlog.reduce((s, c) => s + (c.adjusted_value ?? c.contract_value), 0),
      total_invoiced: backlog.reduce((s, c) => s + c.total_invoiced, 0),
      projected_this_year: backlog.reduce((s, c) => s + c.projected_revenue_this_year, 0),
      projected_next_year: backlog.reduce((s, c) => s + c.projected_revenue_next_year, 0),
    };

    return Response.json({
      contracts: backlog,
      summary,
    });
  } catch (error) {
    console.error('Error in getContractBacklog:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});