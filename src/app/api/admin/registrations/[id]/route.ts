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

    // 3. Query entry logs for this registration (ENTRY and RE_ENTRY history)
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from('entry_logs')
      .select('*')
      .eq('registration_id', id)
      .order('scanned_at', { ascending: false });

    if (logsErr) {
      console.warn('Fetch entry_logs error:', logsErr);
    }

    // 4. Generate signed URL for student photo if present
    let photoUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a855f7'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/></svg>";
    if (reg.photo_path && !reg.photo_path.startsWith('mock-photos/')) {
      const { data: signedData } = await supabaseAdmin.storage
        .from('student-photos')
        .createSignedUrl(reg.photo_path, 3600);
      if (signedData?.signedUrl) {
        photoUrl = signedData.signedUrl;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...reg,
        photo_url: photoUrl,
        entry_logs: logs || []
      }
    });

  } catch (err: any) {
    console.error('Registration detail API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

// DELETE (Soft-delete or Permanent-purge) a registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const isPermanent = searchParams.get('permanent') === 'true';

    // 1. Verify admin permissions (Super Admin or Admin for soft-delete; Super Admin only for permanent purge)
    const requiredRoles = isPermanent ? ['super_admin'] : ['super_admin', 'admin'];
    const admin = await verifyAdminAuth(request, requiredRoles as any);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: isPermanent ? 'Only Super Admins can permanently purge records.' : 'You are not authorized to delete registrations.' }
      }, { status: 403 });
    }

    if (isPermanent) {
      // Permanent cascade purge
      await supabaseAdmin.from('entry_logs').delete().eq('registration_id', id);
      await supabaseAdmin.from('entries').delete().eq('registration_id', id);
      await supabaseAdmin.from('payments').delete().eq('registration_id', id);
      const { error: delErr } = await supabaseAdmin.from('registrations').delete().eq('id', id);

      if (delErr) {
        console.error('Permanent purge error:', delErr);
        return NextResponse.json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to permanently delete record.' }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: { message: 'Registration record permanently purged from database.' }
      });
    }

    // 2. Perform soft-delete by setting registration_status to CANCELLED
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
        error: { code: 'DATABASE_ERROR', message: 'Failed to soft delete registration.' }
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
        message: 'Registration was soft-deleted successfully and moved to Trash.',
        registration: reg
      }
    });

  } catch (err: any) {
    console.error('Delete registration API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

// PATCH update registration details (e.g. modeling participation, modeling talent)
export async function PATCH(
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
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to update registration details.' }
      }, { status: 401 });
    }

    const body = await request.json();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (body.modeling !== undefined) {
      updatePayload.modeling = body.modeling;
    }

    if (body.modeling_talent !== undefined) {
      updatePayload.modeling_talent = body.modeling === 'No' 
        ? null 
        : (typeof body.modeling_talent === 'string' ? body.modeling_talent.trim() : null);
    }

    if (body.full_name !== undefined) {
      updatePayload.full_name = body.full_name;
    }

    if (body.phone !== undefined) {
      updatePayload.phone = body.phone;
    }

    if (body.email !== undefined) {
      updatePayload.email = body.email;
    }

    const { data: updatedReg, error } = await supabaseAdmin
      .from('registrations')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Update registration DB error:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message || 'Failed to update registration record.' }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedReg
    });

  } catch (err: any) {
    console.error('Update registration API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}


