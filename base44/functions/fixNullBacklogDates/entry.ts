import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all contracts
    const contracts = await base44.entities.Contract.list();
    
    // Filter contracts with null or empty backlog_as_of_date
    const contractsToFix = contracts.filter(c => !c.backlog_as_of_date);

    // Update each one to 2026-01-01
    const updates = contractsToFix.map(c =>
      base44.entities.Contract.update(c.id, { backlog_as_of_date: "2026-01-01" })
    );

    await Promise.all(updates);

    return Response.json({
      success: true,
      message: `Updated ${contractsToFix.length} contracts with null backlog_as_of_date to 2026-01-01`,
      count: contractsToFix.length,
      contracts: contractsToFix.map(c => ({ id: c.id, project_name: c.project_name }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});