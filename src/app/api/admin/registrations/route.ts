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
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to view registrations.' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const year = searchParams.get('year') || 'All';
    const modeling = searchParams.get('modeling') || 'All';
    const paymentStatus = searchParams.get('payment_status') || 'All';
    const entryStatus = searchParams.get('entry_status') || 'All';
    const school = searchParams.get('school') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 2. Query the view
    let query = supabaseAdmin
      .from('registrations_with_details')
      .select('*', { count: 'exact' });

    // Apply Search
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,` +
        `registration_number.ilike.%${search}%,` +
        `ticket_id.ilike.%${search}%,` +
        `email.ilike.%${search}%,` +
        `phone.ilike.%${search}%`
      );
    }

    // Apply Filters
    if (year !== 'All') {
      query = query.eq('year', year);
    }

    if (modeling !== 'All') {
      query = query.eq('modeling', modeling);
    }

    if (paymentStatus !== 'All') {
      if (paymentStatus === 'SUCCESS') {
        query = query.eq('payment_status', 'SUCCESS');
      } else if (paymentStatus === 'PENDING') {
        query = query.eq('payment_status', 'PENDING');
      } else if (paymentStatus === 'FAILED') {
        query = query.eq('payment_status', 'FAILED').eq('refund_status', 'NOT_REQUIRED');
      } else if (paymentStatus === 'REFUND_PROCESSING') {
        query = query.eq('refund_status', 'PROCESSING');
      } else if (paymentStatus === 'REFUNDED') {
        query = query.eq('refund_status', 'REFUNDED');
      } else {
        query = query.eq('registration_status', paymentStatus);
      }
    }

    if (entryStatus !== 'All') {
      query = query.eq('entry_status', entryStatus);
    }

    if (school) {
      query = query.ilike('school_name', `%${school}%`);
    }

    // Sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination range
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: list, count, error } = await query;

    if (error) {
      console.error('Fetch registrations list DB error:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch registrations.' }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        registrations: list || [],
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (err: any) {
    console.error('List registrations API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
