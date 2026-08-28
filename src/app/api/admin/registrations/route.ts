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

    let list = null;
    let count = null;
    let error = null;

    const primaryResult = await query;
    if (primaryResult.error) {
      const errMsg = primaryResult.error.message;
      const isLegacyView = errMsg.includes('payment_status') || errMsg.includes('refund_status') || errMsg.includes('is_test') || errMsg.includes('entry_is_test');
      
      if (isLegacyView) {
        console.warn('Primary registrations query failed due to legacy view columns, running fallback query:', errMsg);
        // Build fallback query using legacy columns only
        let fallbackQuery = supabaseAdmin
          .from('registrations_with_details')
          .select('*', { count: 'exact' });

        if (search) {
          fallbackQuery = fallbackQuery.or(
            `full_name.ilike.%${search}%,` +
            `registration_number.ilike.%${search}%,` +
            `ticket_id.ilike.%${search}%,` +
            `email.ilike.%${search}%,` +
            `phone.ilike.%${search}%`
          );
        }

        if (year !== 'All') {
          fallbackQuery = fallbackQuery.eq('year', year);
        }

        if (modeling !== 'All') {
          fallbackQuery = fallbackQuery.eq('modeling', modeling);
        }

        if (paymentStatus !== 'All') {
          if (paymentStatus === 'SUCCESS') {
            fallbackQuery = fallbackQuery.eq('registration_status', 'PAID');
          } else if (paymentStatus === 'PENDING') {
            fallbackQuery = fallbackQuery.eq('registration_status', 'PENDING');
          } else if (paymentStatus === 'FAILED') {
            fallbackQuery = fallbackQuery.eq('registration_status', 'FAILED');
          } else {
            fallbackQuery = fallbackQuery.eq('registration_status', paymentStatus);
          }
        }

        if (entryStatus !== 'All') {
          fallbackQuery = fallbackQuery.eq('entry_status', entryStatus);
        }

        if (school) {
          fallbackQuery = fallbackQuery.ilike('school_name', `%${school}%`);
        }

        fallbackQuery = fallbackQuery.order(sortBy, { ascending: sortOrder === 'asc' });
        fallbackQuery = fallbackQuery.range(from, to);

        const fallbackResult = await fallbackQuery;
        list = fallbackResult.data;
        count = fallbackResult.count;
        error = fallbackResult.error;
      } else {
        error = primaryResult.error;
      }
    } else {
      list = primaryResult.data;
      count = primaryResult.count;
    }

    if (error) {
      console.error('Fetch registrations list DB error:', error);
      return NextResponse.json({
        success: false,
        error: { 
          code: 'DATABASE_ERROR', 
          message: `Failed to fetch registrations. (Detail: ${error.message}). Ensure you have run the latest SQL migrations in your Supabase SQL Editor.` 
        }
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
