import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { format, addDays, parseISO, isWithinInterval, startOfYear } from 'npm:date-fns@3.6.0';

function generateToken() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
}

function inRange(dateStr, range) {
  if (!dateStr) return false;
  try {
    return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end });
  } catch {
    return false;
  }
}

function filterByRange(records, dateField, range) {
  return records.filter(r => inRange(r[dateField], range));
}

function sumField(records, field) {
  return records.reduce((s, r) => s + (r[field] ?? 0), 0);
}

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

    // TEST: Return simple response first to confirm function responds
    return Response.json({
      success: true,
      token: 'test123',
      share_url: 'https://brothers-build-hub.base44.app/report/test123',
      message: 'Test response - function is responding',
    });

    // FULL LOGIC WILL BE ADDED BACK AFTER TEST CONFIRMS
  } catch (error) {
    console.error('[ERROR] generateShareableReport:', error.message);
    console.error('[ERROR] Stack:', error.stack);
    return Response.json({
      success: false,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
    }, { status: 500 });
  }
});