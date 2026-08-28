import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  // Keep this endpoint development-only
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'This endpoint is only available in the development environment.'
      }
    }, { status: 403 });
  }

  try {
    const gmailUser = process.env.GMAIL_USER || 'scailpu@gmail.com';
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
    const oauthClientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
    const oauthClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
    const oauthRefreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.GMAIL_OAUTH_REFRESH_TOKEN;

    // Validate variables
    if (!gmailAppPassword && !(oauthRefreshToken && oauthClientId && oauthClientSecret)) {
      const errMsg = 'Gmail sending credentials (GMAIL_APP_PASSWORD or GOOGLE_REFRESH_TOKEN) are missing in environment variables (.env.local).';
      console.error(`[Test Email Endpoint] ${errMsg}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: errMsg
        }
      }, { status: 400 });
    }

    // Determine the recipient email
    let toEmail = '';
    try {
      const body = await request.json();
      toEmail = body.to;
    } catch (e) {
      // Body might be missing
    }

    if (!toEmail) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_RECIPIENT',
          message: 'Please provide a recipient email in the request body (JSON format: {"to": "email@example.com"}).'
        }
      }, { status: 400 });
    }

    console.log(`[Test Email Endpoint] Initializing nodemailer transporter...`);
    let transporter;
    
    if (oauthRefreshToken && oauthClientId && oauthClientSecret) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: gmailUser,
          clientId: oauthClientId,
          clientSecret: oauthClientSecret,
          refreshToken: oauthRefreshToken,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });
    }

    console.log(`[Test Email Endpoint] Sending test email to: ${toEmail}...`);
    const mailOptions = {
      from: `ALGO-RHYTHM <${gmailUser}>`,
      to: toEmail,
      subject: 'ALGO-RHYTHM Gmail Test',
      html: '<h1>Gmail integration is working!</h1><p>This is a test email from the ALGO-RHYTHM ticketing system using Gmail/Google SMTP.</p>',
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Test Email Endpoint] Test email sent successfully. Message ID: ${info.messageId}`);

    return NextResponse.json({
      success: true,
      data: {
        messageId: info.messageId
      }
    });

  } catch (err: any) {
    console.error('[Test Email Endpoint] Unhandled error during email testing:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNHANDLED_EXCEPTION',
        message: err.message || String(err),
        details: err
      }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
