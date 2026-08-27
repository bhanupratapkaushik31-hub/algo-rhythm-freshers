import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

// GET details for a specific registration
export async function GET(
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
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to view registration details.' }
      }, { status: 401 });
    }

    // 2. Query detailed record
    const { data: reg, error } = await supabaseAdmin
      .from('registrations_with_details')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Fetch registration details DB error:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch registration details.' }
      }, { status: 500 });
    }

    if (!reg) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registration record not found.' }
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: reg
    });

  } catch (err: any) {
    console.error('Registration detail API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

// DELETE (Soft-delete/Cancel) a registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Verify super-admin permissions (only super_admin can cancel registrations)
    const admin = await verifyAdminAuth(request, ['super_admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Only Super Admins can cancel/delete registrations.' }
      }, { status: 403 });
    }

    // 2. Perform soft-delete: update registration_status to CANCELLED
    const { data: reg, error } = await supabaseAdmin
      .from('registrations')
      .update({
        registration_status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Soft delete DB error:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to cancel registration.' }
      }, { status: 500 });
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
        message: 'Registration was cancelled successfully (soft-deleted).',
        registration: reg
      }
    });

  } catch (err: any) {
    console.error('Cancel registration API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}
