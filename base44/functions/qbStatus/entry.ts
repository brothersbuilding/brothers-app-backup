import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await base44.asServiceRole.entities.AppSettings.filter({ key: 'qb_refresh_token' });
  const connected = !!(results && results.length > 0 && results[0].value && results[0].value.trim() !== '');

  return Response.json({ connected });
});