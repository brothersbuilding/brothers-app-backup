import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { format } from 'npm:date-fns@3.6.0';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

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
    const { recipient_email, share_url, pdf_base64, expires_at, kpi = {}, summary = {} } = body;

    if (!recipient_email || !share_url) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const expiryText = expires_at === 'null' || expires_at === null ? 'Never' : expires_at;
    const todayStr = format(new Date(), 'MMMM d, yyyy');
    const subject = `Brothers Building — Financial Report ${todayStr}`;

    console.log('[INFO] sendReportEmail function reached');
    console.log('[INFO] Recipient email:', recipient_email);
    console.log('[INFO] Subject:', subject);

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.6; background: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #1a3a2a 0%, #2d5a47 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 40px 20px; }
    .intro { font-size: 15px; color: #555; margin-bottom: 30px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0; }
    .kpi-card { background: #f8f9fa; border-left: 4px solid #207d48; padding: 15px; border-radius: 4px; }
    .kpi-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .kpi-value { font-size: 20px; font-weight: 700; color: #1a3a2a; margin-top: 6px; }
    .button-wrapper { text-align: center; margin: 35px 0; }
    .button { display: inline-block; background: #207d48; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; transition: background 0.2s; }
    .button:hover { background: #186038; }
    .expiry-note { background: #e8f5e9; border-left: 4px solid #207d48; padding: 12px 15px; margin: 25px 0; font-size: 13px; color: #2e7d32; border-radius: 4px; }
    .footer { border-top: 1px solid #e0e0e0; padding: 25px 20px; text-align: center; font-size: 12px; color: #7f8c8d; background: #fafbfc; }
    @media (max-width: 600px) {
      .header { padding: 30px 15px; }
      .header h1 { font-size: 24px; }
      .content { padding: 25px 15px; }
      .kpi-grid { grid-template-columns: 1fr; gap: 12px; }
      .kpi-card { padding: 12px; }
      .kpi-value { font-size: 18px; }
      .button { padding: 12px 30px; font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Brothers Building</h1>
      <p>Financial Report — ${todayStr}</p>
    </div>

    <div class="content">
      <p class="intro">Your financial snapshot is ready. View the full interactive dashboard below to explore detailed metrics, charts, and year-to-date performance.</p>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Revenue YTD</div>
          <div class="kpi-value">${fmt(kpi.revenue || 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Gross Profit</div>
          <div class="kpi-value">${fmt(kpi.grossProfit || 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Net Profit</div>
          <div class="kpi-value">${fmt(kpi.netProfit || 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">AR Outstanding</div>
          <div class="kpi-value">${fmt(summary.total_outstanding || 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Backlog</div>
          <div class="kpi-value">${fmt(summary.total_remaining_backlog || 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Budget Variance</div>
          <div class="kpi-value">${summary.budget_variance !== undefined ? fmt(summary.budget_variance) : '—'}</div>
        </div>
      </div>

      <div class="button-wrapper">
        <a href="${share_url}" class="button">View Full Report</a>
      </div>

      <div class="expiry-note">
        <strong>Link Expires:</strong> ${expiryText}
      </div>

      <div class="footer">
        <p>This report was generated by Brothers Building's financial management system. Reply to this email to contact the sender.</p>
        <p style="margin-top: 10px; opacity: 0.7;">&copy; ${new Date().getFullYear()} Brothers Building. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email via Base44 Core integration
    let emailResponse;
    try {
      console.log('[INFO] Calling base44.integrations.Core.SendEmail');
      emailResponse = await base44.integrations.Core.SendEmail({
        to: recipient_email,
        subject: subject,
        body: htmlBody,
        from_name: 'Brothers Building',
      });
      console.log('[INFO] SendEmail response:', JSON.stringify(emailResponse));
      console.log('[INFO] Report email sent successfully to:', recipient_email);
    } catch (emailError) {
      console.error('[ERROR] SendEmail call failed:', emailError.message);
      console.error('[ERROR] Full error object:', JSON.stringify(emailError));
      return Response.json({
        success: false,
        error: emailError.message,
        errorType: emailError.name,
        fullError: emailError,
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: `Report emailed to ${recipient_email}`,
      emailResponse: emailResponse,
    });
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