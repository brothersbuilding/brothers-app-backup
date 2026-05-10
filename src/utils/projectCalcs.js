export function calcProject(project, billings, targetYear) {
  const today = new Date();
  const realYear = today.getFullYear();
  const currentYear = targetYear || realYear;

  const total_billed = billings
    .filter(b => b.project_id === project.id)
    .reduce((sum, b) => sum + (b.amount_billed || 0), 0);

  const remaining = (project.projected_total || 0) - total_billed;

  const completion_pct = project.projected_total > 0
    ? Math.min(100, (total_billed / project.projected_total) * 100)
    : 0;

  const endDate = project.end_date
    ? new Date(project.end_date)
    : new Date(currentYear, 11, 31);

  // Cursor starts at Jan 1 of selected year for past/future years, today for current year
  let cursorStart;
  if (currentYear === realYear) {
    cursorStart = new Date(today.getFullYear(), today.getMonth(), 1);
  } else {
    cursorStart = new Date(currentYear, 0, 1);
  }

  const remainingMonths = [];
  let cursor = new Date(cursorStart);
  while (cursor <= endDate) {
    remainingMonths.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      month_key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const monthlyProjected = remainingMonths.length > 0
    ? remaining / remainingMonths.length
    : 0;

  const billedThisYear = billings
    .filter(b => b.project_id === project.id && b.year === currentYear)
    .reduce((sum, b) => sum + (b.amount_billed || 0), 0);

  const remainingMonthsThisYear = remainingMonths.filter(m => m.year === currentYear);

  const projectedThisYear = billedThisYear + (monthlyProjected * remainingMonthsThisYear.length);

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