import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 1. Verify coordinator/admin access
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authorized to view student photos.' }
      }, { status: 401 });
    }

    // 2. Fetch photo_path from DB
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('photo_path')
      .eq('id', id)
      .maybeSingle();

    const defaultPhotoUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a855f7'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/></svg>";

    if (regErr || !reg) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registration not found.' }
      }, { status: 404 });
    }

    if (!reg.photo_path) {
      return NextResponse.redirect(defaultPhotoUrl);
    }

    if (reg.photo_path.startsWith('mock-photos/')) {
      return NextResponse.redirect(defaultPhotoUrl);
    }

    // 3. Create signed URL
    const { data: signedData, error: storageErr } = await supabaseAdmin.storage
      .from('student-photos')
      .createSignedUrl(reg.photo_path, 3600);

    if (storageErr || !signedData?.signedUrl) {
      console.error('[Admin Photo Endpoint] Signed URL generation error:', storageErr);
      return NextResponse.json({
        success: false,
        error: { code: 'STORAGE_ERROR', message: 'Failed to retrieve photo.' }
      }, { status: 500 });
    }

    return NextResponse.redirect(signedData.signedUrl);

  } catch (err: any) {
    console.error('[Admin Photo API] Crash:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
