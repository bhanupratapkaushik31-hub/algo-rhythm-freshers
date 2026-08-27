import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

// GET settings (Publicly accessible so frontend landing page can check status)
export async function GET() {
  try {
    const { data: setting, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'registration_status')
      .maybeSingle();

    if (error) {
      console.error('Fetch registration status settings error:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to read registration status.' }
      }, { status: 500 });
    }

    const isOpen = setting ? (setting.value as any).open : true;

    return NextResponse.json({
      success: true,
      data: {
        open: isOpen
      }
    });

  } catch (err: any) {
    console.error('Get settings API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

// POST settings (Toggle registration status - Admin only)
export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to edit settings.' }
      }, { status: 401 });
    }

    const { open } = await request.json();
    if (typeof open !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_PARAMETERS', message: "Parameter 'open' (boolean) is required." }
      }, { status: 400 });
    }

    // 2. Update status setting in database
    const { data: updatedSetting, error } = await supabaseAdmin
      .from('settings')
      .upsert({
        key: 'registration_status',
        value: { open },
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Update registration status error:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update settings.' }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        open: (updatedSetting.value as any).open,
        updated_at: updatedSetting.updated_at
      }
    });

  } catch (err: any) {
    console.error('Update settings API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
