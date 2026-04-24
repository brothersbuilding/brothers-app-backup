import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { role = 'admin' } = body;

    const updated = await base44.asServiceRole.entities.User.update(user.id, { 
      role,
      allowed_pages: []
    });

    return Response.json({ success: true, message: `Role updated to ${role}`, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});