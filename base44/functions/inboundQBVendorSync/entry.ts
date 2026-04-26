import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { company_name, company_email, company_phone, street, city, state, zip, qb_vendor_id } = await req.json();

    if (!qb_vendor_id || !company_name) {
      return Response.json({ error: 'Missing required fields: qb_vendor_id, company_name' }, { status: 400 });
    }

    // Find existing vendor by qb_vendor_id first, then fall back to company_name
    let existing = await base44.asServiceRole.entities.SubContractor.filter({ qb_vendor_id }, '-updated_date', 1);
    
    if (existing.length === 0) {
      existing = await base44.asServiceRole.entities.SubContractor.filter({ company_name }, '-updated_date', 1);
    }

    if (existing.length > 0) {
      const vendor = existing[0];
      const lastSyncTime = vendor.last_synced ? new Date(vendor.last_synced).getTime() : 0;
      const now = Date.now();
      const secondsSinceSync = (now - lastSyncTime) / 1000;

      // Skip update if synced within last 60 seconds (avoid sync loops)
      if (secondsSinceSync < 60) {
        return Response.json({ skipped: true, reason: 'Updated in app within 60 seconds' });
      }

      // Update existing vendor
      await base44.asServiceRole.entities.SubContractor.update(vendor.id, {
        company_name,
        company_email: company_email || vendor.company_email,
        company_phone: company_phone || vendor.company_phone,
        street: street || vendor.street,
        city: city || vendor.city,
        state: state || vendor.state,
        zip: zip || vendor.zip,
        qb_vendor_id: qb_vendor_id || vendor.qb_vendor_id,
        qb_synced: true,
        last_synced: new Date().toISOString()
      });

      return Response.json({ updated: true, vendor_id: vendor.id });
    } else {
      // Create new vendor
      const newVendor = await base44.asServiceRole.entities.SubContractor.create({
        company_name,
        company_email: company_email || '',
        company_phone: company_phone || '',
        street: street || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
        qb_vendor_id,
        qb_synced: true,
        last_synced: new Date().toISOString(),
        contacts: []
      });

      return Response.json({ created: true, vendor_id: newVendor.id });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});