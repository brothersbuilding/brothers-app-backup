import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ptoRequestId } = await req.json();

    if (!ptoRequestId) {
      return Response.json({ error: 'Missing ptoRequestId' }, { status: 400 });
    }

    const ptoRequest = await base44.asServiceRole.entities.PTORequest.get(ptoRequestId);

    if (!ptoRequest) {
      return Response.json({ error: 'PTO request not found' }, { status: 404 });
    }

    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };

    const body = `
<p>Hello ${ptoRequest.supervisor_email},</p>

<p>${ptoRequest.employee_name} (${ptoRequest.employee_email}) has requested time off:</p>

<ul>
  <li><strong>Start Date:</strong> ${formatDate(ptoRequest.start_date)}</li>
  <li><strong>End Date:</strong> ${formatDate(ptoRequest.end_date)}</li>
  <li><strong>Hours per Day:</strong> ${ptoRequest.hours_per_day} hours</li>
  <li><strong>Total Hours:</strong> ${ptoRequest.total_hours} hours</li>
  ${ptoRequest.reason ? `<li><strong>Reason:</strong> ${ptoRequest.reason}</li>` : ''}
</ul>

<p>Please review and approve or reject this request in the system.</p>

<p>Best regards,<br>Brothers Building</p>
    `;

    await base44.integrations.Core.SendEmail({
      to: ptoRequest.supervisor_email,
      subject: `PTO Request from ${ptoRequest.employee_name}`,
      body,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});