import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { event, data } = body;

  // Only handle create events
  if (event?.type !== 'create') {
    return Response.json({ skipped: true });
  }

  const userEmail = data?.email;
  if (!userEmail) {
    return Response.json({ skipped: true, reason: 'no email' });
  }

  // Look for a matching PendingUser record
  const pending = await base44.asServiceRole.entities.PendingUser.filter({ email: userEmail });
  if (!pending || pending.length === 0) {
    return Response.json({ skipped: true, reason: 'no pending user found' });
  }

  const pendingUser = pending[0];

  // Build update payload from pending data
  const updateData = {};
  if (pendingUser.full_name) updateData.full_name = pendingUser.full_name;
  if (pendingUser.role) updateData.role = pendingUser.role;
  if (pendingUser.allowed_pages) updateData.allowed_pages = pendingUser.allowed_pages;
  if (pendingUser.phone) updateData.phone = pendingUser.phone;
  if (pendingUser.dob) updateData.dob = pendingUser.dob;
  if (pendingUser.address) updateData.address = pendingUser.address;
  if (pendingUser.hourly_wage) updateData.hourly_wage = pendingUser.hourly_wage;

  // Apply to the new User record
  await base44.asServiceRole.entities.User.update(data.id, updateData);

  // Clean up the pending record
  await base44.asServiceRole.entities.PendingUser.delete(pendingUser.id);

  return Response.json({ success: true, applied: updateData });
});