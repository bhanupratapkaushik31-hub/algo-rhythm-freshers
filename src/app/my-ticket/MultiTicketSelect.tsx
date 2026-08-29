'use client';

import React, { useState } from 'react';
import { Ticket, ArrowRight, User, LogOut, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TicketItem {
  id: string;
  full_name: string;
  registration_number: string;
  ticket_id: string;
  ticket_token: string;
}

interface MultiTicketSelectProps {
  tickets: TicketItem[];
  phone: string;
}

export default function MultiTicketSelect({ tickets, phone }: MultiTicketSelectProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = (ticket: TicketItem) => {
    if (loadingId) return; // Prevent double clicks
    setLoadingId(ticket.id);

    try {
      // Set cookie for student_ticket_token for fallback and session persistence
      const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
      document.cookie = `student_ticket_token=${ticket.ticket_token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    } catch (e) {
      console.warn('Could not set student_ticket_token cookie:', e);
    }

    // Direct, unambiguous navigation to the specific registration
    router.push(`/my-ticket?registration_id=${encodeURIComponent(ticket.id)}`);
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="glass-card rounded-2xl p-8 relative overflow-hidden text-center">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
        
        <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ticket className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold font-outfit text-white">Multiple Tickets Found</h2>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          We found {tickets.length} registrations matching phone number <strong className="text-slate-200">+91 {phone}</strong>. Select which ticket you want to view:
        </p>

        {/* Tickets list */}
        <div className="mt-6 space-y-3" role="list" aria-label="List of student tickets">
          {tickets.map((t) => {
            const isCurrentLoading = loadingId === t.id;
            const isAnyLoading = loadingId !== null;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelect(t)}
                disabled={isAnyLoading}
                aria-label={`Open ticket for ${t.full_name} (${t.ticket_id})`}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  isCurrentLoading
                    ? 'bg-purple-950/40 border-purple-500/50 cursor-wait'
                    : isAnyLoading
                    ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 cursor-pointer active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${isCurrentLoading ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-500/10 text-purple-300 group-hover:bg-purple-500/20'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-outfit leading-tight group-hover:text-purple-300 transition-colors">
                      {t.full_name}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">
                      {t.registration_number} &bull; <span className="text-purple-400 font-semibold">{t.ticket_id}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isCurrentLoading ? (
                    <div className="flex items-center gap-1.5 text-purple-400 text-xs font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-[11px] hidden sm:inline">Opening...</span>
                    </div>
                  ) : (
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-300 group-hover:translate-x-1 transition-all" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
          <a
            href="/api/my-ticket/logout"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider"
          >
            <LogOut className="w-3.5 h-3.5" />
            Use Another Number
          </a>
        </div>
      </div>
    </div>
  );
}

