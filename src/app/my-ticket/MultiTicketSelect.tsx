'use client';

import React from 'react';
import { Ticket, ArrowRight, User, LogOut } from 'lucide-react';
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
  email: string;
}

export default function MultiTicketSelect({ tickets, email }: MultiTicketSelectProps) {
  const router = useRouter();

  const handleSelect = (token: string) => {
    // Set cookie for student_ticket_token
    document.cookie = `student_ticket_token=${token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax; Secure`;
    // Force Next.js to refresh the Server Component state
    router.refresh();
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
          We found {tickets.length} registrations matching <strong className="text-slate-200">{email}</strong>. Select which ticket you want to view:
        </p>

        {/* Tickets list */}
        <div className="mt-6 space-y-3">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t.ticket_token)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-purple-500/30 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-300">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-outfit leading-tight group-hover:text-purple-300 transition-colors">
                    {t.full_name}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">
                    {t.registration_number} &bull; {t.ticket_id}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-300 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
          <a
            href="/api/my-ticket/logout"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider"
          >
            <LogOut className="w-3.5 h-3.5" />
            Use Another Email
          </a>
        </div>
      </div>
    </div>
  );
}
