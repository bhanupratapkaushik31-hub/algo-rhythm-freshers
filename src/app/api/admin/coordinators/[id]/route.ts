import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to update coordinators.' }
      }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Coordinator ID is required.' }
      }, { status: 400 });
    }

    const { name, active, password, role } = await request.json();

    // Fetch target user's current profile to prevent lower-privilege admins from modifying super_admins
    const { data: targetAdmin } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    // Only super_admin can change user roles
    if (role !== undefined && role !== targetAdmin?.role) {
      if (admin.role !== 'super_admin') {
        return NextResponse.json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only Super Administrators can modify account roles.' }
        }, { status: 403 });
      }
    }

    // Only super_admin or the account owner can change password
    if (password) {
      if (admin.role !== 'super_admin' && admin.id !== id) {
        return NextResponse.json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only Super Administrators can reset passwords for other accounts.' }
        }, { status: 403 });
      }
    }

    // Non-super-admins cannot modify super_admin accounts
    if (targetAdmin?.role === 'super_admin' && admin.role !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to modify a Super Administrator account.' }
      }, { status: 403 });
    }

    // 2. Prepare database updates
    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;
    if (role !== undefined && admin.role === 'super_admin') updates.role = role;

    // 3. Perform profile updates in database
    if (Object.keys(updates).length > 0) {
      const { error: dbErr } = await supabaseAdmin
        .from('admins')
        .update(updates)
        .eq('id', id);

      if (dbErr) {
        console.error('Update coordinator profile DB error:', dbErr);
        return NextResponse.json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to update coordinator record.' }
        }, { status: 500 });
      }
    }

    // 4. Perform credential updates in Supabase Auth if password is changed
    if (password) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: password
      });

      if (authErr) {
        console.error('Update coordinator auth password error:', authErr);
        return NextResponse.json({
          success: false,
          error: { code: 'AUTH_UPDATE_FAILED', message: authErr.message || 'Failed to update coordinator credentials.' }
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Coordinator updated successfully.'
    });

  } catch (err: any) {
    console.error('PUT coordinator API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Verify admin permissions (Only super_admin can delete other coordinators)
    const admin = await verifyAdminAuth(request, ['super_admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Only super administrators can delete coordinators.' }
      }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Coordinator ID is required.' }
      }, { status: 400 });
    }

    // Prevent deleting oneself
    if (admin.id === id) {
      return NextResponse.json({
        success: false,
        error: { code: 'SELF_DELETION', message: 'You cannot delete your own admin account.' }
      }, { status: 400 });
    }

    // 2. Delete Auth User from Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authErr) {
      console.error('Delete coordinator auth error:', authErr);
      return NextResponse.json({
        success: false,
        error: { code: 'AUTH_DELETION_FAILED', message: authErr.message || 'Failed to remove coordinator authentication.' }
      }, { status: 500 });
    }

    // 3. Delete custom profile from admins table
    const { error: dbErr } = await supabaseAdmin
      .from('admins')
      .delete()
      .eq('id', id);

    if (dbErr) {
      console.error('Delete coordinator profile DB error:', dbErr);
      // Profile is orphaned but auth is gone. Not fatal, but log it.
    }

    return NextResponse.json({
      success: true,
      message: 'Coordinator deleted successfully.'
    });

  } catch (err: any) {
    console.error('DELETE coordinator API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
