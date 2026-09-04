import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

// POST: Restore / Recover a soft-deleted registration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to restore registrations.' }
      }, { status: 403 });
    }

    // 2. Check if a successful payment exists to restore correct registration status
    const { data: pay } = await supabaseAdmin
      .from('payments')
      .select('payment_status')
      .eq('registration_id', id)
      .eq('payment_status', 'SUCCESS')
      .maybeSingle();

    const restoredStatus = pay ? 'PAID' : 'PENDING';
    const timestamp = new Date().toISOString();

    // 3. Un-delete the registration with schema-safe fallback
    let reg: any = null;

    const { data: fullData, error: fullErr } = await supabaseAdmin
      .from('registrations')
      .update({
        registration_status: restoredStatus,
        deleted_at: null,
        is_deleted: false,
        updated_at: timestamp
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (fullErr) {
      console.warn('[Restore API] Full update failed, falling back to core payload:', fullErr.message);
      const { data: coreData, error: coreErr } = await supabaseAdmin
        .from('registrations')
        .update({
          registration_status: restoredStatus,
          updated_at: timestamp
        })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (coreErr) {
        console.error('[Restore API] Core update error:', coreErr);
        return NextResponse.json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: `Failed to restore registration: ${coreErr.message}` }
        }, { status: 500 });
      }
      reg = coreData;
    } else {
      reg = fullData;
    }

    if (!reg) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registration record not found.' }
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Registration restored successfully.',
        registration: reg
      }
    });

  } catch (err: any) {
    console.error('Restore registration API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
