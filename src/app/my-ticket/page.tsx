import React from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EVENT_CONFIG } from '@/config/event';
import { Calendar, Clock, MapPin, ShieldCheck, LogOut, ArrowLeft, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import TicketActions from '../ticket/[token]/TicketActions';
import RetrieveForm from './RetrieveForm';
import { verifyTicketSession } from '@/lib/otp';

interface MyTicketPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

export default async function MyTicketPage({ searchParams }: MyTicketPageProps) {
  const { error } = await searchParams;
  const cookieStore = await cookies();

  // 1. Read and verify the tamper-proof ticket access session
  const sessionCookie = cookieStore.get('ticket_access_session')?.value;
  const session = verifyTicketSession(sessionCookie);

  let reg: any = null;
  let entryStatus = 'NOT_ENTERED';
  let accessError: string | null = null;

  // 2. Gate: If NO valid verified session exists, render the 4-field verification form
  if (!session.valid || !session.regIds || session.regIds.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative">
        <div className="absolute top-[10%] left-[5%] w-[60px] h-[60px] bg-purple-500/10 rounded-full blur-lg animate-float-slow pointer-events-none" />

        {/* Floating navbar/header */}
        <header className="w-full max-w-md flex justify-between items-center mb-8">
          <Link href="/" className="font-extrabold tracking-wide text-sm text-gradient-indigo-purple font-outfit select-none">
            ALGO-RHYTHM
          </Link>
          <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
        </header>

        {(accessError || error) && (
          <div className="w-full max-w-md mb-4 p-4 bg-red-950/25 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-3 items-start animate-fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{accessError || error}</span>
          </div>
        )}

        <RetrieveForm />
      </div>
    );
  }

  // 3. Authenticated Session Exists: Fetch ONLY the single registration bound to this verified session
  const targetRegId = session.regIds[0];

  const { data: matchedReg, error: fetchErr } = await supabaseAdmin
    .from('registrations')
    .select('*')
    .eq('id', targetRegId)
    .eq('registration_status', 'PAID')
    .maybeSingle();

  if (fetchErr || !matchedReg) {
    accessError = 'No confirmed paid ticket found for this verified session.';
  } else {
    reg = matchedReg;
  }

  // 4. Check entry status for this verified ticket
  if (reg) {
    const { data: entry } = await supabaseAdmin
      .from('entries')
      .select('entry_status')
      .eq('registration_id', reg.id)
      .maybeSingle();

    if (entry) {
      entryStatus = entry.entry_status;
    }
  }

  // 5. Render: Display Active Verified Ticket
  if (reg) {
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(reg.ticket_token, {
        margin: 1,
        width: 250,
        color: {
          dark: '#0f0a2c',
          light: '#ffffff',
        },
      });
    } catch (qrErr) {
      console.error('Failed to generate QR code in My Ticket page:', qrErr);
    }

    // Payment method
    let paymentMethod = 'RAZORPAY';
    const { data: pay } = await supabaseAdmin
      .from('payments')
      .select('payment_method, payment_status')
      .eq('registration_id', reg.id)
      .maybeSingle();

    if (pay?.payment_status === 'SUCCESS' && pay?.payment_method) {
      paymentMethod = pay.payment_method;
    }

    // Photo
    const defaultPhotoUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a855f7'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/></svg>";
    let photoUrl = defaultPhotoUrl;
    if (reg.photo_path) {
      if (reg.photo_path.startsWith('mock-photos/')) {
        photoUrl = defaultPhotoUrl;
      } else {
        const { data: signedData } = await supabaseAdmin.storage
          .from('student-photos')
          .createSignedUrl(reg.photo_path, 3600);
        photoUrl = signedData?.signedUrl || defaultPhotoUrl;
      }
    }

    const isEntered = entryStatus === 'ENTERED' || entryStatus === 'TEST_ENTERED';

    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 print:p-0 print:bg-white relative">
        <div className="absolute top-[10%] left-[5%] w-[60px] h-[60px] bg-purple-500/10 rounded-full blur-lg animate-float-slow pointer-events-none" />

        {/* Floating navbar/header */}
        <header className="w-full max-w-sm flex justify-between items-center print:hidden mb-6">
          <Link href="/" className="font-extrabold tracking-wide text-sm text-gradient-indigo-purple font-outfit">
            ALGO-RHYTHM
          </Link>
          <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
        </header>

        {/* Printable styling */}
        <style>{`
          @media print {
            @page {
              margin: 0;
              size: portrait;
            }
            html, body {
              background: #060214 !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              width: 100% !important;
              height: 100% !important;
              overflow: hidden !important;
            }
            body * {
              visibility: hidden !important;
            }
            #event-ticket, #event-ticket * {
              visibility: visible !important;
            }
            #event-ticket {
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) !important;
              width: 90vw !important;
              max-width: 360px !important;
              border: 1px solid rgba(168, 85, 247, 0.2) !important;
              border-radius: 24px !important;
              background: #0c0724 !important;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-text-dark {
              color: #ffffff !important;
            }
          }
        `}</style>

        <div className="w-full max-w-sm space-y-6 print:max-w-none print:w-auto print-container">
          <div 
            id="event-ticket" 
            className="print-ticket-card w-full rounded-3xl overflow-hidden glass-card border border-purple-500/20 relative shadow-2xl bg-[#0c0724]"
          >
            {/* Top Decorative bar */}
            <div className="h-2 w-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 print:hidden" />

            {/* Scanned Badge Overlay */}
            {isEntered && (
              <div className="absolute top-4 right-4 z-10 bg-emerald-500/90 border border-emerald-400 text-white font-extrabold text-[10px] tracking-widest px-3 py-1 rounded-full uppercase shadow-md animate-pulse">
                ENTRY USED
              </div>
            )}

            {/* Ticket Body */}
            <div className="p-8 space-y-6 flex flex-col items-center">
              <div className="text-center w-full space-y-1">
                <h2 className="text-2xl font-black font-outfit text-white tracking-widest print-text-dark uppercase">
                  ALGO-RHYTHM
                </h2>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider print-text-slate">
                  School of Computing and Artificial Intelligence
                </p>
                <p className="text-xs font-bold text-gradient-purple-pink uppercase tracking-widest print-text-slate">
                  Fresher Party 2026 🎉
                </p>
              </div>

              <div className="w-full border-t border-dashed border-white/10 print-border-dashed" />

              {/* Student Photo */}
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-purple-500/30 bg-black/40 flex items-center justify-center shrink-0 shadow-lg relative">
                <img 
                  src={photoUrl} 
                  alt="Student Attendee Photo" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="text-center w-full">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold print-text-slate">Student Attendee</span>
                <h3 className="text-xl font-extrabold text-white font-outfit tracking-tight print-text-dark mt-1">
                  {reg.full_name}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full text-center">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 print-bg-slate">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold print-text-slate">Registration No.</span>
                  <p className="text-sm font-black font-outfit text-purple-300 print-text-dark mt-0.5">{reg.registration_number}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 print-bg-slate">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold print-text-slate">Academic Year</span>
                  <p className="text-sm font-black font-outfit text-pink-300 print-text-dark mt-0.5">{reg.year}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 print-bg-slate">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold print-text-slate">Modeling</span>
                  <p className="text-sm font-black font-outfit text-white print-text-dark mt-0.5">{reg.modeling}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 print-bg-slate">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold print-text-slate">Ticket ID</span>
                  <p className="text-sm font-black font-outfit text-amber-500 print-text-dark mt-0.5">{reg.ticket_id}</p>
                </div>
              </div>

              {qrCodeDataUrl && (
                <div className="p-3 bg-white rounded-2xl shadow-inner inline-flex items-center justify-center relative">
                  <img 
                    src={qrCodeDataUrl} 
                    alt="Entry verification QR code" 
                    className="w-40 h-40 object-contain animate-fade-in"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 items-center">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider print-badge">
                  <ShieldCheck className="w-4 h-4" />
                  Payment Status: PAID
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold print-text-slate">
                  Payment Method: {paymentMethod && paymentMethod !== 'TEST_SIMULATOR' ? paymentMethod.toUpperCase() : 'ONLINE (RAZORPAY)'}
                </div>
              </div>

              <div className="text-center max-w-[250px]">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold print-text-slate block">School Department</span>
                <span className="text-[11px] font-bold text-slate-300 print-text-dark">{reg.school_name}</span>
              </div>

              <div className="w-full border-t border-dashed border-white/10 print-border-dashed" />

              <div className="w-full grid grid-cols-1 gap-2.5 text-xs text-slate-300 print-text-dark">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400 shrink-0 print-text-slate" />
                  <span><strong>Date:</strong> {EVENT_CONFIG.displayDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pink-400 shrink-0 print-text-slate" />
                  <span><strong>Time:</strong> {EVENT_CONFIG.displayTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-400 shrink-0 print-text-slate" />
                  <span><strong>Venue:</strong> {EVENT_CONFIG.venue}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Download and Print Actions */}
          <TicketActions ticketId={reg.ticket_id || '0000'} registrationNumber={reg.registration_number} />

          {/* Logout / Verify Another Ticket */}
          <div className="flex flex-col gap-2.5 items-center pt-4 print:hidden">
            <a
              href="/api/my-ticket/logout"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
            >
              <LogOut className="w-3.5 h-3.5" />
              Verify Another Ticket / Exit
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 6. Fallback: Verification Form
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative">
      <div className="absolute top-[10%] left-[5%] w-[60px] h-[60px] bg-purple-500/10 rounded-full blur-lg animate-float-slow pointer-events-none" />

      <header className="w-full max-w-md flex justify-between items-center mb-8">
        <Link href="/" className="font-extrabold tracking-wide text-sm text-gradient-indigo-purple font-outfit select-none">
          ALGO-RHYTHM
        </Link>
        <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
      </header>

      {accessError && (
        <div className="w-full max-w-md mb-4 p-4 bg-red-950/20 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-3 items-start animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{accessError}</span>
        </div>
      )}

      <RetrieveForm />
    </div>
  );
}

export const dynamic = 'force-dynamic';
