import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all Expense records
    const expenses = await base44.asServiceRole.entities.Expense.list();
    
    // Fetch all BudgetLine records
    const budgetLines = await base44.asServiceRole.entities.BudgetLine.list();

    // Filter expenses for 2026
    const expenses2026 = expenses.filter(e => {
      if (!e.date) return false;
      const year = new Date(e.date).getFullYear();
      return year === 2026;
    });

    // Extract expense categories
    const expenseCategories = new Set(expenses.map(e => e.category).filter(Boolean));

    // Cross-reference: for each BudgetLine category, check if there's a matching Expense
    const categoryMatches = budgetLines.map(bl => {
      const blCategory = (bl.category || '').toLowerCase().trim();
      const hasMatch = Array.from(expenseCategories).some(ec => 
        (ec || '').toLowerCase().trim() === blCategory
      );
      return {
        budget_category: bl.category,
        budget_amount: bl.budget_amount,
        has_matching_expense: hasMatch,
      };
    });

    // Separate matched and unmatched
    const matched = categoryMatches.filter(m => m.has_matching_expense);
    const unmatched = categoryMatches.filter(m => !m.has_matching_expense);

    return Response.json({
      all_expenses: expenses.map(e => ({
        date: e.date,
        category: e.category,
        amount: e.amount,
        vendor: e.vendor,
      })),
      all_budget_lines: budgetLines.map(bl => ({
        category: bl.category,
        budget_amount: bl.budget_amount,
        year: bl.year,
      })),
      category_cross_reference: {
        matched_categories: matched,
        unmatched_categories: unmatched,
        total_budget_categories: budgetLines.length,
        matched_count: matched.length,
        unmatched_count: unmatched.length,
      },
      expenses_2026_count: expenses2026.length,
      total_expenses: expenses.length,
      summary: {
        all_expense_records: expenses.length,
        all_budget_line_records: budgetLines.length,
        expenses_in_2026: expenses2026.length,
        unique_expense_categories: Array.from(expenseCategories),
      },
    });
  } catch (error) {
    console.error('Error in diagnosticExpenseBudget:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});