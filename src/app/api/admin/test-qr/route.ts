import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to view test QR statistics.' }
      }, { status: 401 });
    }

    const { data: testSetting } = await supabaseAdmin
      .from('settings')
      .select('value, updated_at')
      .eq('key', 'admin_test_qr_scans')
      .maybeSingle();

    const currentVal = testSetting?.value && typeof testSetting.value === 'object' 
      ? (testSetting.value as any) 
      : { count: 0, scans: [] };

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://algo-rhythm-freshers.vercel.app';
    const qrValue = `${siteUrl}/ticket/admin-test`;

    return NextResponse.json({
      success: true,
      data: {
        qr_value: qrValue,
        token: 'admin-test',
        count: Number(currentVal.count) || 0,
        scans: Array.isArray(currentVal.scans) ? currentVal.scans : [],
        last_scanned_at: testSetting?.updated_at || null
      }
    });
  } catch (err: any) {
    console.error('Test QR fetch error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Only administrators can reset test QR statistics.' }
      }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'reset') {
      await supabaseAdmin
        .from('settings')
        .upsert({
          key: 'admin_test_qr_scans',
          value: {
            count: 0,
            scans: []
          },
          updated_at: new Date().toISOString()
        });

      return NextResponse.json({
        success: true,
        message: 'Admin Test QR statistics have been reset to 0.'
      });
    }

    return NextResponse.json({
      success: false,
      error: { code: 'INVALID_ACTION', message: 'Invalid action requested.' }
    }, { status: 400 });
  } catch (err: any) {
    console.error('Test QR reset error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
