import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vendor } = await req.json();

    if (!vendor || !vendor.company_name) {
      return Response.json({ error: 'Invalid vendor data' }, { status: 400 });
    }

    const webhookUrl = Deno.env.get('QB_Vendor_Zapier_Webook_URL');
    if (!webhookUrl) {
      return Response.json({ error: 'Webhook URL not configured' }, { status: 500 });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendor)
    });

    if (!response.ok) {
      return Response.json({ error: 'Webhook delivery failed' }, { status: response.status });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});