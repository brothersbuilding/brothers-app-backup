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

    console.log('[STEP 5] Reading request body');
    const body = await req.json();
    const expires_in_days = body.expires_in_days;
    console.log('[STEP 5] expires_in_days:', expires_in_days);

    console.log('[STEP 6] Generating token using crypto.randomUUID()');
    const token = crypto.randomUUID();
    console.log('[STEP 6] Token generated:', token);

    console.log('[STEP 7] Creating SharedReport record');
    const today = new Date().toISOString().split('T')[0];
    let finalExpiresAt = '2099-12-31'; // Default to never expires
    
    if (expires_in_days !== null && expires_in_days !== undefined && expires_in_days > 0) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + expires_in_days);
      finalExpiresAt = futureDate.toISOString().split('T')[0];
    }
    
    const sharedReport = await base44.asServiceRole.entities.SharedReport.create({
      token: token,
      report_data: '{}',
      created_at: today,
      expires_at: finalExpiresAt,
      created_by: 'system',
    });
    console.log('[STEP 7] SharedReport created successfully:', sharedReport.id);

    const shareUrl = `https://brothers-build-hub.base44.app/report/${token}`;
    console.log('[STEP 8] Returning success response');

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