import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const zapierUrl = Deno.env.get('CustomersToQBZap');
    if (!zapierUrl) {
      return Response.json({ error: 'QuickBooks sync not configured' }, { status: 500 });
    }

    // Trigger Zapier — Zapier will fetch all customers from QB
    // and POST each one back to syncQBCustomerToApp
    await fetch(zapierUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual_sync', timestamp: new Date().toISOString() })
    });

    return Response.json({ success: true, message: 'QuickBooks sync triggered' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});