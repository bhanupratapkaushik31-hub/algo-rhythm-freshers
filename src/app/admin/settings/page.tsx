'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { 
  ToggleLeft, 
  ToggleRight, 
  Loader2, 
  AlertCircle,
  Settings,
  Sparkles,
  Info,
  Calendar,
  Clock,
  MapPin,
  HelpCircle
} from 'lucide-react';
import { EVENT_CONFIG } from '@/config/event';

export default function AdminSettings() {
  const [isRegOpen, setIsRegOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setError(null);
    try {
      const response = await fetch('/api/admin/settings');
      const res = await response.json();

      if (response.ok && res.success) {
        setIsRegOpen(res.data.open);
      } else {
        throw new Error(res.error?.message || 'Failed to fetch settings.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async () => {
    setToggleLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: !isRegOpen }),
      });

      const res = await response.json();

      if (response.ok && res.success) {
        setIsRegOpen(res.data.open);
      } else {
        throw new Error(res.error?.message || 'Failed to toggle portal state.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error updating settings.');
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <AdminLayout requiredRoles={['super_admin', 'admin']}>
      
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold font-outfit text-white tracking-tight flex items-center gap-2">
          <Settings className="w-8 h-8 text-purple-400" />
          Portal Configurations
        </h1>
        <p className="text-slate-400 text-xs mt-1">Configure event rules, registration portal locks, and view details.</p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold font-outfit">Loading Configs...</p>
        </div>
      ) : (
        <div className="space-y-8 max-w-2xl">
          
          {error && (
            <div className="p-4 bg-red-950/20 border border-red-500/20 text-red-200 text-xs rounded-2xl flex gap-3 items-start">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Registration Lock Section */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="space-y-1">
              <h3 className="text-base font-bold font-outfit text-white">Student Registration Gate</h3>
              <p className="text-slate-400 text-xs">
                Toggle whether students are allowed to fill in forms and complete ticket checkouts.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isRegOpen 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {isRegOpen ? 'Open for Bookings' : 'Closed/Locked'}
              </span>
              <button
                onClick={handleToggle}
                disabled={toggleLoading}
                className="text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {toggleLoading ? (
                  <Loader2 className="w-9 h-9 animate-spin" />
                ) : isRegOpen ? (
                  <ToggleRight className="w-10 h-10 text-purple-500" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-600" />
                )}
              </button>
            </div>
          </div>

          {/* Read-Only Event Configuration Details Card */}
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <h3 className="text-base font-bold font-outfit text-white flex items-center gap-2 border-b border-white/5 pb-4">
              <Info className="w-5 h-5 text-indigo-400" />
              Central Event Metadata (Read-Only)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-300">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Event Title</span>
                <p className="font-bold text-white leading-relaxed">{EVENT_CONFIG.title}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Hosted By</span>
                <p className="font-bold text-white">{EVENT_CONFIG.hostedBy}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Scheduled Date</span>
                <p className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  {EVENT_CONFIG.displayDate}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Scheduled Time</span>
                <p className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  {EVENT_CONFIG.displayTime}
                </p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Venue Location</span>
                <p className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  {EVENT_CONFIG.venue}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Registration Entry Fee</span>
                <p className="font-extrabold text-amber-500 text-gradient-gold">₹100 (1st Year) / ₹200 (2nd Year)</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Contact Personnels</span>
                <div className="space-y-1 mt-1 text-slate-400">
                  {EVENT_CONFIG.contacts.map((c, i) => (
                    <div key={i}>
                      <strong>{c.name}:</strong> {c.phone}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-slate-500 leading-normal">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>Event metadata values are centralized in configuration variables. Re-deployment is required to adjust fees or venue titles.</span>
            </div>
          </div>

        </div>
      )}

    </AdminLayout>
  );
}
export const dynamic = 'force-dynamic';
