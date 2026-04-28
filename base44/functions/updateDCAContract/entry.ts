import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find contract with project_name "DCA"
    const contracts = await base44.entities.Contract.filter({ project_name: 'DCA' });
    if (contracts.length === 0) {
      return Response.json({ error: 'Contract with project_name "DCA" not found' }, { status: 404 });
    }

    const contract = contracts[0];

    // Update to "Lot 31"
    const updated = await base44.entities.Contract.update(contract.id, {
      project_name: 'Lot 31'
    });

    // Recalculate backlog
    const backlog = await base44.functions.invoke('getContractBacklog', {});

    return Response.json({
      success: true,
      updatedContract: updated,
      message: 'Contract updated from "DCA" to "Lot 31" and backlog recalculated'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});