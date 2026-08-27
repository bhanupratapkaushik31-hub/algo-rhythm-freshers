'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CheckCircle2, Ticket, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { EVENT_CONFIG } from '@/config/event';

function SuccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Trigger confetti explosion on page load
  useEffect(() => {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });

    const timer = setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 450);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative">
      {/* Background blurs */}
      <div className="absolute top-[20%] right-[10%] w-[120px] h-[120px] bg-pink-500/10 rounded-full blur-2xl animate-float-medium pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md glass-card rounded-2xl p-8 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

        {/* 1. Large Animated Checkmark */}
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>

        {/* 2. Success Header */}
        <h1 className="text-3xl font-extrabold text-white font-outfit tracking-tight mb-2">
          Registration Successful! 🎉
        </h1>
        <p className="text-purple-200 text-sm font-semibold mb-6">
          Welcome to ALGO-RHYTHM 2K26!
        </p>

        {/* 3. Verification Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8">
          <ShieldCheck className="w-3.5 h-3.5" />
          Payment Verified ✓
        </div>

        {/* 4. Instructions */}
        <p className="text-xs text-slate-400 leading-relaxed mb-8 max-w-xs mx-auto">
          We have sent your entry ticket details to your registered email address. 
          You can also click the button below to view, download, or print your ticket now.
        </p>

        {/* 5. View Ticket Button */}
        {token ? (
          <Link
            href={`/ticket/${token}`}
            className="group w-full inline-flex justify-center items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold rounded-xl shadow-lg shadow-purple-500/15 text-xs uppercase tracking-wider text-white transition-all duration-200"
          >
            <Ticket className="w-4 h-4" />
            View My Ticket
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        ) : (
          <Link
            href="/"
            className="w-full inline-flex justify-center items-center gap-2 px-8 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 font-bold rounded-xl text-xs uppercase tracking-wider text-white transition-all duration-200"
          >
            Go to Landing Page
          </Link>
        )}

      </motion.div>
    </div>
  );
}

export default function Success() {
  return (
    <Suspense fallback={
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center gap-4 bg-[#060214]">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Preparing Confirmation...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
export const dynamic = 'force-dynamic';
