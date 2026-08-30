'use client';

import React, { useState, useEffect } from 'react';
import { Phone, Loader2, CheckCircle2, AlertTriangle, ArrowRight, KeyRound, RefreshCw, ArrowLeft } from 'lucide-react';

export default function RetrieveForm() {
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(300); // 5 minutes

  // Countdown timer for resend cooldown and OTP expiry
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (step === 'otp' && otpExpirySeconds > 0) {
      interval = setInterval(() => {
        setOtpExpirySeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, otpExpirySeconds]);

  // Step 1: Request Mobile OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const digitsOnly = mobileNumber.replace(/\D/g, '').slice(-10);
    if (digitsOnly.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/my-ticket/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digitsOnly }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Unable to send OTP. Please try again.');
        if (data.cooldownSeconds) {
          setResendCooldown(data.cooldownSeconds);
        }
      } else {
        setStep('otp');
        setMessage(data.message || 'OTP sent if a registered account exists.');
        setResendCooldown(60);
        setOtpExpirySeconds(300);
      }
    } catch (err) {
      console.error('Request Mobile OTP error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Mobile OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanOtp = otpInput.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    const digitsOnly = mobileNumber.replace(/\D/g, '').slice(-10);

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/my-ticket/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digitsOnly,
          otp: cleanOtp
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Invalid or expired verification code.');
      } else {
        // Successful verification -> navigate to ticket page
        window.location.href = data.redirect || '/my-ticket';
      }
    } catch (err) {
      console.error('Verify Mobile OTP error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatExpiryTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 relative overflow-hidden">
      {/* Top glowing bar */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold font-outfit text-white">
          {step === 'mobile' ? 'Retrieve Your Ticket' : 'Mobile Verification'}
        </h2>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          {step === 'mobile'
            ? 'Enter the 10-digit mobile number you used during registration.'
            : `Enter the 6-digit verification code sent to +91 ${mobileNumber.replace(/\D/g, '').slice(-10)}.`}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-950/25 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-3 items-start animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 bg-purple-950/30 border border-purple-500/25 rounded-xl text-purple-200 text-xs flex gap-3 items-start animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-400 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {step === 'mobile' ? (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
              Registered Mobile Number
            </label>
            <div className="relative flex items-center">
              <span className="inline-flex items-center px-3.5 py-3 bg-white/5 border border-r-0 border-white/10 text-slate-400 rounded-l-xl text-sm font-semibold select-none">
                +91
              </span>
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  placeholder="e.g. 98765 43210"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  disabled={loading}
                  className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-r-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
                  required
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight mt-1">
              A 6-digit one-time code will be sent to your mobile number.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 disabled:from-purple-800/50 disabled:to-pink-800/50 text-white font-bold rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 transition-all outline-none text-xs uppercase tracking-wider cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                Send Mobile OTP
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                6-Digit Mobile OTP
              </label>
              <span className="text-[10px] font-mono text-purple-400">
                Expires in {formatExpiryTime(otpExpirySeconds)}
              </span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4 text-purple-400" />
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="&bull; &bull; &bull; &bull; &bull; &bull;"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                autoFocus
                className="w-full bg-black/30 border border-purple-500/40 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-10 pr-4 py-3 text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 transition-colors outline-none"
                required
              />
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight mt-1">
              Enter the verification code sent to +91 {mobileNumber.replace(/\D/g, '').slice(-10)}.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading || otpInput.length !== 6}
            className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 disabled:from-purple-800/40 disabled:to-pink-800/40 text-white font-bold rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 transition-all outline-none text-xs uppercase tracking-wider cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying OTP...
              </>
            ) : (
              <>
                Verify &amp; View Ticket
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setStep('mobile');
                setOtpInput('');
                setError(null);
                setMessage(null);
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              Change Number
            </button>

            <button
              type="button"
              onClick={() => handleRequestOtp()}
              disabled={resendCooldown > 0 || loading}
              className="text-[11px] font-semibold text-purple-400 disabled:text-slate-600 hover:text-purple-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
