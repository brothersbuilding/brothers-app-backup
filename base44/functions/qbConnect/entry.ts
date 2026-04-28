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

  const clientId = Deno.env.get('QB_CLIENT_ID');
  if (!clientId) {
    return Response.json({ error: 'QB_CLIENT_ID secret not set' }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: 'https://brothers-build-hub.base44.app/api/apps/69eb9340275cd4b3cf9a27c2/functions/qbOAuthCallback',
    response_type: 'code',
    state: 'brothers-build',
  });

  const authUrl = `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;

  return Response.json({ auth_url: authUrl });
});