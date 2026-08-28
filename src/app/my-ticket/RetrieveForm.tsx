'use client';

import React, { useState } from 'react';
import { Mail, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function RetrieveForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/my-ticket/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Something went wrong. Please try again.');
      } else {
        setMessage(data.message || 'Verification link sent!');
        setEmail('');
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
          Enter the email address you used during registration. We'll send you a secure magic link to access your tickets.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-3 items-start">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs flex gap-3 items-start">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Registered Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              placeholder="e.g. rahul@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || !!message}
              className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !!message}
          className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 disabled:from-purple-800/50 disabled:to-pink-800/50 text-white font-bold rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 transition-all outline-none text-xs uppercase tracking-wider cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending Link...
            </>
          ) : (
            <>
              Send Verification Link
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
