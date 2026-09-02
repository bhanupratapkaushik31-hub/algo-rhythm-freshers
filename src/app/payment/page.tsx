'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Loader2, 
  AlertTriangle, 
  ArrowLeft, 
  CheckCircle,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { EVENT_CONFIG } from '@/config/event';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registrationId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(
    typeof window !== 'undefined' && !!(window as any).Razorpay
  );
  const [verifying, setVerifying] = useState(false);
  const [isCheckoutOpening, setIsCheckoutOpening] = useState(false);
  const [alreadyPaidToken, setAlreadyPaidToken] = useState<string | null>(null);


  const [paymentStatus, setPaymentStatus] = useState<string>('PENDING');
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Helper to ensure Razorpay checkout script is loaded on-demand
  const ensureRazorpayLoaded = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if ((window as any).Razorpay) {
      setRazorpayLoaded(true);
      return true;
    }

    return new Promise((resolve) => {
      const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existing) {
        if ((window as any).Razorpay) {
          setRazorpayLoaded(true);
          return resolve(true);
        }
        const onScriptLoad = () => {
          setRazorpayLoaded(true);
          resolve(true);
        };
        existing.addEventListener('load', onScriptLoad, { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        setTimeout(() => {
          const ok = !!(window as any).Razorpay;
          setRazorpayLoaded(ok);
          resolve(ok);
        }, 3000);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        setRazorpayLoaded(true);
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
      setTimeout(() => {
        const ok = !!(window as any).Razorpay;
        setRazorpayLoaded(ok);
        resolve(ok);
      }, 5000);
    });
  };

  // 1. Check payment status and initialize checkout on mount
  useEffect(() => {
    if (!registrationId) {
      setError('Invalid checkout link. Registration ID is missing.');
      setLoading(false);
      setCheckingStatus(false);
      return;
    }

    const initPayment = async () => {
      try {
        const response = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registration_id: registrationId }),
        });

        const res = await response.json();

        if (!response.ok || !res.success) {
          if (res.error?.code === 'ALREADY_PAID' && res.error?.ticket_token) {
            setAlreadyPaidToken(res.error.ticket_token);
            setPaymentStatus('SUCCESS');
            setLoading(false);
            return;
          }
          setError(res.error?.message || 'Failed to prepare payment order. Please try again.');
          setLoading(false);
          return;
        }

        setPaymentData(res.data);
        setLoading(false);

      } catch (err) {
        console.error('Checkout error:', err);
        setError('Network error. Failed to connect to payment gateway.');
        setLoading(false);
      }
    };

    const checkStatusFirst = async () => {
      try {
        const response = await fetch(`/api/payment/status?registration_id=${registrationId}`);
        if (response.ok) {
          const res = await response.json();
          if (res.success) {
            const status = res.data.status;
            setPaymentStatus(status);
            if (status === 'SUCCESS') {
              setAlreadyPaidToken(res.data.ticket_token);
              setCheckingStatus(false);
              setLoading(false);
              return;
            }
            if (status === 'REFUND_PROCESSING' || status === 'REFUNDED') {
              setCheckingStatus(false);
              setLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Status check failed:', err);
      }
      
      setCheckingStatus(false);
      await initPayment();
    };

    checkStatusFirst();
  }, [registrationId]);



  // 2. Trigger Razorpay Checkout Modal
  const handlePayment = async () => {
    console.log('[Payment] Initiating Razorpay checkout...');
    if (isCheckoutOpening || verifying) return;

    if (!paymentData) {
      setError('Payment order details not loaded yet. Please wait or reload.');
      return;
    }

    if (!paymentData.razorpay_configured) {
      setError('Payment integration is not configured yet. Please configure Razorpay keys to proceed.');
      return;
    }

    setIsCheckoutOpening(true);
    setError(null);

    // Safely verify and load Razorpay checkout script
    const isRzpLoaded = await ensureRazorpayLoaded();
    if (!isRzpLoaded || typeof (window as any).Razorpay === 'undefined') {
      setError('Payment gateway (Razorpay) could not be loaded. Please check your internet connection or disable ad-blockers and try again.');
      setIsCheckoutOpening(false);
      console.error('Razorpay SDK is not loaded on window.');
      return;
    }

    try {
      // Sanitize phone: Razorpay prefill.contact must be digits only (Indian 10-digit)
      const rawPhone = paymentData.student?.phone || '';
      const sanitizedPhone = rawPhone.replace(/\D/g, '').slice(-10);

      const options = {
        key: paymentData.key_id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        name: EVENT_CONFIG.name,
        description: `${EVENT_CONFIG.name} CSE Fresher Party Registration`,
        image: '/favicon.ico',
        order_id: paymentData.order_id,
        handler: async function (response: any) {
          setVerifying(true);
          setIsCheckoutOpening(false);
          try {
            const verifyResponse = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                registration_id: registrationId
              }),
            });

            const verifyRes = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyRes.success) {
              setError(verifyRes.error?.message || 'Payment signature verification failed.');
              setVerifying(false);
              return;
            }

            // Verification succeeded: Redirect to success page with secure token
            router.push(`/success?token=${verifyRes.data.ticket_token}`);

          } catch (err) {
            console.error('Verification error:', err);
            setError('Failed to verify payment with server. If amount was debited, contact coordinators.');
            setVerifying(false);
          }
        },
        prefill: {
          name: paymentData.student?.name || '',
          email: paymentData.student?.email || '',
          contact: sanitizedPhone,
        },
        theme: {
          color: '#a855f7',
        },
        modal: {
          ondismiss: function () {
            console.log('Payment modal dismissed by user');
            setIsCheckoutOpening(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      
      // Capture in-modal payment failures cleanly
      rzp.on('payment.failed', function (resp: any) {
        console.warn('[Checkout] Payment failed inside modal:', resp);
        setIsCheckoutOpening(false);
        const failMsg = resp.error?.description || resp.error?.reason || 'Payment could not be processed. Please try again with another payment method.';
        setError(failMsg);
      });

      rzp.open();
    } catch (openErr: any) {
      console.error('Failed to open Razorpay modal:', openErr);
      setError('Unable to launch payment modal. Please try again.');
      setIsCheckoutOpening(false);
    }
  };


  const handleCancelPayment = () => {
    router.push('/register');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative">
      <Script 
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
      />

      <div className="absolute top-[10%] left-[5%] w-[60px] h-[60px] bg-purple-500/10 rounded-full blur-lg animate-float-slow pointer-events-none" />

      {/* Back link */}
      <div className="w-full max-w-md mb-6">
        <Link 
          href="/register" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Edit Details
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-card rounded-2xl p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        {checkingStatus ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Verifying Registration Status...</p>
          </div>
        ) : loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Creating Payment Order...</p>
          </div>
        ) : verifying ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
            <h3 className="text-lg font-bold font-outfit text-white">Verifying Transaction...</h3>
            <p className="text-slate-400 text-xs max-w-xs">
              Confirming signature with Razorpay servers. Please do not refresh this page or press back.
            </p>
          </div>
        ) : paymentStatus === 'REFUNDED' ? (
          <div className="py-8 text-center flex flex-col items-center justify-center">
            <div className="p-3.5 rounded-full bg-red-950/20 border border-red-500/20 text-red-400 mb-5 flex items-center justify-center w-12 h-12">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white font-outfit mb-2">Payment Refunded</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Your payment for this registration has been refunded. Please contact coordinators if you believe this was an error.
            </p>
            <Link 
              href="/"
              className="w-full inline-flex justify-center items-center px-6 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 font-bold text-xs uppercase tracking-wider rounded-xl text-white transition-all"
            >
              Back to Home
            </Link>
          </div>
        ) : paymentStatus === 'REFUND_PROCESSING' ? (
          <div className="py-8 text-center flex flex-col items-center justify-center">
            <div className="p-3.5 rounded-full bg-amber-950/20 border border-amber-500/20 text-amber-400 mb-5 flex items-center justify-center w-12 h-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-white font-outfit mb-2">Refund Processing</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              A full refund has been automatically initiated for your payment. You will receive an email confirmation once completed.
            </p>
            <Link 
              href="/"
              className="w-full inline-flex justify-center items-center px-6 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 font-bold text-xs uppercase tracking-wider rounded-xl text-white transition-all"
            >
              Back to Home
            </Link>
          </div>
        ) : alreadyPaidToken ? (
          <div className="py-4 text-center flex flex-col items-center justify-center">
            <div className="p-3.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-5 text-center flex items-center justify-center w-12 h-12 mx-auto">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-white font-outfit mb-2">Payment Already Completed</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Your payment for this registration has already been verified and confirmed.
            </p>
            <Link 
              href={`/ticket/${alreadyPaidToken}`}
              className="w-full inline-flex justify-center items-center px-6 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-xs uppercase tracking-wider rounded-xl text-white cursor-pointer hover:shadow-lg hover:shadow-purple-500/25 transition-all"
            >
              View My Ticket
            </Link>
          </div>
        ) : error ? (
          <div className="py-4 text-center flex flex-col items-center justify-center">
            <div className="p-3.5 rounded-full bg-red-950/20 border border-red-500/20 text-red-500 mb-5">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white font-outfit mb-2">Checkout Error</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">{error}</p>
            <div className="flex gap-4 w-full">
              <Link 
                href="/register"
                className="flex-1 inline-flex justify-center items-center px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-wider rounded-xl text-white"
              >
                Go Back
              </Link>
              {paymentData && (
                <button 
                  onClick={handlePayment}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-xs uppercase tracking-wider rounded-xl text-white cursor-pointer"
                >
                  Retry Payment
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="mb-6 pb-6 border-b border-white/5">
              <h1 className="text-2xl font-extrabold text-white font-outfit tracking-tight">Checkout Summary</h1>
              <p className="text-slate-400 text-xs mt-1">Review registration details before payment.</p>
            </div>

            {/* Student metadata */}
            <div className="space-y-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Student Name</span>
                <p className="text-sm font-bold text-white font-outfit">{paymentData.student.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Phone</span>
                  <p className="text-xs text-slate-300 font-semibold">{paymentData.student.phone}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Email</span>
                  <p className="text-xs text-slate-300 font-semibold truncate">{paymentData.student.email}</p>
                </div>
              </div>
              {paymentData.student?.year && (
                <div className="border-t border-white/5 pt-2 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Academic Year</span>
                  <span className="text-xs font-bold text-purple-300 bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 rounded-md">{paymentData.student.year}</span>
                </div>
              )}
            </div>

            {/* Price detail */}
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Fresher Party Entry Ticket {paymentData.student?.year ? `(${paymentData.student.year})` : ''}</span>
                <span className="font-semibold text-white">₹{Math.round(paymentData.amount / 100)}.00</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Gateway Service Charges</span>
                <span className="font-semibold text-emerald-400">FREE</span>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-sm font-bold text-white">Total Amount</span>
                <span className="text-xl font-bold font-outfit text-purple-300">₹{Math.round(paymentData.amount / 100)}.00</span>
              </div>
            </div>

            {/* Security Note / Setup Warning */}
            {!paymentData.razorpay_configured ? (
              <div className="flex items-center gap-3 p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 mb-6 leading-relaxed">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-1">Gateway Unavailable</strong>
                  <span>Online checkout is temporarily paused for maintenance. Please refresh in a moment or contact the event coordinators.</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-purple-950/20 border border-purple-500/10 rounded-xl text-[10px] text-purple-300 mb-6 leading-relaxed">
                <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
                <span>Secured by Razorpay. If you completed payment but got disconnected, simply reload this page to retrieve your ticket.</span>
              </div>
            )}


            {/* Action buttons */}
            <button
              onClick={handlePayment}
              disabled={!paymentData.razorpay_configured || isCheckoutOpening || verifying}
              className={`w-full inline-flex justify-center items-center gap-2 px-8 py-3.5 font-bold rounded-xl shadow-lg text-xs uppercase tracking-wider text-white transition-all duration-200 ${
                paymentData.razorpay_configured && !isCheckoutOpening && !verifying
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 cursor-pointer shadow-purple-500/10 hover:shadow-purple-500/25' 
                  : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed shadow-none'
              }`}
            >
              {isCheckoutOpening ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening Razorpay...
                </>
              ) : verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Payment...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  PAY ₹{Math.round(paymentData.amount / 100)} ONLINE
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function Payment() {
  return (
    <Suspense fallback={
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center gap-4 bg-[#060214]">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Loading Checkout...</p>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}
export const dynamic = 'force-dynamic';
