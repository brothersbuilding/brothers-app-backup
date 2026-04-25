import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    const webhookUrl = Deno.env.get('CustomersToQBZap');
    if (!webhookUrl) {
      return Response.json({ error: 'CustomersToQBZap webhook URL not configured' }, { status: 500 });
    }

    const payload = {
      event: event.type,
      entity_id: event.entity_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});