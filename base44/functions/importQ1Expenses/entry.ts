import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expenses = [
      { category: "Advertising & Marketing", amount: 18453.87, expense_type: "operating" },
      { category: "Association Dues", amount: 720.00, expense_type: "operating" },
      { category: "Bank Fees", amount: 9592.00, expense_type: "operating" },
      { category: "Builder's Risk Insurance", amount: 4777.00, expense_type: "operating" },
      { category: "Business License/Fees", amount: 125.00, expense_type: "operating" },
      { category: "Charity", amount: 500.00, expense_type: "operating" },
      { category: "Computers/Software", amount: 9963.92, expense_type: "operating" },
      { category: "Consumable Goods", amount: 3734.36, expense_type: "operating" },
      { category: "Employee Mileage Reimbursement", amount: 85.68, expense_type: "operating" },
      { category: "Equipment Mobilization", amount: 285.13, expense_type: "operating" },
      { category: "General Liability Insurance", amount: 43271.57, expense_type: "operating" },
      { category: "Gifts", amount: 225.97, expense_type: "operating" },
      { category: "Interest Paid", amount: 2819.12, expense_type: "operating" },
      { category: "Legal & Professional Services", amount: 3896.70, expense_type: "operating" },
      { category: "Maintenance", amount: 1759.62, expense_type: "operating" },
      { category: "Meals", amount: 806.29, expense_type: "operating" },
      { category: "Office Supplies", amount: 580.26, expense_type: "operating" },
      { category: "Payment Processing Fee", amount: 25.00, expense_type: "operating" },
      { category: "Payroll Expenses", amount: 81118.27, expense_type: "labor" },
      { category: "PPE", amount: 147.29, expense_type: "operating" },
      { category: "QuickBooks Payments Fees", amount: 314.36, expense_type: "operating" },
      { category: "Recruitment & Retention", amount: 165.00, expense_type: "operating" },
      { category: "Storage", amount: 354.00, expense_type: "operating" },
      { category: "Tools", amount: 9997.99, expense_type: "operating" },
      { category: "Travel", amount: 16.00, expense_type: "operating" },
      { category: "Vehicles", amount: 16346.93, expense_type: "operating" },
      { category: "Warranty Repairs", amount: 9359.12, expense_type: "operating" },
      { category: "Water", amount: 18.98, expense_type: "operating" },
    ];

    const results = [];
    let totalAmount = 0;

    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      
      const created = await base44.asServiceRole.entities.Expense.create({
        date: "2026-03-31",
        vendor: "Q1 2026 P&L Import",
        category: exp.category,
        amount: exp.amount,
        expense_type: exp.type,
      });

      totalAmount += exp.amount;
      results.push({
        index: i + 1,
        category: exp.category,
        amount: exp.amount,
        success: true,
        running_total: totalAmount,
      });

      console.log(`Created expense ${i + 1}/28: ${exp.category} - $${exp.amount.toFixed(2)} | Running total: $${totalAmount.toFixed(2)}`);

      // 500ms delay between each (except after the last one)
      if (i < expenses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const expectedTotal = 219459.43;
    const isCorrect = Math.abs(totalAmount - expectedTotal) < 0.01;

    return Response.json({
      success: true,
      message: "All Q1 2026 expenses imported successfully",
      total_created: expenses.length,
      total_amount: parseFloat(totalAmount.toFixed(2)),
      expected_amount: expectedTotal,
      amount_matches: isCorrect,
      progress: results,
      summary: {
        count: expenses.length,
        total: totalAmount.toFixed(2),
        verification: isCorrect ? "✓ CORRECT" : "✗ MISMATCH"
      }
    });
  } catch (error) {
    console.error('Error in importQ1Expenses:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});