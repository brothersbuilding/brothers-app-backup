import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const data = await req.json();

    const { name, email, phone, street_address, city, state, zip } = data;

    if (!name) {
      return Response.json({ error: 'Customer name is required' }, { status: 400 });
    }

    // Check if customer exists by name
    const existing = await base44.entities.Customer.filter({ name });

    if (existing.length > 0) {
      // Update existing customer
      await base44.entities.Customer.update(existing[0].id, {
        name,
        email: email || existing[0].email,
        phone: phone || existing[0].phone,
        street_address: street_address || existing[0].street_address,
        city: city || existing[0].city,
        state: state || existing[0].state,
        zip: zip || existing[0].zip,
      });
      return Response.json({ success: true, action: 'updated', id: existing[0].id });
    } else {
      // Create new customer
      const newCustomer = await base44.entities.Customer.create({
        name,
        email: email || '',
        phone: phone || '',
        street_address: street_address || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
      });
      return Response.json({ success: true, action: 'created', id: newCustomer.id });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});