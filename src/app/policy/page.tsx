'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  ShieldCheck, 
  CreditCard, 
  AlertTriangle, 
  Calendar, 
  QrCode, 
  Share2, 
  UserCheck, 
  Sparkles, 
  Scale, 
  Ban, 
  Cpu, 
  LifeBuoy, 
  Lock, 
  HelpCircle, 
  CheckCircle2,
  FileText
} from 'lucide-react';
import { EVENT_CONFIG } from '@/config/event';

export const RULES = [
  {
    id: 1,
    title: "1. Registration & Payment",
    icon: CreditCard,
    color: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300",
    badgeColor: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    content: "Registration is considered confirmed only after successful payment and confirmation from the event registration system. Participants must provide accurate and complete information during registration. Participants are responsible for reviewing all details before completing the payment."
  },
  {
    id: 2,
    title: "2. No Refund Policy",
    icon: Ban,
    color: "from-red-500/20 to-rose-500/20 border-red-500/30 text-red-300",
    badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
    content: "All payments made for event registration are strictly non-refundable. Once the registration fee has been successfully paid, no refund, cancellation, or reversal will be provided, including in cases of change of plans, inability to attend the event, or incorrect information provided during registration."
  },
  {
    id: 3,
    title: "3. Incorrect Information",
    icon: AlertTriangle,
    color: "from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-300",
    badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    content: "Participants are solely responsible for the accuracy of the information submitted during registration. The organizers will not be responsible for any issues arising due to incorrect, incomplete, or invalid information provided by the participant. This includes, but is not limited to, name, enrollment/registration number, email address, phone number, branch, year, or any other registration details. Incorrect information may affect ticket generation, ticket delivery, verification, communication, or entry."
  },
  {
    id: 4,
    title: "4. Event Details",
    icon: Calendar,
    color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300",
    badgeColor: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    content: "All important event details, including the event date, venue, timings, eligibility, registration requirements, and other applicable information, are mentioned on the front page of the website. Participants are expected to carefully review all event details before completing registration and payment."
  },
  {
    id: 5,
    title: "5. Digital Ticket",
    icon: QrCode,
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    content: "A digital ticket and/or QR code may be issued after successful registration and payment. Participants are responsible for keeping their ticket and QR code safe and accessible until entry. The ticket or QR code may be required for verification at the event venue."
  },
  {
    id: 6,
    title: "6. Ticket & QR Code Sharing",
    icon: Share2,
    color: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-300",
    badgeColor: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    content: "Each ticket and QR code is issued for the registered participant only. Sharing, duplicating, modifying, or misusing a ticket or QR code may result in cancellation of the registration and denial of entry without refund."
  },
  {
    id: 7,
    title: "7. Entry & Verification",
    icon: UserCheck,
    color: "from-teal-500/20 to-emerald-500/20 border-teal-500/30 text-teal-300",
    badgeColor: "bg-teal-500/10 text-teal-300 border-teal-500/20",
    content: "Entry will be permitted only after successful verification of the participant's registration, payment status, and ticket/QR code. The organizers reserve the right to deny entry if a ticket is invalid, duplicated, tampered with, already used, or associated with an unsuccessful or unverified payment."
  },
  {
    id: 8,
    title: "8. Event Conduct",
    icon: Sparkles,
    color: "from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-300",
    badgeColor: "bg-pink-500/10 text-pink-300 border-pink-500/20",
    content: "All participants are required to follow the instructions and rules issued by the college, organizing committee, coordinators, and venue authorities. Any participant found engaging in misconduct, harassment, violence, disruptive behavior, damage to property, or violation of institutional rules may be removed from the event without any refund."
  },
  {
    id: 9,
    title: "9. Organizer's Rights",
    icon: Scale,
    color: "from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-300",
    badgeColor: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    content: "The organizing committee reserves the right to modify the event schedule, venue, activities, arrangements, or other event-related details when necessary. Significant changes will be communicated through the available official communication channels wherever reasonably possible."
  },
  {
    id: 10,
    title: "10. Registration Cancellation",
    icon: Ban,
    color: "from-red-500/20 to-amber-500/20 border-red-500/30 text-red-300",
    badgeColor: "bg-red-500/10 text-red-300 border-red-500/20",
    content: "The organizers reserve the right to cancel or reject a registration in cases involving fraudulent activity, misuse of the registration system, violation of event rules, inaccurate information, or any other activity that may compromise the security or smooth conduct of the event."
  },
  {
    id: 11,
    title: "11. Payment Processing",
    icon: CreditCard,
    color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-300",
    badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    content: "Payments are processed through the designated payment gateway. The organizers are not responsible for payment failures, delays, or technical issues caused by the participant's bank, card issuer, UPI provider, internet connection, device, or payment gateway. Participants should avoid making repeated payments without first checking the status of an existing transaction."
  },
  {
    id: 12,
    title: "12. Technical Issues",
    icon: Cpu,
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300",
    badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    content: "In case of a technical issue during registration or payment, participants should retain their payment reference or transaction ID and contact the official event support team. Participants must never share their OTP, UPI PIN, card PIN, password, or other confidential payment credentials with anyone."
  },
  {
    id: 13,
    title: "13. Personal Information",
    icon: Lock,
    color: "from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-300",
    badgeColor: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    content: "The information provided during registration may be used for event registration, ticket generation, payment verification, communication, attendance management, and entry verification. Participants are responsible for ensuring that the information submitted by them is accurate."
  },
  {
    id: 14,
    title: "14. Support & Queries",
    icon: HelpCircle,
    color: "from-sky-500/20 to-blue-500/20 border-sky-500/30 text-sky-300",
    badgeColor: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    content: "For registration, payment, ticket, or event-related issues, participants should contact the official event organizers through the contact details provided on the website. For payment-related queries, participants should provide their registration ID and payment transaction/reference ID where applicable."
  },
  {
    id: 15,
    title: "15. Acceptance of Policy",
    icon: CheckCircle2,
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    content: "By registering for the event and completing the payment, the participant confirms that they have read, understood, and agreed to the Event Policy and the event details displayed on the website."
  }
];

export default function EventPolicyPage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen relative bg-[#060214] text-[#f8fafc]">
      
      {/* Dynamic Background Ambient Blobs */}
      <div className="absolute top-[5%] left-[5%] w-[120px] h-[120px] bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute top-[35%] right-[5%] w-[160px] h-[160px] bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[140px] h-[140px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Navigation */}
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex justify-between items-center relative z-20">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Event
        </Link>
        <div className="flex items-center gap-4">
          <Link 
            href="/register" 
            className="text-xs font-semibold uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors"
          >
            Register Now
          </Link>
          <Link 
            href="/my-ticket" 
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
          >
            My Ticket
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20 relative z-10">
        
        {/* Title Header Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            Official Guidelines & Terms
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold font-outfit text-white tracking-tight leading-tight">
            Event Rules & <span className="text-gradient-purple-pink">Policy</span>
          </h1>
          
          <p className="text-slate-400 text-sm sm:text-base mt-3 leading-relaxed">
            Please review the official guidelines for <strong>{EVENT_CONFIG.name}</strong> ({EVENT_CONFIG.hostedBy}). All registered attendees must comply with these terms.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
            >
              Proceed to Registration
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all"
            >
              Event Details
            </Link>
          </div>
        </motion.div>

        {/* 15 Rules Grid */}
        <div className="space-y-4">
          {RULES.map((rule, index) => {
            const IconComponent = rule.icon;
            return (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 + 0.1, duration: 0.4 }}
                className={`glass-card rounded-2xl p-5 sm:p-6 border relative overflow-hidden transition-all duration-200 hover:border-white/20`}
              >
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className={`p-3 rounded-xl bg-white/5 border border-white/10 shrink-0 text-purple-400`}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base sm:text-lg font-bold font-outfit text-white tracking-wide">
                        {rule.title}
                      </h2>
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${rule.badgeColor}`}>
                        Section {rule.id}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                      {rule.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom Acceptance & Contact Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-pink-950/40 border border-purple-500/30 text-center relative overflow-hidden"
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <FileText className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-extrabold font-outfit text-white">Have questions regarding the event rules?</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto mt-2 leading-relaxed">
            Feel free to reach out to our official student coordinators for any clarifications on registration, payments, or entrance procedures.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {EVENT_CONFIG.contacts.map((contact, i) => (
              <a
                key={i}
                href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                className="px-4 py-2 bg-black/40 border border-white/10 hover:border-purple-500/40 text-purple-300 text-xs font-semibold rounded-xl transition-all"
              >
                {contact.name}: <strong>{contact.phone}</strong>
              </a>
            ))}
          </div>
        </motion.div>

      </main>

      {/* Footer */}
      <footer className="py-8 bg-black/45 border-t border-white/5 text-center px-4">
        <div className="max-w-4xl mx-auto text-xs text-slate-500 space-y-2">
          <p>&copy; 2026 {EVENT_CONFIG.hostedBy}. All rights reserved.</p>
          <p className="text-[11px] text-slate-600">
            {EVENT_CONFIG.title} &bull; Baldev Raj Mittal Unipolis
          </p>
        </div>
      </footer>
    </div>
  );
}
