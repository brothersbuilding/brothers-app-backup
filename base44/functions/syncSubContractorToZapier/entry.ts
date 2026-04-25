import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    const webhookUrl = Deno.env.get('SubContractorsToQBZap');
    if (!webhookUrl) {
      return Response.json({ error: 'SubContractorsToQBZap webhook URL not configured' }, { status: 500 });
    }

    const payload = {
      event: event.type,
      entity_id: event.entity_id,
      company_name: data.company_name,
      company_phone: data.company_phone,
      company_email: data.company_email,
      mailing_address: data.mailing_address,
      contacts: data.contacts,
      w9_on_file: data.w9_on_file,
      msa_on_file: data.msa_on_file,
      coi_expiration_date: data.coi_expiration_date
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