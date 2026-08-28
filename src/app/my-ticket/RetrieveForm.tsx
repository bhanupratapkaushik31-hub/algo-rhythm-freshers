'use client';

import React, { useState } from 'react';
import { Phone, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function RetrieveForm() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple length check for digit content
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/my-ticket/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Something went wrong. Please try again.');
      } else {
        if (data.found) {
          // Redirect to my-ticket page, cookies are set
          window.location.href = '/my-ticket';
        } else {
          // Show the generic info message to prevent enumeration
          setMessage(data.message || 'If a registration exists for this number, you can retrieve your ticket.');
          setPhoneNumber('');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 relative overflow-hidden">
      {/* Top glowing bar */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold font-outfit text-white">Retrieve Your Ticket</h2>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          Enter the phone number you used during registration.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-3 items-start animate-fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-4 bg-purple-950/25 border border-purple-500/20 rounded-xl text-purple-200 text-xs flex gap-3 items-start animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-400 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Registered Phone Number</label>
          <div className="relative flex items-center">
            {/* Visual prefix indicator */}
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
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
                className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-r-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
                required
              />
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block leading-tight mt-1">
            Your ticket will be retrieved from your existing registration.
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
              Searching...
            </>
          ) : (
            <>
              Find My Ticket
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
