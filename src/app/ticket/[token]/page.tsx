import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EVENT_CONFIG } from '@/config/event';
import { Calendar, Clock, MapPin, Check, ShieldCheck, Ticket, ArrowLeft } from 'lucide-react';
import QRCode from 'qrcode';
import TicketActions from './TicketActions';

interface TicketPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function TicketPage({ params }: TicketPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  // 1. Fetch registration info matching token
  const { data: reg, error } = await supabaseAdmin
    .from('registrations')
    .select('*')
    .eq('ticket_token', token)
    .maybeSingle();

  if (error) {
    console.error('Fetch ticket page DB error:', error);
  }

  // 1b. Fetch payment method from payments table
  let paymentMethod = 'RAZORPAY';
  if (reg) {
    const { data: pay } = await supabaseAdmin
      .from('payments')
      .select('payment_method, payment_status')
      .eq('registration_id', reg.id)
      .maybeSingle();
    
    if (pay?.payment_status === 'SUCCESS' && pay?.payment_method) {
      paymentMethod = pay.payment_method;
    }
  }

  // If ticket doesn't exist or isn't paid, render a styled invalid page
  if (!reg || reg.registration_status !== 'PAID') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md glass-card rounded-2xl p-8 text-center border-red-500/20">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Ticket className="w-8 h-8 rotate-45" />
          </div>
          <h1 className="text-2xl font-bold font-outfit text-white mb-2">Ticket Verification Error</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            We couldn't load your ticket. This link is either invalid, or the payment for this registration has not been verified yet.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-full text-xs font-bold uppercase tracking-wider text-white"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // 2. Generate QR code on the server-side as Data URL
  let qrCodeDataUrl = '';
  try {
    // Generate QR with token only, keeping personal info secure
    qrCodeDataUrl = await QRCode.toDataURL(token, {
      margin: 1,
      width: 250,
      color: {
        dark: '#0f0a2c', // Dark blue-purple to match ticket theme
        light: '#ffffff',
      },
    });
  } catch (qrErr) {
    console.error('Failed to generate QR code:', qrErr);
  }

  // Generate signed URL for photo if it exists
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 print:p-0 print:bg-white relative">
      
      {/* Background blobs for premium depth (hidden during print) */}
      <div className="absolute top-[10%] left-[5%] w-[80px] h-[80px] bg-purple-500/10 rounded-full blur-xl animate-float-slow pointer-events-none print:hidden" />
      <div className="absolute bottom-[20%] right-[5%] w-[100px] h-[100px] bg-pink-500/10 rounded-full blur-xl animate-float-slow pointer-events-none print:hidden" />

      {/* Floating navbar/header (hidden during print) */}
      <header className="w-full max-w-sm flex justify-between items-center print:hidden mb-6">
        <Link href="/" className="font-extrabold tracking-wide text-sm text-gradient-indigo-purple font-outfit">
          ALGO-RHYTHM
        </Link>
        <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
      </header>

      {/* Printable CSS override styling */}
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
          /* Hide everything */
          body * {
            visibility: hidden !important;
          }
          /* Only display the ticket and its descendants */
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
          /* Ensure text colors are kept */
          .print-text-dark {
            color: #ffffff !important;
          }
        }
      `}</style>

      <div className="w-full max-w-sm space-y-6 print:max-w-none print:w-auto print-container">
        
        {/* Ticket Container */}
        <div 
          id="event-ticket" 
          className="print-ticket-card w-full rounded-3xl overflow-hidden glass-card border border-purple-500/20 relative shadow-2xl bg-[#0c0724]"
        >
          {/* Top Decorative bar */}
          <div className="h-2 w-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 print:hidden" />

          {/* Ticket Body */}
          <div className="p-8 space-y-6 flex flex-col items-center">
            
            {/* Header info */}
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

            {/* Dashed Separator */}
            <div className="w-full border-t border-dashed border-white/10 print-border-dashed" />

            {/* Student Photo */}
            <div className="w-24 h-24 rounded-2xl overflow-hidden border border-purple-500/30 bg-black/40 flex items-center justify-center shrink-0 shadow-lg relative">
              <img 
                src={photoUrl} 
                alt="Student Attendee Photo" 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Student Name */}
            <div className="text-center w-full">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold print-text-slate">Student Attendee</span>
              <h3 className="text-xl font-extrabold text-white font-outfit tracking-tight print-text-dark mt-1">
                {reg.full_name}
              </h3>
            </div>

            {/* Detail Badges Grid */}
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

            {/* QR Code section */}
            {qrCodeDataUrl && (
              <div className="p-3 bg-white rounded-2xl shadow-inner inline-flex items-center justify-center relative group">
                <img 
                  src={qrCodeDataUrl} 
                  alt="Entry verification QR code" 
                  className="w-40 h-40 object-contain"
                />
              </div>
            )}

            {/* Status indicators */}
            <div className="flex flex-col gap-2 items-center">
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider print-badge">
                <ShieldCheck className="w-4 h-4" />
                Payment Status: PAID
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold print-text-slate">
                Payment Method: {paymentMethod && paymentMethod !== 'TEST_SIMULATOR' ? paymentMethod.toUpperCase() : 'ONLINE (RAZORPAY)'}
              </div>
            </div>

            {/* School department */}
            <div className="text-center max-w-[250px]">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold print-text-slate block">School Department</span>
              <span className="text-[11px] font-bold text-slate-300 print-text-dark">{reg.school_name}</span>
            </div>

            {/* Dashed Separator */}
            <div className="w-full border-t border-dashed border-white/10 print-border-dashed" />

            {/* Logistics Footer */}
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

        {/* Buttons / Actions container */}
        <TicketActions ticketId={reg.ticket_id || '0000'} registrationNumber={reg.registration_number} />

      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
