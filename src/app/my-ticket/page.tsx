import React from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EVENT_CONFIG } from '@/config/event';
import { Calendar, Clock, MapPin, ShieldCheck, Ticket, LogOut, ArrowLeft, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import TicketActions from '../ticket/[token]/TicketActions';
import RetrieveForm from './RetrieveForm';
import MultiTicketSelect from './MultiTicketSelect';

interface MyTicketPageProps {
  searchParams: Promise<{
    action?: string;
    error?: string;
  }>;
}

export default async function MyTicketPage({ searchParams }: MyTicketPageProps) {
  const { action, error } = await searchParams;
  const cookieStore = await cookies();
  const ticketTokenCookie = cookieStore.get('student_ticket_token')?.value;
  const emailCookie = cookieStore.get('student_email')?.value;

  let reg: any = null;
  let hasMultipleTickets = false;
  let ticketsList: any[] = [];
  let entryStatus = 'NOT_ENTERED';

  // 1. Fetch registrations under email to check if there are multiple tickets
  if (emailCookie) {
    const { data: regs } = await supabaseAdmin
      .from('registrations')
      .select('id, full_name, registration_number, ticket_id, ticket_token')
      .eq('email', emailCookie.trim().toLowerCase())
      .eq('registration_status', 'PAID');
    
    if (regs && regs.length > 0) {
      ticketsList = regs;
      hasMultipleTickets = regs.length > 1;
    }
  }

  // 2. Determine if we should show the active ticket (State A)
  // We skip direct ticket display if the user explicitly clicked "View other tickets" (action=select)
  if (ticketTokenCookie && action !== 'select') {
    const { data: foundReg } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('ticket_token', ticketTokenCookie)
      .eq('registration_status', 'PAID')
      .maybeSingle();
    
    if (foundReg) {
      reg = foundReg;

      // Check if ticket is scanned in entries table
      const { data: entry } = await supabaseAdmin
        .from('entries')
        .select('entry_status')
        .eq('registration_id', reg.id)
        .maybeSingle();
      
      if (entry) {
        entryStatus = entry.entry_status; // e.g. 'ENTERED' or 'TEST_ENTERED'
      }
    }
  }

  // 3. Render State A: Display Active Ticket
  if (reg) {
    // Generate QR code
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

    // Fetch payment method
    let paymentMethod = 'RAZORPAY';
    const { data: pay } = await supabaseAdmin
      .from('payments')
      .select('payment_method, payment_status')
      .eq('registration_id', reg.id)
      .maybeSingle();
    
    if (pay?.payment_status === 'SUCCESS' && pay?.payment_method) {
      paymentMethod = pay.payment_method;
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
                  Payment Method: {paymentMethod === 'TEST_SIMULATOR' ? 'TEST SIMULATOR' : 'RAZORPAY'}
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

          {/* Options to switch tickets / log out */}
          <div className="flex flex-col gap-2.5 items-center pt-4 print:hidden">
            {hasMultipleTickets && (
              <Link
                href="/my-ticket?action=select"
                className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-wider flex items-center gap-1"
              >
                <Ticket className="w-3.5 h-3.5" />
                View My Other Tickets
              </Link>
            )}
            <a
              href="/api/my-ticket/logout"
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              Disconnect / Use Another Email
            </a>
          </div>

        </div>
      </div>
    );
  }

  // 4. Render State A-2: Select Ticket from List
  if (emailCookie && ticketsList.length > 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative">
        <div className="absolute top-[10%] left-[5%] w-[60px] h-[60px] bg-purple-500/10 rounded-full blur-lg animate-float-slow pointer-events-none" />
        
        {/* Floating navbar/header */}
        <header className="w-full max-w-md flex justify-between items-center mb-8">
          <Link href="/" className="font-extrabold tracking-wide text-sm text-gradient-indigo-purple font-outfit">
            ALGO-RHYTHM
          </Link>
          <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
        </header>

        <MultiTicketSelect tickets={ticketsList} email={emailCookie} />
      </div>
    );
  }

  // 5. Render State B: Retrieve Ticket Form
  // Display errors if magic link fails or expired
  let errorMsg = null;
  if (error === 'invalid_token') {
    errorMsg = 'Your verification link is invalid. Please request a new one.';
  } else if (error === 'expired_token') {
    errorMsg = 'Your verification link has expired. Verification links are only valid for 15 minutes.';
  } else if (error === 'no_registration') {
    errorMsg = 'No paid registrations found for this email address.';
  } else if (error) {
    errorMsg = 'Verification failed. Please try again.';
  }

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

      {errorMsg && (
        <div className="w-full max-w-md mb-4 p-4 bg-red-950/20 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-3 items-start animate-pulse">
          <svg className="w-4 h-4 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      <RetrieveForm />
    </div>
  );
}

export const dynamic = 'force-dynamic';
