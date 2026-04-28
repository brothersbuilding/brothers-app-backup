import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const realmId = url.searchParams.get('realmId');

  if (!code || !realmId) {
    return new Response('Missing code or realmId', { status: 400 });
  }

  const clientId = (Deno.env.get('QB_CLIENT_ID') || '').trim();
  const clientSecret = (Deno.env.get('QB_CLIENT_SECRET') || '').trim();

  if (!clientId || !clientSecret) {
    return new Response('Missing QB credentials', { status: 500 });
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const redirectUri = 'https://brothers-build-hub.base44.app/api/apps/69eb9340275cd4b3cf9a27c2/functions/qbOAuthCallback';

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('Token exchange failed:', err);
    return new Response(`Token exchange failed: ${err}`, { status: 500 });
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token } = tokens;

  console.log(`QB OAuth success — realmId: ${realmId}`);
  console.log(`access_token: ${access_token ? 'received' : 'MISSING'}`);
  console.log(`refresh_token: ${refresh_token ? 'received' : 'MISSING'}`);

  // Store tokens using base44 service role (no user auth needed — this is a redirect callback)
  const base44 = createClientFromRequest(req);

  // Persist tokens by storing them in AppSettings entity
  const settings = [
    { key: 'qb_access_token', value: access_token, label: 'QuickBooks Access Token' },
    { key: 'qb_refresh_token', value: refresh_token, label: 'QuickBooks Refresh Token' },
    { key: 'qb_realm_id', value: realmId, label: 'QuickBooks Realm ID' },
  ];

  for (const setting of settings) {
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key: setting.key });
    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { value: setting.value });
    } else {
      await base44.asServiceRole.entities.AppSettings.create(setting);
    }
  }

  console.log('QB tokens stored in AppSettings');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>QuickBooks Connected</title>
  <style>
    body {
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f9fafb;
    }
    .box {
      text-align: center;
      padding: 40px;
      border-radius: 12px;
      background: white;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .checkmark { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #16a34a; font-size: 24px; margin: 0 0 8px; }
    p { color: #6b7280; margin: 0; font-size: 15px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="checkmark">✅</div>
    <h1>QuickBooks connected successfully!</h1>
    <p>You can close this tab and return to the app.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
});