import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  const { userId, email, full_name, role, allowed_pages, phone, dob, address, hourly_wage } = await req.json();

  try {
    // If userId is provided, update existing user
    if (userId) {
      const updated = await base44.asServiceRole.entities.User.update(userId, { role, allowed_pages, phone, dob, address, hourly_wage });
      return Response.json({ success: true, updated });
    }
    
    // If email is provided without userId, create a new user profile (no invite)
    if (email) {
      const newUser = await base44.asServiceRole.entities.User.create({
        email,
        full_name,
        role,
        allowed_pages,
        phone,
        dob,
        address,
        hourly_wage,
      });
      return Response.json({ success: true, created: newUser });
    }
    
    return Response.json({ error: 'Either userId or email is required' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});