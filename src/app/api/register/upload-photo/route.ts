import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { fileBase64, mimeType } = await request.json();
    if (!fileBase64) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FILE', message: 'Photo file data is required.' }
      }, { status: 400 });
    }

    const cleanMimeType = mimeType || 'image/jpeg';
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(cleanMimeType.toLowerCase())) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_FILE_TYPE', message: 'Only JPEG, JPG and PNG files are supported.' }
      }, { status: 400 });
    }

    // Clean base64 string
    const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const extension = cleanMimeType.split('/')[1] || 'jpg';
    const fileName = `${crypto.randomBytes(16).toString('hex')}.${extension}`;

    // Detect mock mode
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const isMock = !supabaseUrl || supabaseUrl.includes('placeholder');
    if (isMock) {
      // In mock mode, return a dummy path
      console.log(`[Mock Storage] Uploaded mock file ${fileName}`);
      return NextResponse.json({
        success: true,
        data: {
          photo_path: `mock-photos/${fileName}`
        }
      });
    }

    const { data, error } = await supabaseAdmin.storage
      .from('student-photos')
      .upload(fileName, buffer, {
        contentType: cleanMimeType,
        upsert: true
      });

    if (error) {
      console.error('[Upload Photo Endpoint] Storage upload error:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: `Upload failed: ${error.message}` }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        photo_path: data.path
      }
    });

  } catch (err: any) {
    console.error('[Upload Photo Endpoint] Exception:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
