'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Mail, Lock, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminLogin() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. If already logged in, redirect to dashboard
  useEffect(() => {
    supabase.auth.getSession().then((res: any) => {
      const session = res.data?.session;
      if (session) {
        fetch('/api/admin/profile', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        .then(r => r.json())
        .then((res2: any) => {
          if (res2.success && res2.data) {
            if (['scanner', 'coordinator'].includes(res2.data.role)) {
              router.push('/coordinator/scanner');
            } else {
              router.push('/admin');
            }
          } else {
            router.push('/admin');
          }
        });
      }
    });
  }, [router]);

  // 2. Handle Login Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authErr) {
        setError(authErr.message || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      if (data.session) {
        // Set the secure access token cookie so server API routes can verify admin roles
        const session = data.session;
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax`;
        
        // Fetch role to redirect correctly
        const response = await fetch('/api/admin/profile', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        const res = await response.json();

        if (res.success && res.data && ['scanner', 'coordinator'].includes(res.data.role)) {
          router.push('/coordinator/scanner');
        } else {
          router.push('/admin');
        }
      } else {
        setError('Failed to establish session.');
        setLoading(false);
      }

    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong during login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative">
      
      {/* Back button */}
      <div className="w-full max-w-md mb-6">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Homepage
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-card rounded-2xl p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4 purple-glow">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-white font-outfit tracking-tight">Admin Gateway</h1>
          <p className="text-slate-400 text-xs mt-1">Authorized personnel only.</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3.5 bg-red-950/20 border border-red-500/20 text-red-200 text-xs rounded-xl flex gap-2.5 items-start"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email field */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Email Address</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                placeholder="admin@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 transition-colors outline-none"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Password</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 transition-colors outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 text-xs uppercase tracking-wider text-white transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

        </form>
      </motion.div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
