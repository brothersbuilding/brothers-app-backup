import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { recipient_email } = body;

    if (!recipient_email) {
      return Response.json({ error: 'Missing recipient_email' }, { status: 400 });
    }

    console.log('[INFO] sendReportEmail function reached');
    console.log('[INFO] Recipient email:', recipient_email);
    console.log('[INFO] Base44 SDK version: 0.8.25');
    console.log('[INFO] Attempting simple text email test');

    const testBody = 'This is a test email from Brothers Building financial system.';
    const testSubject = 'Brothers Building - Test Email';

    console.log('[INFO] Calling base44.integrations.Core.SendEmail with minimal params');
    let emailResponse;
    
    try {
      emailResponse = await base44.integrations.Core.SendEmail({
        to: recipient_email,
        subject: testSubject,
        body: testBody,
      });

      console.log('[INFO] SendEmail succeeded');
      console.log('[INFO] Response type:', typeof emailResponse);
      console.log('[INFO] Response:', JSON.stringify(emailResponse));

      return Response.json({
        success: true,
        message: `Test email sent to ${recipient_email}`,
        methodUsed: 'base44.integrations.Core.SendEmail',
        response: emailResponse,
      });
    } catch (error) {
      console.error('[ERROR] SendEmail failed');
      console.error('[ERROR] Error name:', error.name);
      console.error('[ERROR] Error message:', error.message);
      console.error('[ERROR] Error code:', error.code);
      console.error('[ERROR] Full error:', JSON.stringify(error, null, 2));

      return Response.json({
        success: false,
        error: error.message,
        errorName: error.name,
        errorCode: error.code,
        fullError: error,
        methodTried: 'base44.integrations.Core.SendEmail',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[ERROR] sendReportEmail outer catch:', error.message);
    console.error('[ERROR] Full error:', JSON.stringify(error));
    return Response.json({
      success: false,
      error: error.message,
      errorType: error.name,
      fullError: error,
    }, { status: 500 });
  }
});