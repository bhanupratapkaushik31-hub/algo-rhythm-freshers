import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { EVENT_CONFIG } from '@/config/event';
import { sendTicketEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify coordinator or admin authorization
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to perform on-spot entry check-ins.' }
      }, { status: 401 });
    }

    const body = await request.json();
    const {
      registration_number,
      full_name,
      email,
      phone,
      year: explicitYear,
      photo_base64,
      scanner_device
    } = body;

    if (!registration_number || !full_name || !email || !phone) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Registration number, full name, email, and phone are required.' }
      }, { status: 400 });
    }

    const cleanRegNo = registration_number.trim().toUpperCase();
    const cleanName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // Determine year and fee
    let resolvedYear: '1st Year' | '2nd Year' | '3rd Year' | '4th Year' = '1st Year';
    if (explicitYear && ['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(explicitYear)) {
      resolvedYear = explicitYear;
    } else {
      resolvedYear = cleanRegNo.startsWith('126') ? '1st Year' : '2nd Year';
    }

    const feeInfo = EVENT_CONFIG.getFeeForYear(resolvedYear);
    const amountInr = feeInfo.inr; // 100 or 200
    const amountPaise = feeInfo.paise; // 10000 or 20000

    const timestamp = new Date().toISOString();

    // 2. Handle Photo upload if provided as base64
    let photoPath: string | null = null;
    let photoUrl: string | undefined = undefined;

    if (photo_base64 && typeof photo_base64 === 'string') {
      try {
        const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `onspot_${cleanRegNo}_${Date.now()}.jpg`;

        const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
          .from('student-photos')
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!uploadErr && uploadData?.path) {
          photoPath = uploadData.path;
          const { data: signedData } = await supabaseAdmin.storage
            .from('student-photos')
            .createSignedUrl(photoPath, 86400 * 30);
          photoUrl = signedData?.signedUrl;
        }
      } catch (photoErr) {
        console.warn('On-spot photo upload warning:', photoErr);
      }
    }

    // 3. Check if registration already exists
    let { data: existingReg } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('registration_number', cleanRegNo)
      .maybeSingle();

    let regId: string;
    let ticketId: string;
    let ticketToken: string;

    if (existingReg) {
      regId = existingReg.id;
      ticketId = existingReg.ticket_id || `ALG26-CSE-${Math.floor(1000 + Math.random() * 9000)}`;
      ticketToken = existingReg.ticket_token || crypto.randomUUID();

      // Update existing record with confirmed on-spot details
      const updateData: any = {
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        year: resolvedYear,
        school_name: 'School of Computing and Artificial Intelligence',
        modeling: 'No',
        registration_status: 'PAID',
        ticket_id: ticketId,
        ticket_token: ticketToken,
        updated_at: timestamp
      };

      if (photoPath) updateData.photo_path = photoPath;

      await supabaseAdmin
        .from('registrations')
        .update(updateData)
        .eq('id', regId);
    } else {
      // Create new registration record
      regId = crypto.randomUUID();
      ticketId = `ALG26-CSE-${Math.floor(1000 + Math.random() * 9000)}`;
      ticketToken = crypto.randomUUID();

      const insertData = {
        id: regId,
        registration_number: cleanRegNo,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        year: resolvedYear,
        school_name: 'School of Computing and Artificial Intelligence',
        modeling: 'No',
        ticket_token: ticketToken,
        ticket_id: ticketId,
        registration_status: 'PAID',
        photo_path: photoPath || null,
        created_at: timestamp,
        updated_at: timestamp
      };

      const { data: newReg, error: insertErr } = await supabaseAdmin
        .from('registrations')
        .insert(insertData)
        .select()
        .single();

      if (insertErr) {
        console.error('On-spot registration insert error:', insertErr);
        return NextResponse.json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to create student registration record.' }
        }, { status: 500 });
      }

      if (newReg?.id) regId = newReg.id;
    }

    // 4. Record payment record
    await supabaseAdmin
      .from('payments')
      .insert({
        registration_id: regId,
        amount: amountPaise,
        currency: 'INR',
        payment_status: 'SUCCESS',
        payment_method: 'UPI_ON_SPOT',
        razorpay_payment_id: `ONSPOT_${Date.now()}`,
        paid_at: timestamp
      });

    // 5. Record entry check-in immediately
    const coordinatorIdentifier = admin.name ? `${admin.name} (${admin.email})` : admin.email;
    const scannerDevice = scanner_device || 'Android Coordinator App (On-Spot)';

    // Check if already has entry
    const { data: existingEntry } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('registration_id', regId)
      .maybeSingle();

    if (!existingEntry) {
      await supabaseAdmin
        .from('entries')
        .insert({
          registration_id: regId,
          ticket_id: ticketId,
          coordinator_id: admin.id,
          entry_status: 'ENTERED',
          scanned_by: coordinatorIdentifier,
          scanner_device: scannerDevice,
          scanned_at: timestamp,
          entry_time: timestamp,
          is_test: false
        });
    }

    // 6. Record audit log in entry_logs
    await supabaseAdmin
      .from('entry_logs')
      .insert({
        registration_id: regId,
        action: 'ON_SPOT_ENTRY',
        scanned_by: coordinatorIdentifier,
        scanner_device: scannerDevice,
        scanned_at: timestamp
      });

    // 7. Send confirmation ticket email asynchronously in background
    try {
      sendTicketEmail(regId, true).catch(err => console.warn('Background on-spot email error:', err));
    } catch (mailErr) {
      console.warn('Ticket email queue warning:', mailErr);
    }

    return NextResponse.json({
      success: true,
      status: 'MARKED',
      message: `On-spot entry confirmed for ${cleanName}! Payment of ₹${amountInr} verified.`,
      data: {
        student: {
          id: regId,
          ticket_id: ticketId,
          ticket_token: ticketToken,
          full_name: cleanName,
          registration_number: cleanRegNo,
          year: resolvedYear,
          amount: amountInr,
          school_name: 'School of Computing and Artificial Intelligence',
          entry_status: 'ENTERED'
        },
        entry_details: {
          scanned_at: timestamp,
          entry_time: timestamp,
          scanned_by: coordinatorIdentifier,
          amount_paid: amountInr,
          scanner_device: scannerDevice
        }
      }
    });

  } catch (err: any) {
    console.error('On-spot entry API crash:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
