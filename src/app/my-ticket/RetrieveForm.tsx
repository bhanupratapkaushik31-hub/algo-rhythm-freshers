'use client';

import React, { useState } from 'react';
import { User, Hash, Mail, Phone, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function RetrieveForm() {
  const [fullName, setFullName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = fullName.trim();
    const cleanRegNo = registrationNumber.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    if (!cleanName || !cleanRegNo || !cleanEmail || !cleanPhone) {
      setError('Please fill in all four fields to verify your registration.');
      return;
    }

    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/my-ticket/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: cleanName,
          registration_number: cleanRegNo,
          email: cleanEmail,
          phone: cleanPhone
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'The details do not match any registered ticket. Please check your information and try again.');
        setLoading(false);
      } else {
        // Successful 4-field verification -> reload/navigate to view ticket
        window.location.href = data.redirect || '/my-ticket';
      }
    } catch (err) {
      console.error('Ticket verification error:', err);
      setError('Network connection error. Please check your internet and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 relative overflow-hidden">
      {/* Top glowing bar */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold font-outfit text-white">
          Verify Your Registration
        </h2>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          Enter the same details you used during registration to securely access your ticket.
        </p>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-950/25 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-3 items-start animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Full Name */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
              required
            />
          </div>
        </div>

        {/* 2. Registration Number */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
            Registration Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Hash className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="e.g. 24BCSE101"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
              disabled={loading}
              className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 uppercase tracking-wider transition-colors outline-none"
              required
            />
          </div>
        </div>

        {/* 3. Email Address */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              placeholder="e.g. rahul@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
              required
            />
          </div>
        </div>

        {/* 4. Phone Number */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
            Phone Number
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-r-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
                required
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 disabled:from-purple-800/50 disabled:to-pink-800/50 text-white font-bold rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 transition-all outline-none text-xs uppercase tracking-wider cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying Details...
              </>
            ) : (
              <>
                VERIFY &amp; VIEW TICKET
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
