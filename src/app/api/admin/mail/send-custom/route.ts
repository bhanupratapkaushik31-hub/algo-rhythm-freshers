import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { sendCustomBroadcastEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to send broadcast emails.' }
      }, { status: 401 });
    }

    const body = await request.json();
    const { 
      registrationIds, 
      subject, 
      message, 
      senderTitle = 'ALGO-RHYTHM 2K26 Announcement',
      buttonText,
      buttonUrl
    } = body;

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Please select at least one recipient.' }
      }, { status: 400 });
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Email subject is required.' }
      }, { status: 400 });
    }

    if (!message || !message.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Email message body is required.' }
      }, { status: 400 });
    }

    // 2. Fetch attendee records
    const { data: records, error: fetchErr } = await supabaseAdmin
      .from('registrations_with_details')
      .select('id, full_name, email, registration_number, year, modeling, ticket_id')
      .in('id', registrationIds);

    if (fetchErr || !records) {
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: fetchErr?.message || 'Failed to fetch recipients.' }
      }, { status: 500 });
    }

    const results: Array<{
      id: string;
      name: string;
      email: string;
      success: boolean;
      error?: string;
    }> = [];

    let sentCount = 0;
    let failedCount = 0;

    // 3. Process dispatch sequentially
    for (const reg of records) {
      if (!reg.email || !reg.email.includes('@')) {
        results.push({
          id: reg.id,
          name: reg.full_name,
          email: reg.email,
          success: false,
          error: 'Invalid or missing email address.'
        });
        failedCount++;
        continue;
      }

      // Variable substitution
      let personalizedHtml = message
        .replace(/\{\{name\}\}/gi, reg.full_name)
        .replace(/\{\{reg_no\}\}/gi, reg.registration_number)
        .replace(/\{\{year\}\}/gi, reg.year || 'Student')
        .replace(/\{\{ticket_id\}\}/gi, reg.ticket_id || 'N/A')
        .replace(/\{\{modeling\}\}/gi, reg.modeling || 'No');

      // Convert newlines to paragraphs/breaks if plain text
      if (!personalizedHtml.includes('<p>') && !personalizedHtml.includes('<div>') && !personalizedHtml.includes('<br')) {
        personalizedHtml = personalizedHtml
          .split('\n\n')
          .map((paragraph: string) => `<p style="margin-bottom: 14px; line-height: 1.6;">${paragraph.replace(/\n/g, '<br/>')}</p>`)
          .join('');
      }

      try {
        const sendRes = await sendCustomBroadcastEmail({
          toEmail: reg.email,
          recipientName: reg.full_name,
          subject: subject.trim(),
          messageHtml: personalizedHtml,
          customSenderTitle: senderTitle.trim(),
          buttonText: buttonText?.trim() || undefined,
          buttonUrl: buttonUrl?.trim() || undefined,
        });

        if (sendRes.success) {
          sentCount++;
          results.push({
            id: reg.id,
            name: reg.full_name,
            email: reg.email,
            success: true
          });
        } else {
          failedCount++;
          results.push({
            id: reg.id,
            name: reg.full_name,
            email: reg.email,
            success: false,
            error: sendRes.error || 'Provider rejected message.'
          });
        }
      } catch (err: any) {
        failedCount++;
        results.push({
          id: reg.id,
          name: reg.full_name,
          email: reg.email,
          success: false,
          error: err.message || 'Unknown exception'
        });
      }

      // 1-second throttle interval to protect Gmail from rate limiting / spam bans
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRequested: registrationIds.length,
        totalProcessed: records.length,
        sent: sentCount,
        failed: failedCount,
        results
      }
    });

  } catch (err: any) {
    console.error('Custom broadcast email API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
