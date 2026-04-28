import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('[STEP 1] Function reached');
  
  try {
    console.log('[STEP 2] Verifying POST method');
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed', step: 2 }, { status: 405 });
    }

    console.log('[STEP 3] Creating base44 client');
    const base44 = createClientFromRequest(req);

    console.log('[STEP 4] Authenticating user');
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized', step: 4 }, { status: 401 });
    }

    console.log('[STEP 5] Generating token using crypto.randomUUID()');
    const token = crypto.randomUUID();
    console.log('[STEP 5] Token generated:', token);

    console.log('[STEP 6] Creating SharedReport record');
    const sharedReport = await base44.asServiceRole.entities.SharedReport.create({
      token: token,
      report_data: '{}',
      expires_at: null,
      created_by: 'system',
    });
    console.log('[STEP 6] SharedReport created successfully:', sharedReport.id);

    const shareUrl = `https://brothers-build-hub.base44.app/report/${token}`;
    console.log('[STEP 7] Returning success response');

    return Response.json({
      success: true,
      token: token,
      share_url: shareUrl,
    });
  } catch (error) {
    console.error('[ERROR] Function failed');
    console.error('[ERROR] Message:', error.message);
    console.error('[ERROR] Type:', error.name);
    console.error('[ERROR] Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      errorType: error.name,
      errorStack: error.stack,
    }, { status: 500 });
  }
});