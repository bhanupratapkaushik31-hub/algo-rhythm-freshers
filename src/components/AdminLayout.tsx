'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Admin } from '@/types';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  ScanQrCode, 
  Settings, 
  LogOut, 
  Loader2, 
  ShieldAlert, 
  Menu, 
  X,
  Sparkles,
  Trash2
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  requiredRoles?: ('super_admin' | 'admin' | 'scanner')[];
}

export default function AdminLayout({ children, requiredRoles }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Admin | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  // 1. Auth check and profile fetch
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
          router.push('/admin/login');
          return;
        }

        // Keep server session cookie synchronized
        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in || 3600}; SameSite=Lax${isSecure ? '; Secure' : ''}`;

        // Fetch custom admin role details via server-side endpoint to bypass RLS recursion errors
        const response = await fetch('/api/admin/profile', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        const res = await response.json();

        if (!response.ok || !res.success) {
          console.error('Error fetching admin record:', res.error);
          setUnauthorized(true);
          setLoading(false);
          return;
        }

        const adminRecord = res.data;
        setProfile(adminRecord as Admin);

        // Check if page requires specific roles
        if (requiredRoles && !requiredRoles.includes(adminRecord.role as any)) {
          // If scanner/coordinator trying to access full admin pages, auto-redirect to coordinator scanner
          if (['scanner', 'coordinator'].includes(adminRecord.role) && pathname !== '/admin/scanner') {
            router.push('/coordinator/scanner');
            return;
          }
          setUnauthorized(true);
        }

        setLoading(false);
      } catch (err) {
        console.error('Admin layout auth crash:', err);
        router.push('/admin/login');
      }
    };

    checkAuth();
  }, [router, pathname, requiredRoles]);

  // 2. Handle Sign Out
  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    
    // Erase the secure session cookie
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center gap-4 bg-[#060214]">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Loading Administrative Control...</p>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center px-4 bg-[#060214]">
        <div className="w-full max-w-md glass-card rounded-2xl p-8 text-center border-red-500/20">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold font-outfit text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            You do not have the required permissions to view this dashboard page. (Your role: <span className="text-pink-400 font-bold uppercase">{profile?.role}</span>).
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleSignOut}
              className="flex-1 inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-wider rounded-xl text-white cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            {profile?.role === 'scanner' && (
              <Link
                href="/admin/scanner"
                className="flex-1 inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-xs uppercase tracking-wider rounded-xl text-white"
              >
                <ScanQrCode className="w-4 h-4" />
                QR Scanner
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Links definitions
  const sidebarLinks = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      roles: ['super_admin', 'admin'],
    },
    {
      name: 'Registrations',
      href: '/admin/registrations',
      icon: Users,
      roles: ['super_admin', 'admin'],
    },
    {
      name: 'Coordinators',
      href: '/admin/coordinators',
      icon: Users,
      roles: ['super_admin', 'admin'],
    },
    {
      name: 'Deleted Data',
      href: '/admin/deleted',
      icon: Trash2,
      roles: ['super_admin', 'admin'],
    },
    {
      name: 'QR Scanner',
      href: '/admin/scanner',
      icon: ScanQrCode,
      roles: ['super_admin', 'admin', 'scanner'],
    },
  ];

  const allowedLinks = sidebarLinks.filter(link => profile && link.roles.includes(profile.role));

  return (
    <div className="flex-1 min-h-screen flex flex-col md:flex-row bg-[#060214] text-slate-100 font-sans">
      
      {/* 1. Header (Mobile Top bar) */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-[#0a0522] border-b border-white/5 z-20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="font-extrabold font-outfit text-sm tracking-widest text-gradient-indigo-purple">ALGO-RHYTHM</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-slate-300"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* 2. Sidebar Navigation (Laptops & Desktops) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#08031d] border-r border-white/5 p-6 shrink-0 relative">
        {/* Glow corner overlay */}
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-purple-500/10 via-transparent to-transparent" />
        
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-10 pb-6 border-b border-white/5">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-widest font-outfit text-white uppercase leading-none">ALGO-RHYTHM</h4>
            <span className="text-[9px] text-purple-300 font-medium tracking-wide uppercase">CSE Freshers 2026</span>
          </div>
        </div>

        {/* User profile brief */}
        <div className="mb-8 p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
          <p className="font-bold text-white truncate font-outfit">{profile?.name}</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{profile?.email}</p>
          <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-300 uppercase tracking-wider">
            {profile?.role.replace('_', ' ')}
          </span>
        </div>

        {/* Links list */}
        <nav className="space-y-1.5 flex-1">
          {allowedLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                  active 
                    ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-purple-200 shadow-md shadow-purple-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-purple-400' : 'text-slate-400'}`} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Logout bottom */}
        <div className="pt-6 border-t border-white/5">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/5 hover:text-red-300 border border-transparent transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* 3. Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[60px] bg-black/60 backdrop-blur-sm z-30 flex flex-col p-6 animate-fade-in">
          <div className="w-full bg-[#0a0522] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
            {/* User profile */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs">
              <p className="font-bold text-white font-outfit">{profile?.name}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{profile?.email}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-300 uppercase tracking-wider">
                {profile?.role.replace('_', ' ')}
              </span>
            </div>

            {/* Links */}
            <nav className="flex flex-col gap-1.5">
              {allowedLinks.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      active 
                        ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-purple-200'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            {/* Logout */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleSignOut();
              }}
              className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* 4. Main Page View Container */}
      <main className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto max-w-full">
        {children}
      </main>

    </div>
  );
}
export const dynamic = 'force-dynamic';
