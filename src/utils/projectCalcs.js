export function calcProject(project, billings) {
  const today = new Date();
  const currentYear = today.getFullYear();

  // Total billed across all time
  const total_billed = billings
    .filter(b => b.project_id === project.id)
    .reduce((sum, b) => sum + (b.amount_billed || 0), 0);

  // Remaining revenue = projected total minus all billed
  const remaining = (project.projected_total || 0) - total_billed;

  // Completion percentage
  const completion_pct = project.projected_total > 0
    ? Math.min(100, (total_billed / project.projected_total) * 100)
    : 0;

  // Use end_date if available, otherwise end of current year
  const endDate = project.end_date
    ? new Date(project.end_date)
    : new Date(currentYear, 11, 31);

  // Build list of remaining months from today through end_date
  const remainingMonths = [];
  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor <= endDate) {
    remainingMonths.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      month_key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Divide remaining revenue equally across remaining months
  const monthlyProjected = remainingMonths.length > 0
    ? remaining / remainingMonths.length
    : 0;

  // Billed in current year
  const billedThisYear = billings
    .filter(b => b.project_id === project.id && b.year === currentYear)
    .reduce((sum, b) => sum + (b.amount_billed || 0), 0);

  const remainingMonthsThisYear = remainingMonths.filter(m => m.year === currentYear);

  // Current year revenue = billed this year + projected monthly × remaining months this year
  const projectedThisYear = billedThisYear + (monthlyProjected * remainingMonthsThisYear.length);

  // Carryover = projected revenue in future years beyond current year
  const carryoverRevenue = remainingMonths
    .filter(m => m.year > currentYear)
    .length * monthlyProjected;

  return {
    total_billed,
    remaining,
    completion_pct,
    remainingMonths,
    monthlyProjected,
    billedThisYear,
    projectedThisYear,
    carryoverRevenue,
  };
}