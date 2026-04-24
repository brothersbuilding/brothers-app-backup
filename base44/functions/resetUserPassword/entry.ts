import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateTemporaryPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, userEmail, userName } = await req.json();

    if (!userId || !userEmail) {
      return Response.json({ error: 'Missing userId or userEmail' }, { status: 400 });
    }

    const tempPassword = generateTemporaryPassword();

    // Update user with temporary password (requires force password change on next login)
    await base44.asServiceRole.entities.User.update(userId, { 
      temporary_password: tempPassword 
    });

    // Send email with temporary password
    await base44.integrations.Core.SendEmail({
      to: userEmail,
      subject: 'Your Temporary Password - Brothers Building',
      body: `Hi ${userName || 'there'},\n\nYour temporary password is: ${tempPassword}\n\nPlease use this password to log in. You will be required to change your password on your first login.\n\nIf you did not request this, please contact your administrator.\n\nBest regards,\nBrothers Building`
    });

    return Response.json({ 
      success: true, 
      message: 'Temporary password sent to employee email' 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});