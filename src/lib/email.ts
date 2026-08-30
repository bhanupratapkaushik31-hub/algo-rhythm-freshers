import nodemailer from 'nodemailer';
import { supabaseAdmin } from './supabaseAdmin';
import { EVENT_CONFIG } from '@/config/event';

const gmailUser = process.env.GMAIL_USER || 'scailpu@gmail.com';
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');

const oauthClientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
const oauthClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
const oauthRefreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.GMAIL_OAUTH_REFRESH_TOKEN;

function getTransporter() {
  // Option A: OAuth2 configuration
  if (oauthRefreshToken && oauthClientId && oauthClientSecret) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: gmailUser,
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        refreshToken: oauthRefreshToken,
      },
    });
  }
  
  // Option B: App Passwords configuration
  if (gmailAppPassword) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });
  }

  return null;
}

export async function sendTicketEmail(registrationId: string, force = false): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn('Gmail sending configuration is missing. Email skipped.');
    try {
      await supabaseAdmin
        .from('registrations')
        .update({
          email_sent: false,
          email_status: 'FAILED',
          email_error: 'GMAIL_APP_PASSWORD or GMAIL_OAUTH credentials are missing in environment variables.'
        })
        .eq('id', registrationId);
    } catch (dbErr) {
      console.error(`Failed to update email failure status (missing credentials) in DB for ${registrationId}:`, dbErr);
    }
    return false;
  }

  try {
    // 1. Fetch student registration details
    const { data: reg, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError || !reg) {
      console.error(`Email delivery failed: Registration ${registrationId} not found.`, regError);
      return false;
    }

    // Check if email was already sent successfully to prevent duplicates
    if (!force && reg.email_sent && reg.email_status === 'SENT') {
      console.log(`Email already sent for registration: ${registrationId}`);
      return true;
    }

    // 2. Fetch payment details
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('registration_id', registrationId)
      .eq('payment_status', 'SUCCESS')
      .maybeSingle();

    const paymentMethodDisplay = payment?.payment_method && payment.payment_method !== 'TEST_SIMULATOR' ? payment.payment_method.toUpperCase() : 'RAZORPAY';

    // 3. Prepare ticket verification link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const ticketUrl = `${appUrl}/ticket/${reg.ticket_token}`;

    // 4. Render HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your ALGO-RHYTHM 2K26 Ticket 🎉</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #0d0620;
            color: #ffffff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          .header {
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            letter-spacing: 2px;
            color: #ffffff;
            text-transform: uppercase;
            font-weight: 800;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
          }
          .content {
            padding: 30px;
            background-color: #120b2e;
            color: #ffffff;
          }
          .welcome {
            font-size: 18px;
            margin-bottom: 20px;
            color: #ec4899;
            font-weight: 600;
          }
          .ticket-details {
            background: rgba(255, 255, 255, 0.05);
            border: 1px dashed rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 8px;
          }
          .detail-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
            margin-bottom: 0;
          }
          .label {
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
          }
          .value {
            font-weight: 600;
            color: #ffffff;
            font-size: 14px;
            text-align: right;
          }
          .value.highlight {
            color: #eab308;
          }
          .btn-container {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
            color: #ffffff !important;
            text-decoration: none;
            font-weight: bold;
            border-radius: 30px;
            box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
            letter-spacing: 1px;
            text-transform: uppercase;
            font-size: 14px;
          }
          .footer {
            background-color: #0b051c;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ALGO-RHYTHM</h1>
            <p>CSE Fresher Party 2026 🎉</p>
          </div>
          <div class="content">
            <p>Hello ${reg.full_name},</p>
            <p>Your registration and payment for <strong>ALGO-RHYTHM – CSE Fresher Party 2026</strong> have been successfully completed.</p>
            
            <div class="ticket-details">
              <div class="detail-row">
                <span class="label">Full Name:</span>
                <span class="value">${reg.full_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Registration No.:</span>
                <span class="value">${reg.registration_number}</span>
              </div>
              <div class="detail-row">
                <span class="label">Year:</span>
                <span class="value">${reg.year}</span>
              </div>
              <div class="detail-row">
                <span class="label">School Name:</span>
                <span class="value">${reg.school_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Modeling Choice:</span>
                <span class="value">${reg.modeling}</span>
              </div>
              <div class="detail-row">
                <span class="label">Ticket ID:</span>
                <span class="value highlight">${reg.ticket_id || 'Generating...'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Event Date:</span>
                <span class="value">${EVENT_CONFIG.displayDate}</span>
              </div>
              <div class="detail-row">
                <span class="label">Event Venue:</span>
                <span class="value">${EVENT_CONFIG.venue}</span>
              </div>
              <div class="detail-row">
                <span class="label">Amount:</span>
                <span class="value">₹${EVENT_CONFIG.registrationFee}</span>
              </div>
              <div class="detail-row">
                <span class="label">Payment Status:</span>
                <span class="value" style="color: #22c55e;">PAID</span>
              </div>
              <div class="detail-row">
                <span class="label">Payment Method:</span>
                <span class="value">${paymentMethodDisplay}</span>
              </div>
            </div>

            <p style="margin-top: 25px;"><strong>Event:</strong><br/>ALGO-RHYTHM – ${EVENT_CONFIG.hostedBy} CSE Fresher Party 2026</p>
            <p><strong>Date:</strong><br/>${EVENT_CONFIG.displayDate}</p>
            <p><strong>Time:</strong><br/>${EVENT_CONFIG.displayTime}</p>
            <p><strong>Venue:</strong><br/>${EVENT_CONFIG.venue}</p>

            <p style="margin-top: 25px;">Please click the button below to view, print, or download your digital entry ticket. You will need to show the QR code on your ticket at the entrance for verification.</p>
            
            <div class="btn-container">
              <a href="${ticketUrl}" class="btn">View Ticket</a>
            </div>
            
            <p style="font-size: 12px; color: rgba(255, 255, 255, 0.5); text-align: center; margin-top: 30px;">
              For any queries, contact Bhanu Pratap Kaushik (8273930552) or Vaidya Vaibhava (9441262727).
            </p>
          </div>
          <div class="footer">
            &copy; 2026 ${EVENT_CONFIG.hostedBy}. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // 5. Dispatch Email (Try Resend first if API key exists, otherwise fallback to Gmail SMTP)
    const timestamp = new Date().toISOString();

    if (process.env.RESEND_API_KEY) {
      console.log(`[Email Service] Attempting Resend dispatch for ${reg.email}...`);
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'ALGO-RHYTHM <noreply@resend.dev>';
        
        const resendRes = await resend.emails.send({
          from: fromEmail,
          to: reg.email,
          subject: `Your ALGO-RHYTHM 2K26 Ticket 🎉`,
          html: htmlContent,
        });

        if (resendRes.error) {
          throw new Error(resendRes.error.message || 'Resend API returned an error.');
        }

        const resendId = resendRes.data?.id || 'RESEND_OK';
        console.log(`[Resend Service] Email sent successfully to ${reg.email}. ID: ${resendId}`);

        // Update database: Try updating with email_sent_at
        const { error: updateErr } = await supabaseAdmin
          .from('registrations')
          .update({
            email_sent: true,
            email_status: 'SENT',
            email_sent_at: timestamp,
            email_error: `RESEND_ID: ${resendId}`,
            updated_at: timestamp
          })
          .eq('id', registrationId);

        if (updateErr) {
          console.warn(`[Resend Service] Failed to update registrations with email_sent_at column, retrying without it:`, updateErr.message);
          await supabaseAdmin
            .from('registrations')
            .update({
              email_sent: true,
              email_status: 'SENT',
              email_error: `RESEND_ID: ${resendId} (sent_at omitted)`,
              updated_at: timestamp
            })
            .eq('id', registrationId);
        }

        return true;
      } catch (resendErr: any) {
        const errMsg = resendErr.message || String(resendErr);
        console.error(`[Resend Service] Resend dispatch failed for registration ${registrationId}:`, errMsg);
        
        // Log Resend error directly in database
        const { error: updateErr } = await supabaseAdmin
          .from('registrations')
          .update({
            email_sent: false,
            email_status: 'FAILED',
            email_error: `[Resend Error] ${errMsg}`,
            updated_at: timestamp
          })
          .eq('id', registrationId);

        if (updateErr) {
          console.warn(`[Resend Service] Failed to update fail status with email_sent_at column, retrying without it:`, updateErr.message);
          await supabaseAdmin
            .from('registrations')
            .update({
              email_sent: false,
              email_status: 'FAILED',
              email_error: `[Resend Error] ${errMsg} (sent_at omitted)`,
              updated_at: timestamp
            })
            .eq('id', registrationId);
        }
        
        return false;
      }
    }

    // Gmail SMTP Fallback (Only executed if RESEND_API_KEY is not defined)
    console.log(`[Gmail Service] Attempting Gmail SMTP dispatch for ${reg.email}...`);
    const transporter = getTransporter();

    if (!transporter) {
      const missingCredsMsg = 'GMAIL_APP_PASSWORD or GMAIL_OAUTH credentials are missing in environment variables.';
      console.warn(`[Gmail Service] Gmail sending configuration is missing. Email skipped.`);
      
      const { error: updateErr } = await supabaseAdmin
        .from('registrations')
        .update({
          email_sent: false,
          email_status: 'FAILED',
          email_error: missingCredsMsg,
          updated_at: timestamp
        })
        .eq('id', registrationId);

      if (updateErr) {
        await supabaseAdmin
          .from('registrations')
          .update({
            email_sent: false,
            email_status: 'FAILED',
            email_error: `${missingCredsMsg} (sent_at omitted)`,
            updated_at: timestamp
          })
          .eq('id', registrationId);
      }
      return false;
    }

    const mailOptions = {
      from: `ALGO-RHYTHM <${gmailUser}>`,
      to: reg.email,
      subject: `Your ALGO-RHYTHM 2K26 Ticket 🎉`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Gmail Service] Email sent successfully to ${reg.email}. Message ID: ${info.messageId}`);

    // Update database record: Store status SENT, sent time, and use email_error to log the messageId
    const { error: updateErr } = await supabaseAdmin
      .from('registrations')
      .update({
        email_sent: true,
        email_status: 'SENT',
        email_sent_at: timestamp,
        email_error: `MSG_ID: ${info.messageId}`,
        updated_at: timestamp
      })
      .eq('id', registrationId);

    if (updateErr) {
      console.warn(`[Gmail Service] Failed to update registrations with email_sent_at column, retrying without it:`, updateErr.message);
      await supabaseAdmin
        .from('registrations')
        .update({
          email_sent: true,
          email_status: 'SENT',
          email_error: `MSG_ID: ${info.messageId} (sent_at omitted)`,
          updated_at: timestamp
        })
        .eq('id', registrationId);
    }

    return true;

  } catch (emailErr: any) {
    const errMsg = emailErr.message || String(emailErr);
    console.error(`Gmail sending error for registration ${registrationId}:`, errMsg);
    try {
      const timestamp = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from('registrations')
        .update({
          email_sent: false,
          email_status: 'FAILED',
          email_error: `[Gmail SMTP Error] ${errMsg}`,
          updated_at: timestamp
        })
        .eq('id', registrationId);

      if (updateErr) {
        await supabaseAdmin
          .from('registrations')
          .update({
            email_sent: false,
            email_status: 'FAILED',
            email_error: `[Gmail SMTP Error] ${errMsg} (sent_at omitted)`,
            updated_at: timestamp
          })
          .eq('id', registrationId);
      }
    } catch (dbErr) {
      console.error(`Failed to update email failure status in DB for ${registrationId}:`, dbErr);
    }
    return false;
  }
}

export async function sendRefundEmail(details: {
  email: string;
  name: string;
  registrationNumber: string;
  paymentId: string;
  refundId?: string;
  amount: string;
  reason: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('Gmail sending configuration is missing. Refund email skipped.');
    return false;
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Refund Initiated — ALGO-RHYTHM 2K26</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #0d0620;
            color: #ffffff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          .header {
            background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            letter-spacing: 1px;
            color: #ffffff;
            text-transform: uppercase;
            font-weight: 800;
          }
          .content {
            padding: 30px;
            background-color: #120b2e;
            color: #ffffff;
          }
          .welcome {
            font-size: 16px;
            margin-bottom: 20px;
            color: #f87171;
            font-weight: 600;
          }
          .refund-details {
            background: rgba(255, 255, 255, 0.05);
            border: 1px dashed rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 8px;
          }
          .detail-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
            margin-bottom: 0;
          }
          .label {
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
          }
          .value {
            font-weight: 600;
            color: #ffffff;
            font-size: 14px;
            text-align: right;
          }
          .footer {
            background-color: #0b051c;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Refund Initiated</h1>
            <p>ALGO-RHYTHM 2K26 🚫</p>
          </div>
          <div class="content">
            <p class="welcome">Hello ${details.name},</p>
            <p>Your payment was successfully received, but due to an irrecoverable system processing error, your registration could not be completed securely.</p>
            <p>A full refund has been automatically initiated back to your original payment method. Depending on your bank, refunds usually reflect within 5-7 business days.</p>
            
            <div class="refund-details">
              <div class="detail-row">
                <span class="label">Student Name:</span>
                <span class="value">${details.name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Registration No.:</span>
                <span class="value">${details.registrationNumber}</span>
              </div>
              <div class="detail-row">
                <span class="label">Refund Amount:</span>
                <span class="value">₹${details.amount}</span>
              </div>
              <div class="detail-row">
                <span class="label">Razorpay Payment ID:</span>
                <span class="value">${details.paymentId}</span>
              </div>
              <div class="detail-row">
                <span class="label">Refund Transaction ID:</span>
                <span class="value">${details.refundId || 'Processing...'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Reason for Refund:</span>
                <span class="value" style="color: #f87171;">${details.reason}</span>
              </div>
            </div>
            
            <p style="font-size: 12px; color: rgba(255, 255, 255, 0.5); text-align: center; margin-top: 30px;">
              If you have any questions or did not receive your refund, please contact support: scailpu@gmail.com
            </p>
          </div>
          <div class="footer">
            &copy; 2026 School of Computing and AI. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `ALGO-RHYTHM <${gmailUser}>`,
      to: details.email,
      subject: `Refund Initiated — ALGO-RHYTHM 2K26`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Gmail Service] Refund notification sent to ${details.email}. Msg ID: ${info.messageId}`);
    return true;

  } catch (emailErr) {
    console.error(`Gmail sending error for refund notification:`, emailErr);
    return false;
  }
}

export async function sendMagicLinkEmail(email: string, name: string, link: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('Gmail sending configuration is missing. Magic link email skipped.');
    return false;
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Access Your ALGO-RHYTHM 2K26 Tickets 🎉</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #0d0620;
            color: #ffffff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          .header {
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            letter-spacing: 2px;
            color: #ffffff;
            text-transform: uppercase;
            font-weight: 800;
          }
          .content {
            padding: 30px;
            background-color: #120b2e;
            color: #ffffff;
          }
          .welcome {
            font-size: 18px;
            margin-bottom: 20px;
            color: #ec4899;
            font-weight: 600;
          }
          .btn-container {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
            color: #ffffff !important;
            text-decoration: none;
            font-weight: bold;
            border-radius: 30px;
            box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
            letter-spacing: 1px;
            text-transform: uppercase;
            font-size: 14px;
          }
          .footer {
            background-color: #0b051c;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ALGO-RHYTHM</h1>
            <p>CSE Fresher Party 2026 🎉</p>
          </div>
          <div class="content">
            <p class="welcome">Hello ${name},</p>
            <p>We received a request to retrieve your entry ticket for <strong>ALGO-RHYTHM – CSE Fresher Party 2026</strong>.</p>
            <p>Click the button below to verify your email and directly access your ticket on the website. This link will expire in 15 minutes.</p>
            
            <div class="btn-container">
              <a href="${link}" class="btn">Access My Ticket</a>
            </div>
            
            <p style="font-size: 12px; color: rgba(255, 255, 255, 0.5); text-align: center; margin-top: 30px;">
              If you did not request this, you can safely ignore this email. Your ticket remains secure.
            </p>
          </div>
          <div class="footer">
            &copy; 2026 School of Computing and AI. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `ALGO-RHYTHM <${gmailUser}>`,
      to: email,
      subject: `Retrieve Your ALGO-RHYTHM 2K26 Tickets 🎉`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Gmail Service] Magic link verification sent to ${email}. Msg ID: ${info.messageId}`);
    return true;

  } catch (emailErr) {
    console.error(`Gmail sending error for magic link verification:`, emailErr);
    return false;
  }
}

export async function sendOtpEmail(email: string, otpCode: string, name?: string): Promise<boolean> {
  const studentName = name || 'Student';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your Verification Code - ALGO-RHYTHM 2K26</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #0d0620;
          color: #ffffff;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 540px;
          margin: 30px auto;
          background: #130a2a;
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        }
        .header {
          background: linear-gradient(135deg, #7928ca 0%, #ff0080 100%);
          padding: 28px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #ffffff;
          text-transform: uppercase;
        }
        .header p {
          margin: 6px 0 0;
          font-size: 11px;
          letter-spacing: 1.5px;
          color: rgba(255, 255, 255, 0.9);
          text-transform: uppercase;
          font-weight: 700;
        }
        .content {
          padding: 32px 28px;
          background: #130a2a;
          color: #e2e8f0;
        }
        .greeting {
          font-size: 16px;
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 12px;
        }
        .text {
          font-size: 13px;
          line-height: 1.6;
          color: #cbd5e1;
          margin-bottom: 24px;
        }
        .otp-box {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 16px;
          padding: 24px 16px;
          text-align: center;
          margin: 24px 0;
        }
        .otp-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #c084fc;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .otp-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 38px;
          font-weight: 900;
          letter-spacing: 8px;
          color: #ffffff;
          text-shadow: 0 0 20px rgba(168, 85, 247, 0.6);
        }
        .otp-expiry {
          font-size: 11px;
          color: #f472b6;
          margin-top: 8px;
          font-weight: 600;
        }
        .warning {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.5;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 18px;
          margin-top: 20px;
        }
        .footer {
          background: #0b051c;
          padding: 16px;
          text-align: center;
          font-size: 10px;
          color: #64748b;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ALGO-RHYTHM 2K26</h1>
          <p>Fresher Party Ticket Verification</p>
        </div>
        <div class="content">
          <p class="greeting">Hello ${studentName},</p>
          <p class="text">
            A request was made to access your event ticket for <strong>ALGO-RHYTHM 2K26</strong>. Use the verification code below to view your ticket:
          </p>
          <div class="otp-box">
            <div class="otp-label">One-Time Verification Code</div>
            <div class="otp-code">${otpCode}</div>
            <div class="otp-expiry">&#9201; Valid for 5 minutes only</div>
          </div>
          <p class="warning">
            &#9888; <strong>Security Notice:</strong> Never share this code with anyone. Event coordinators will never ask for your verification code. If you did not request this, you can safely ignore this email.
          </p>
        </div>
        <div class="footer">
          School of Computing and Artificial Intelligence &bull; ALGO-RHYTHM 2026
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Try Resend if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'ALGO-RHYTHM <noreply@resend.dev>';

      const resendRes = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `Your ALGO-RHYTHM Ticket Code: ${otpCode}`,
        html: htmlContent,
      });

      if (!resendRes.error) {
        console.log(`[Resend Service] OTP email dispatched to ${email}. ID: ${resendRes.data?.id}`);
        return true;
      }
      console.warn('[Resend Service] Resend error for OTP, falling back to Gmail:', resendRes.error);
    } catch (resendErr) {
      console.warn('[Resend Service] Resend exception for OTP, falling back to Gmail:', resendErr);
    }
  }

  // 2. Gmail SMTP Fallback
  const transporter = getTransporter();
  if (!transporter) {
    console.error('[OTP Email] Neither Resend nor Gmail SMTP is configured.');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `ALGO-RHYTHM <${gmailUser}>`,
      to: email,
      subject: `Your ALGO-RHYTHM Ticket Code: ${otpCode}`,
      html: htmlContent,
    });
    console.log(`[Gmail Service] OTP email sent successfully to ${email}. Msg ID: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Gmail Service] Failed to send OTP email to ${email}:`, err);
    return false;
  }
}


