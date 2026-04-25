import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  const { userId, role, allowed_pages, phone, dob, address, hourly_wage, full_name } = await req.json();

  try {
    const updateData = { role, allowed_pages, phone, dob, address, hourly_wage };
    if (full_name) updateData.full_name = full_name;
    const updated = await base44.asServiceRole.entities.User.update(userId, updateData);
    return Response.json({ success: true, updated });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});