import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // 0. Rate limiting (max 10 uploads per minute per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, 'upload-photo', { limit: 10, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many upload attempts. Please wait a moment before trying again.' }
      }, { status: 429 });
    }

    const { fileBase64, mimeType } = await request.json();
    if (!fileBase64) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FILE', message: 'Photo file data is required.' }
      }, { status: 400 });
    }

    const cleanMimeType = (mimeType || 'image/jpeg').toLowerCase().trim();
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(cleanMimeType)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_FILE_TYPE', message: 'Only JPEG, JPG, and PNG image files are supported.' }
      }, { status: 400 });
    }

    // Clean base64 string and validate byte size
    const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Enforce 2 MB maximum buffer size
    const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
    if (buffer.length > MAX_PHOTO_BYTES) {
      return NextResponse.json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'Photo file size exceeds maximum limit of 2MB.' }
      }, { status: 400 });
    }

    if (buffer.length < 100) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_FILE', message: 'Image data is invalid or empty.' }
      }, { status: 400 });
    }

    const extension = cleanMimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `${crypto.randomBytes(16).toString('hex')}.${extension}`;

    // Detect mock mode
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const isMock = !supabaseUrl || supabaseUrl.includes('placeholder');
    if (isMock) {
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
        error: { code: 'UPLOAD_FAILED', message: 'Failed to save student photo. Please try again.' }
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
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process photo upload. Please try again.' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

