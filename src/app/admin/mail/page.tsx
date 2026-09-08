'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { 
  Mail, 
  Send, 
  Sparkles, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Search, 
  Filter, 
  Eye, 
  Ticket, 
  ArrowRight,
  Loader2,
  Check,
  Megaphone,
  UserCheck,
  Layers,
  FileText,
  Clock,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface Recipient {
  id: string;
  full_name: string;
  registration_number: string;
  year: string;
  email: string;
  phone: string;
  modeling: 'Yes' | 'No';
  modeling_talent?: string | null;
  ticket_id: string | null;
  email_sent: boolean;
  email_status: 'SENT' | 'FAILED' | 'PENDING' | null;
  email_error: string | null;
  email_sent_at: string | null;
  registration_status: 'PAID' | 'PENDING' | 'CANCELLED';
  created_at: string;
}

interface MailStats {
  totalActive: number;
  totalPaid: number;
  modelingYesCount: number;
  modelingNoCount: number;
  emailSentCount: number;
  emailFailedCount: number;
  emailPendingCount: number;
  filteredCount: number;
}

interface DispatchResult {
  id: string;
  name: string;
  email: string;
  success: boolean;
  error?: string;
}

export default function AdminMailSystemPage() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'broadcast'>('tickets');
  
  // Data States
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [stats, setStats] = useState<MailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('All');
  const [modelingFilter, setModelingFilter] = useState('All');
  const [emailStatusFilter, setEmailStatusFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('PAID');

  // Selection States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Broadcast Composer States
  const [broadcastSubject, setBroadcastSubject] = useState('Important Update: ALGO-RHYTHM 2K26 Fresher Party 🎉');
  const [broadcastSenderTitle, setBroadcastSenderTitle] = useState('ALGO-RHYTHM Organizing Team');
  const [broadcastMessage, setBroadcastMessage] = useState(
    `Hello {{name}},\n\nWe are excited to welcome you to ALGO-RHYTHM 2K26!\n\nPlease make sure to access and download your official digital entry ticket from our portal prior to arriving at the venue.\n\nEvent Details:\n• Date: 9 September 2026\n• Time: 1:00 PM onwards\n• Venue: Baldev Raj Mittal Unipolis\n\nShow your entry ticket QR code at the registration desks for smooth entry.`
  );
  const [broadcastButtonText, setBroadcastButtonText] = useState('View Official Portal');
  const [broadcastButtonUrl, setBroadcastButtonUrl] = useState('https://algo-rhythm-freshers.vercel.app/my-ticket');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Dispatch Execution & Progress States
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState<{
    total: number;
    completed: number;
    sent: number;
    failed: number;
  } | null>(null);
  const [dispatchResults, setDispatchResults] = useState<DispatchResult[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [singleDispatchingId, setSingleDispatchingId] = useState<string | null>(null);

  // 1. Fetch Recipients & Stats
  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        search,
        year: yearFilter,
        modeling: modelingFilter,
        email_status: emailStatusFilter,
        payment_status: paymentStatusFilter
      });

      const response = await fetch(`/api/admin/mail/recipients?${queryParams}`);
      const res = await response.json();

      if (response.ok && res.success) {
        setRecipients(res.data.recipients || []);
        setStats(res.data.stats || null);
        setErrorMsg(null);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load recipients.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to connect to the mail server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, [yearFilter, modelingFilter, emailStatusFilter, paymentStatusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecipients();
  };

  // Selection helpers
  const handleSelectAll = () => {
    if (selectedIds.size === recipients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recipients.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Quick Preset Handlers
  const applyPreset = (preset: 'ALL_PAID' | 'MODELING_YES' | 'MODELING_NO' | 'FAILED_EMAILS' | 'FIRST_YEARS') => {
    setSelectedIds(new Set());
    if (preset === 'ALL_PAID') {
      setPaymentStatusFilter('PAID');
      setModelingFilter('All');
      setYearFilter('All');
      setEmailStatusFilter('All');
    } else if (preset === 'MODELING_YES') {
      setPaymentStatusFilter('PAID');
      setModelingFilter('Yes');
      setYearFilter('All');
      setEmailStatusFilter('All');
    } else if (preset === 'MODELING_NO') {
      setPaymentStatusFilter('PAID');
      setModelingFilter('No');
      setYearFilter('All');
      setEmailStatusFilter('All');
    } else if (preset === 'FAILED_EMAILS') {
      setPaymentStatusFilter('PAID');
      setEmailStatusFilter('FAILED');
      setModelingFilter('All');
      setYearFilter('All');
    } else if (preset === 'FIRST_YEARS') {
      setPaymentStatusFilter('PAID');
      setYearFilter('1st Year');
      setModelingFilter('All');
      setEmailStatusFilter('All');
    }
  };

  // Template Presets for Custom Broadcast
  const applyTemplate = (templateName: 'CORRECTED_TICKET' | 'MODELING_CALL' | 'EVENT_GUIDELINES') => {
    if (templateName === 'CORRECTED_TICKET') {
      setBroadcastSubject('Corrected Access Link: Your ALGO-RHYTHM 2K26 Entry Ticket 🎉');
      setBroadcastSenderTitle('Official Ticket Delivery');
      setBroadcastMessage(
        `Hello {{name}},\n\nPlease use the updated button below to securely view, print, or download your official digital entry ticket for ALGO-RHYTHM – CSE Fresher Party 2026.\n\nYour Registration Details:\n• Registration No: {{reg_no}}\n• Year: {{year}}\n• Modeling Choice: {{modeling}}\n\nShow your entry ticket QR code at the entrance gates for direct check-in!`
      );
      setBroadcastButtonText('Retrieve Digital Ticket');
      setBroadcastButtonUrl('https://algo-rhythm-freshers.vercel.app/my-ticket');
    } else if (templateName === 'MODELING_CALL') {
      setBroadcastSubject('Call for Modeling Participants — ALGO-RHYTHM 2K26 🌟');
      setBroadcastSenderTitle('Modeling & Stage Coordination Team');
      setBroadcastMessage(
        `Hello {{name}},\n\nThank you for opting into the **ALGO-RHYTHM 2K26 Modeling Contest**!\n\nAudition & Rehearsal Briefing:\n• Venue: Baldev Raj Mittal Unipolis Stage\n• Date: 9 September 2026\n• Time: Please report to the stage coordinator desk at 12:00 PM sharp.\n\nDress Code & Performance:\nPlease ensure you are dressed according to the theme. If you have special music tracks or props, please inform our coordinators on arrival.\n\nFor questions, reach out to Bhanu Pratap Kaushik (8273930552).`
      );
      setBroadcastButtonText('Event Portal & Guidelines');
      setBroadcastButtonUrl('https://algo-rhythm-freshers.vercel.app/rules');
    } else if (templateName === 'EVENT_GUIDELINES') {
      setBroadcastSubject('Important Guidelines for ALGO-RHYTHM 2K26 🎊');
      setBroadcastSenderTitle('School of Computing & AI');
      setBroadcastMessage(
        `Hello {{name}},\n\nThe countdown to ALGO-RHYTHM 2K26 has begun! Here are a few essential guidelines for tomorrow:\n\n1. Gates open at 12:30 PM. The event starts promptly at 1:00 PM.\n2. Bring your Digital Ticket QR code on your mobile phone or printed format.\n3. University Student ID cards are required at the entrance.\n4. Free refreshments and exciting stage performances await you!\n\nLet's make this the most memorable fresher party ever!`
      );
      setBroadcastButtonText('View Event Guidelines');
      setBroadcastButtonUrl('https://algo-rhythm-freshers.vercel.app');
    }
  };

  // Dispatch Single Ticket Email
  const handleSingleTicketResend = async (reg: Recipient) => {
    setSingleDispatchingId(reg.id);
    try {
      const response = await fetch('/api/admin/mail/send-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: [reg.id] })
      });
      const res = await response.json();
      if (response.ok && res.success && res.data.sent > 0) {
        alert(`Success! Ticket email successfully sent to ${reg.full_name} (${reg.email}).`);
        fetchRecipients();
      } else {
        alert(`Failed to send email: ${res.data?.results?.[0]?.error || res.error?.message || 'Delivery error'}`);
      }
    } catch (err) {
      alert('Network error while dispatching single ticket.');
    } finally {
      setSingleDispatchingId(null);
    }
  };

  // Dispatch Bulk Ticket Resend
  const handleBulkTicketDispatch = async () => {
    const idsToSend = Array.from(selectedIds);
    if (idsToSend.length === 0) {
      alert('Please select at least one student to send ticket emails to.');
      return;
    }

    const confirmMsg = `Are you sure you want to resend official tickets with the corrected production URL to ${idsToSend.length} selected student(s)?\n\n• Delivery pacing: 1 email per second (protects Gmail deliverability)\n• Estimated duration: ~${Math.ceil(idsToSend.length / 60)} minute(s)`;
    if (!window.confirm(confirmMsg)) return;

    setIsDispatching(true);
    setDispatchProgress({
      total: idsToSend.length,
      completed: 0,
      sent: 0,
      failed: 0
    });
    setDispatchResults([]);

    try {
      const response = await fetch('/api/admin/mail/send-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: idsToSend })
      });
      const res = await response.json();

      if (response.ok && res.success) {
        setDispatchResults(res.data.results || []);
        setDispatchProgress({
          total: res.data.totalProcessed,
          completed: res.data.totalProcessed,
          sent: res.data.sent,
          failed: res.data.failed
        });
        setShowResultsModal(true);
        fetchRecipients();
      } else {
        alert(res.error?.message || 'Bulk ticket dispatch failed.');
      }
    } catch (err) {
      alert('Network error during bulk ticket dispatch.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Dispatch Custom Broadcast Email
  const handleCustomBroadcastDispatch = async () => {
    const idsToSend = Array.from(selectedIds);
    if (idsToSend.length === 0) {
      alert('Please select at least one student recipient for this broadcast.');
      return;
    }

    if (!broadcastSubject.trim()) {
      alert('Please provide an email subject.');
      return;
    }

    if (!broadcastMessage.trim()) {
      alert('Please provide an email message body.');
      return;
    }

    const confirmMsg = `Send this announcement broadcast to ${idsToSend.length} selected attendee(s)?\n\nSubject: "${broadcastSubject}"\n• Delivery pacing: 1 email per second (protects Gmail deliverability)\n• Estimated duration: ~${Math.ceil(idsToSend.length / 60)} minute(s)`;
    if (!window.confirm(confirmMsg)) return;

    setIsDispatching(true);
    setDispatchProgress({
      total: idsToSend.length,
      completed: 0,
      sent: 0,
      failed: 0
    });
    setDispatchResults([]);

    try {
      const response = await fetch('/api/admin/mail/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationIds: idsToSend,
          subject: broadcastSubject,
          message: broadcastMessage,
          senderTitle: broadcastSenderTitle,
          buttonText: broadcastButtonText,
          buttonUrl: broadcastButtonUrl
        })
      });
      const res = await response.json();

      if (response.ok && res.success) {
        setDispatchResults(res.data.results || []);
        setDispatchProgress({
          total: res.data.totalProcessed,
          completed: res.data.totalProcessed,
          sent: res.data.sent,
          failed: res.data.failed
        });
        setShowResultsModal(true);
        fetchRecipients();
      } else {
        alert(res.error?.message || 'Broadcast dispatch failed.');
      }
    } catch (err) {
      alert('Network error during broadcast dispatch.');
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <AdminLayout requiredRoles={['super_admin', 'admin']}>
      
      {/* Title & Stats Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold uppercase tracking-wider mb-2">
            <Mail className="w-3.5 h-3.5" />
            Email Dispatch & Broadcast Center
          </div>
          <h1 className="text-3xl font-extrabold font-outfit text-white tracking-tight">Mail Sending System</h1>
          <p className="text-slate-400 text-xs mt-1">
            Resend official ticket links with verified production URLs, broadcast custom static announcements, or reach out to Modeling participants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecipients}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-4 rounded-2xl border-white/5 bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Paid Members</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white font-outfit">{stats?.totalPaid ?? '...'}</span>
            <span className="text-[10px] text-emerald-400 font-bold">Confirmed</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border-white/5 bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Modeling "Yes"</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-pink-400 font-outfit">{stats?.modelingYesCount ?? '...'}</span>
            <span className="text-[10px] text-pink-300/70 font-semibold">Participants</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border-white/5 bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Tickets Delivered</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-400 font-outfit">{stats?.emailSentCount ?? '...'}</span>
            <span className="text-[10px] text-purple-300/70 font-semibold">Sent</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border-white/5 bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Failed / Pending</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-400 font-outfit">{stats?.emailFailedCount ?? '...'}</span>
            <span className="text-[10px] text-amber-300/70 font-semibold">Needs Resend</span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-white/10 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2.5 px-6 py-3.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'tickets'
              ? 'border-purple-500 text-white bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Ticket className={`w-4 h-4 ${activeTab === 'tickets' ? 'text-purple-400' : ''}`} />
          1. Resend Official Tickets (Corrected Link)
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2.5 px-6 py-3.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'broadcast'
              ? 'border-pink-500 text-white bg-pink-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Megaphone className={`w-4 h-4 ${activeTab === 'broadcast' ? 'text-pink-400' : ''}`} />
          2. Custom Announcement Broadcast
        </button>
      </div>

      {/* Mode Banner / Instructions */}
      {activeTab === 'tickets' ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/20 to-transparent border border-purple-500/20 mb-6 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300">
            <strong className="text-white block font-outfit mb-0.5">Ticket Resend Mode</strong>
            Resends the official digital entry ticket email with the corrected live link (<span className="text-purple-300 font-mono text-[11px]">https://algo-rhythm-freshers.vercel.app/ticket/...</span>). You can select all students, filter for Modeling participants, or click "Resend" on any single student below.
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-950/40 via-purple-950/20 to-transparent border border-pink-500/20 mb-6 flex items-start gap-3">
          <Megaphone className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300">
            <strong className="text-white block font-outfit mb-0.5">Custom Announcement Mode</strong>
            Compose a static broadcast email to send to selected students. Supports personalized variables like <span className="text-pink-300 font-mono text-[11px]">&#123;&#123;name&#125;&#125;</span>, <span className="text-pink-300 font-mono text-[11px]">&#123;&#123;reg_no&#125;&#125;</span>, and <span className="text-pink-300 font-mono text-[11px]">&#123;&#123;year&#125;&#125;</span>.
          </div>
        </div>
      )}

      {/* Broadcast Composer (Active only on Tab 2) */}
      {activeTab === 'broadcast' && (
        <div className="glass-card rounded-2xl p-6 mb-8 border border-pink-500/20 bg-black/20 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold font-outfit text-white">Compose Announcement</h3>
              <p className="text-slate-400 text-xs">Fill in your subject and message. You can use pre-built templates for fast setup.</p>
            </div>
            
            {/* Template Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Templates:</span>
              <button
                type="button"
                onClick={() => applyTemplate('CORRECTED_TICKET')}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold border border-white/10 cursor-pointer"
              >
                Ticket Notice
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('MODELING_CALL')}
                className="px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 text-[11px] font-bold border border-pink-500/20 cursor-pointer"
              >
                Modeling Audition
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('EVENT_GUIDELINES')}
                className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-bold border border-purple-500/20 cursor-pointer"
              >
                Event Guidelines
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Header Sender Title
              </label>
              <input
                type="text"
                value={broadcastSenderTitle}
                onChange={(e) => setBroadcastSenderTitle(e.target.value)}
                placeholder="e.g. Modeling Stage Coordinators"
                className="w-full bg-[#0a0520] border border-white/10 focus:border-pink-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Email Subject Line
              </label>
              <input
                type="text"
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                placeholder="Subject of the email"
                className="w-full bg-[#0a0520] border border-white/10 focus:border-pink-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Message Body
              </label>
              <span className="text-[10px] text-slate-500">
                Variables: <code className="text-pink-300">&#123;&#123;name&#125;&#125;</code>, <code className="text-pink-300">&#123;&#123;reg_no&#125;&#125;</code>, <code className="text-pink-300">&#123;&#123;year&#125;&#125;</code>
              </span>
            </div>
            <textarea
              rows={6}
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Write your email message..."
              className="w-full bg-[#0a0520] border border-white/10 focus:border-pink-500 rounded-xl p-3.5 text-xs text-white leading-relaxed outline-none resize-y"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Action Button Text (Optional)
              </label>
              <input
                type="text"
                value={broadcastButtonText}
                onChange={(e) => setBroadcastButtonText(e.target.value)}
                placeholder="e.g. View Ticket Portal"
                className="w-full bg-[#0a0520] border border-white/10 focus:border-pink-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Action Button URL (Optional)
              </label>
              <input
                type="text"
                value={broadcastButtonUrl}
                onChange={(e) => setBroadcastButtonUrl(e.target.value)}
                placeholder="https://algo-rhythm-freshers.vercel.app/my-ticket"
                className="w-full bg-[#0a0520] border border-white/10 focus:border-pink-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Email Layout
            </button>
          </div>
        </div>
      )}

      {/* Audience Filter Presets */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Quick Presets:
          </span>
          <button
            onClick={() => applyPreset('ALL_PAID')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              paymentStatusFilter === 'PAID' && modelingFilter === 'All' && yearFilter === 'All' && emailStatusFilter === 'All'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            All Confirmed Paid ({stats?.totalPaid ?? 0})
          </button>
          <button
            onClick={() => applyPreset('MODELING_YES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              modelingFilter === 'Yes'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                : 'bg-pink-500/10 border border-pink-500/20 text-pink-300 hover:bg-pink-500/20'
            }`}
          >
            🎭 Modeling "Yes" ({stats?.modelingYesCount ?? 0})
          </button>
          <button
            onClick={() => applyPreset('MODELING_NO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              modelingFilter === 'No'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            Modeling "No" ({stats?.modelingNoCount ?? 0})
          </button>
          <button
            onClick={() => applyPreset('FIRST_YEARS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              yearFilter === '1st Year'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            🎓 1st Year (Freshers)
          </button>
          <button
            onClick={() => applyPreset('FAILED_EMAILS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              emailStatusFilter === 'FAILED'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            ⚠️ Failed Emails ({stats?.emailFailedCount ?? 0})
          </button>
        </div>

        {/* Detailed Filters & Search Row */}
        <div className="glass-card rounded-2xl p-4 border-white/5 bg-white/[0.02] flex flex-col md:flex-row items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, registration no, or email..."
              className="w-full bg-[#0a0520] border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Year Dropdown */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-[#0a0520] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="All">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
            </select>

            {/* Modeling Dropdown */}
            <select
              value={modelingFilter}
              onChange={(e) => setModelingFilter(e.target.value)}
              className="bg-[#0a0520] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="All">Modeling: All</option>
              <option value="Yes">Modeling: Yes</option>
              <option value="No">Modeling: No</option>
            </select>

            {/* Email Status Dropdown */}
            <select
              value={emailStatusFilter}
              onChange={(e) => setEmailStatusFilter(e.target.value)}
              className="bg-[#0a0520] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="All">Email: All</option>
              <option value="SENT">Sent Successfully</option>
              <option value="FAILED">Failed Deliveries</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recipient Selection Toolbar */}
      <div className="glass-card rounded-2xl p-4 border border-purple-500/20 bg-gradient-to-r from-purple-950/20 to-pink-950/20 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recipients.length > 0 && selectedIds.size === recipients.length}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 bg-[#0a0520] cursor-pointer"
            />
            Select All ({recipients.length} matching)
          </label>

          <span className="text-xs text-slate-400">
            • <strong className="text-purple-300">{selectedIds.size}</strong> student(s) selected
          </span>
        </div>

        <div>
          {activeTab === 'tickets' ? (
            <button
              onClick={handleBulkTicketDispatch}
              disabled={selectedIds.size === 0 || isDispatching}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-purple-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isDispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Resend Tickets to {selectedIds.size} Student(s)
            </button>
          ) : (
            <button
              onClick={handleCustomBroadcastDispatch}
              disabled={selectedIds.size === 0 || isDispatching}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-pink-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isDispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Broadcast to {selectedIds.size} Student(s)
            </button>
          )}
        </div>
      </div>

      {/* Recipients Table */}
      <div className="glass-card rounded-2xl overflow-hidden mb-6 relative">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse text-xs text-slate-300">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={recipients.length > 0 && selectedIds.size === recipients.length}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-white/20 text-purple-600 bg-[#0a0520] cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Student Name</th>
                <th className="px-4 py-3.5">Registration No</th>
                <th className="px-4 py-3.5">Year</th>
                <th className="px-4 py-3.5">Email Address</th>
                <th className="px-4 py-3.5">Modeling</th>
                <th className="px-4 py-3.5">Ticket ID</th>
                <th className="px-4 py-3.5">Email Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin mx-auto mb-2" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Loading Audience Database...</span>
                  </td>
                </tr>
              ) : recipients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No students matched the selected filters.
                  </td>
                </tr>
              ) : (
                recipients.map((reg) => {
                  const isSelected = selectedIds.has(reg.id);
                  return (
                    <tr
                      key={reg.id}
                      onClick={() => toggleSelect(reg.id)}
                      className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${
                        isSelected ? 'bg-purple-600/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(reg.id)}
                          className="w-3.5 h-3.5 rounded border-white/20 text-purple-600 bg-[#0a0520] cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white truncate max-w-[150px]">{reg.full_name}</div>
                        <div className="text-[10px] text-slate-400">{reg.phone}</div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-300 font-semibold">{reg.registration_number}</td>

                      <td className="px-4 py-3.5">{reg.year}</td>

                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-200 truncate max-w-[170px] block">{reg.email}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          reg.modeling === 'Yes' 
                            ? 'bg-pink-500/10 text-pink-300 border border-pink-500/20' 
                            : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {reg.modeling}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-purple-300 text-xs">
                        {reg.ticket_id || 'N/A'}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          reg.email_status === 'SENT' || reg.email_sent
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : reg.email_status === 'FAILED'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {reg.email_status === 'SENT' || reg.email_sent ? 'Sent' : reg.email_status === 'FAILED' ? 'Failed' : 'Pending'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleSingleTicketResend(reg)}
                          disabled={singleDispatchingId === reg.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                          title="Resend Ticket Email to this student"
                        >
                          {singleDispatchingId === reg.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                          ) : (
                            <Send className="w-3 h-3 text-purple-400" />
                          )}
                          Resend Ticket
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Email Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPreviewModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-2xl bg-[#0d0620] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center px-6 py-4 bg-[#120b2e] border-b border-white/5">
              <h3 className="font-bold font-outfit text-white text-sm">Live Broadcast Email Preview</h3>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="text-xs bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                <p><span className="text-slate-500">From:</span> ALGO-RHYTHM &lt;scailpu@gmail.com&gt;</p>
                <p><span className="text-slate-500">Subject:</span> <strong className="text-white">{broadcastSubject}</strong></p>
              </div>

              {/* Mock Render of the Template */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-[#120b2e]">
                <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-6 text-center text-white">
                  <h2 className="text-xl font-extrabold uppercase tracking-wider m-0">ALGO-RHYTHM 2K26</h2>
                  <p className="text-xs font-semibold text-white/90 mt-1">{broadcastSenderTitle}</p>
                </div>

                <div className="p-6 text-sm text-slate-200 space-y-4">
                  <p className="text-pink-400 font-bold text-base">Hello Ayush Sharma (Sample Student),</p>
                  
                  <div className="whitespace-pre-line leading-relaxed text-slate-300">
                    {broadcastMessage
                      .replace(/\{\{name\}\}/g, 'Ayush Sharma')
                      .replace(/\{\{reg_no\}\}/g, '12601928')
                      .replace(/\{\{year\}\}/g, '1st Year')
                      .replace(/\{\{modeling\}\}/g, 'Yes')}
                  </div>

                  {broadcastButtonText && broadcastButtonUrl && (
                    <div className="text-center py-4">
                      <span className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg">
                        {broadcastButtonText}
                      </span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 text-center border-t border-white/5 pt-4 mt-6">
                    For any queries, contact Bhanu Pratap Kaushik (8273930552) or Vaidya Vaibhava (9441262727).
                  </p>
                </div>

                <div className="bg-[#0b051c] p-3 text-center text-[10px] text-slate-500 border-t border-white/5">
                  &copy; 2026 School of Computing and Artificial Intelligence. All rights reserved.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Results & Progress Modal */}
      {showResultsModal && dispatchProgress && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowResultsModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-xl bg-[#0a0520] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold font-outfit text-white text-base">Dispatch Execution Complete</h3>
              </div>
              <button 
                onClick={() => setShowResultsModal(false)}
                className="p-1 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Processed</span>
                <span className="text-xl font-bold text-white font-outfit">{dispatchProgress.total}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-bold text-emerald-400 uppercase block">Sent Successfully</span>
                <span className="text-xl font-bold text-emerald-300 font-outfit">{dispatchProgress.sent}</span>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <span className="text-[10px] font-bold text-red-400 uppercase block">Failed Deliveries</span>
                <span className="text-xl font-bold text-red-300 font-outfit">{dispatchProgress.failed}</span>
              </div>
            </div>

            {/* Delivery Logs List */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivery Breakdown</h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/5 text-xs">
                {dispatchResults.map((r, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-white/5 last:border-none">
                    <div className="truncate max-w-[280px]">
                      <span className="font-bold text-white">{r.name}</span>{' '}
                      <span className="text-slate-400 font-mono text-[10px]">({r.email})</span>
                    </div>
                    <div>
                      {r.success ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          SENT
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded" title={r.error}>
                          FAILED: {r.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowResultsModal(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}

export const dynamic = 'force-dynamic';
