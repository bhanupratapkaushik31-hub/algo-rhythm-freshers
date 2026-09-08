import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to access the mail system.' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const year = searchParams.get('year') || 'All';
    const modeling = searchParams.get('modeling') || 'All';
    const emailStatus = searchParams.get('email_status') || 'All';
    const paymentStatus = searchParams.get('payment_status') || 'PAID';

    // 2. Query registrations from view
    let query = supabaseAdmin
      .from('registrations_with_details')
      .select('*')
      .neq('registration_status', 'CANCELLED')
      .order('created_at', { ascending: false });

    if (paymentStatus !== 'All') {
      query = query.eq('registration_status', paymentStatus);
    }

    if (year !== 'All') {
      query = query.eq('year', year);
    }

    if (modeling !== 'All') {
      query = query.eq('modeling', modeling);
    }

    if (emailStatus === 'SENT') {
      query = query.eq('email_status', 'SENT');
    } else if (emailStatus === 'FAILED') {
      query = query.eq('email_status', 'FAILED');
    } else if (emailStatus === 'PENDING') {
      query = query.or('email_status.is.null,email_status.eq.PENDING');
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,` +
        `registration_number.ilike.%${search}%,` +
        `ticket_id.ilike.%${search}%,` +
        `email.ilike.%${search}%,` +
        `phone.ilike.%${search}%`
      );
    }

    const { data: recipients, error } = await query;

    if (error) {
      console.error('Mail recipients query error:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message || 'Failed to fetch recipients.' }
      }, { status: 500 });
    }

    // 3. Compute high-level stats across all active paid registrants
    const { data: allActive, error: statsError } = await supabaseAdmin
      .from('registrations_with_details')
      .select('id, registration_status, modeling, email_status, email_sent')
      .neq('registration_status', 'CANCELLED');

    if (statsError) {
      console.warn('Mail stats calculation error:', statsError);
    }

    const activeList = allActive || [];
    const paidList = activeList.filter(r => r.registration_status === 'PAID');
    
    const stats = {
      totalActive: activeList.length,
      totalPaid: paidList.length,
      modelingYesCount: paidList.filter(r => r.modeling === 'Yes').length,
      modelingNoCount: paidList.filter(r => r.modeling === 'No').length,
      emailSentCount: paidList.filter(r => r.email_status === 'SENT' || r.email_sent).length,
      emailFailedCount: paidList.filter(r => r.email_status === 'FAILED').length,
      emailPendingCount: paidList.filter(r => (!r.email_status || r.email_status === 'PENDING') && !r.email_sent).length,
      filteredCount: recipients?.length || 0
    };

    return NextResponse.json({
      success: true,
      data: {
        recipients: recipients || [],
        stats
      }
    });

  } catch (err: any) {
    console.error('Mail recipients API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
