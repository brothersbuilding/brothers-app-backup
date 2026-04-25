import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all customers from the app
    const appCustomers = await base44.entities.Customer.list();

    // Trigger the Zapier webhook to sync QB customers with app customers
    const zapierUrl = Deno.env.get('CustomersToQBZap');
    if (!zapierUrl) {
      return Response.json({ error: 'QuickBooks sync not configured' }, { status: 500 });
    }

    const syncResponse = await fetch(zapierUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        trigger: 'manual_sync',
        action: 'sync_customers',
        appCustomers: appCustomers,
        timestamp: new Date().toISOString()
      })
    });

    const syncData = await syncResponse.json();

    // If Zapier returned missing customers from QB, create them in the app
    if (syncData.missingCustomers && Array.isArray(syncData.missingCustomers)) {
      for (const customer of syncData.missingCustomers) {
        await base44.entities.Customer.create({
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
          street_address: customer.street_address || '',
          city: customer.city || '',
          state: customer.state || '',
          zip: customer.zip || ''
        });
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Sync completed',
      customersAdded: syncData.missingCustomers?.length || 0,
      customersCreatedInQB: syncData.createdInQB?.length || 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});