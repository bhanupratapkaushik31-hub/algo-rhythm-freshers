'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Eye, 
  RotateCcw, 
  Trash2, 
  CreditCard,
  X, 
  Loader2, 
  CheckCircle, 
  Clock, 
  XCircle,
  QrCode,
  AlertTriangle,
  UserCheck,
  Users,
  Mail,
  RefreshCw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

interface EntryLog {
  id: string;
  registration_id: string;
  action: 'ENTRY' | 'RE_ENTRY';
  scanned_at: string;
  scanned_by: string | null;
  scanner_device: string | null;
  created_at?: string;
}

interface RegistrationDetail {
  id: string;
  ticket_id: string | null;
  ticket_token: string;
  registration_number: string;
  full_name: string;
  year: '1st Year' | '2nd Year';
  school_name: string;
  modeling: 'Yes' | 'No';
  modeling_talent?: string | null;
  phone: string;
  email: string;
  registration_status: 'PENDING' | 'PAID' | 'CANCELLED';
  entry_status: 'ENTERED' | 'NOT_ENTERED';
  entry_time: string | null;
  entry_scanned_by: string | null;
  razorpay_payment_id: string | null;
  payment_time: string | null;
  created_at: string;
  deleted_at?: string | null;
  is_deleted?: boolean;
  payment_method: string | null;
  email_sent: boolean;
  email_status: 'PENDING' | 'SENT' | 'FAILED' | null;
  email_error: string | null;
  email_sent_at: string | null;
  photo_path?: string | null;
  photo_url?: string | null;
  entry_logs?: EntryLog[];
}

export default function AdminDeletedData() {
  const [list, setList] = useState<RegistrationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [pages, setPages] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('All');
  const [modeling, setModeling] = useState('All');
  const [school, setSchool] = useState('');

  // Sorting States
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Inspector Drawer States
  const [selectedReg, setSelectedReg] = useState<RegistrationDetail | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<EntryLog[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adminRole, setAdminRole] = useState<'super_admin' | 'admin' | 'scanner' | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Fetch logged in admin role
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
          if (res2.success && res2.data) setAdminRole(res2.data.role as any);
        });
      }
    });
  }, []);

  // 1. Fetch Deleted Registrations list from backend
  const fetchDeletedRegistrations = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        year,
        modeling,
        school,
        sortBy,
        sortOrder,
        deleted: 'true'
      });

      const response = await fetch(`/api/admin/registrations?${queryParams}`);
      const res = await response.json();

      if (response.ok && res.success) {
        setList(res.data.registrations);
        setTotal(res.data.total);
        setPages(res.data.pages);
        setErrorMsg(null);
      } else {
        console.error('Fetch error:', res.error);
        setErrorMsg(res.error?.message || 'Failed to load deleted registrations.');
      }
    } catch (err) {
      console.error('Failed to load deleted registrations:', err);
      setErrorMsg('Failed to load deleted registrations. Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedRegistrations();
  }, [page, year, modeling, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDeletedRegistrations();
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleSelectRegistration = async (reg: RegistrationDetail) => {
    setSelectedReg(reg);
    setSelectedLogs([]);
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/admin/registrations/${reg.id}`);
      const res = await response.json();
      if (response.ok && res.success && res.data) {
        setSelectedReg(prev => prev ? { ...prev, ...res.data } : res.data);
        if (res.data.entry_logs) {
          setSelectedLogs(res.data.entry_logs);
        }
      }
    } catch (err) {
      console.error('Failed to load registration details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 2. Mark as Paid & Restore back to active registrations
  const handleMarkAsPaid = async (reg: RegistrationDetail) => {
    const feeInr = reg.year === '2nd Year' ? 200 : 100;
    const confirmMsg = `Are you sure you want to mark this attendee as PAID and restore them?\n\n` +
      `• Student: ${reg.full_name} (${reg.registration_number})\n` +
      `• Year & Fee: ${reg.year} (₹${feeInr})\n` +
      `• Email: ${reg.email}\n\n` +
      `This action will:\n` +
      `1. Restore registration to active registrations list\n` +
      `2. Set Registration Status to PAID\n` +
      `3. Create/update Payment record to SUCCESS\n` +
      `4. Generate ticket & send confirmation email with QR code`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setMarkingPaidId(reg.id);
    try {
      const response = await fetch(`/api/admin/registrations/${reg.id}/mark-paid`, {
        method: 'POST'
      });
      const res = await response.json();

      if (response.ok && res.success) {
        const emailNotice = res.data?.email_sent 
          ? `\n\nTicket confirmation email was dispatched to ${reg.email}.`
          : (res.data?.email_error ? `\n\nNote: Email dispatch message - ${res.data.email_error}` : '');
        alert(`Success! ${reg.full_name} has been marked as PAID and restored to active registrations.${emailNotice}`);
        setSelectedReg(null);
        fetchDeletedRegistrations();
      } else {
        alert(res.error?.message || 'Failed to mark registration as paid.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while marking registration as paid.');
    } finally {
      setMarkingPaidId(null);
    }
  };

  // 3. Restore / Recover Registration
  const handleRestoreRegistration = async (id: string) => {
    if (!window.confirm("Are you sure you want to restore this registration? It will reappear in the active registrations list and dashboard statistics.")) {
      return;
    }

    setRestoringId(id);
    try {
      const response = await fetch(`/api/admin/registrations/${id}/restore`, {
        method: 'POST'
      });
      const res = await response.json();

      if (response.ok && res.success) {
        alert('Registration was successfully restored!');
        setSelectedReg(null);
        fetchDeletedRegistrations();
      } else {
        alert(res.error?.message || 'Failed to restore registration.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while restoring registration.');
    } finally {
      setRestoringId(null);
    }
  };

  // 3. Permanently Purge Record (Super Admin only)
  const handlePermanentPurge = async (id: string) => {
    const confirmation = window.prompt("WARNING: This will PERMANENTLY erase this student record, payments, and QR ticket history from the database.\n\nType 'DELETE' to confirm permanent purge:");
    if (confirmation !== 'DELETE') {
      return;
    }

    setPurgingId(id);
    try {
      const response = await fetch(`/api/admin/registrations/${id}?permanent=true`, {
        method: 'DELETE'
      });
      const res = await response.json();

      if (response.ok && res.success) {
        alert('Record was permanently purged from the database.');
        setSelectedReg(null);
        fetchDeletedRegistrations();
      } else {
        alert(res.error?.message || 'Failed to purge record.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during permanent purge.');
    } finally {
      setPurgingId(null);
    }
  };

  // 4. Export Deleted Data to CSV
  const handleExportCSV = async () => {
    try {
      const response = await fetch(`/api/admin/registrations?deleted=true&limit=1000`);
      const res = await response.json();
      if (!response.ok || !res.success) {
        alert('Failed to export deleted records.');
        return;
      }

      const rows = res.data.registrations;
      if (rows.length === 0) {
        alert('No deleted records to export.');
        return;
      }

      const headers = ['Registration Number', 'Name', 'Year', 'School', 'Phone', 'Email', 'Modeling', 'Deleted At', 'Created At'];
      const csvData = [
        headers.join(','),
        ...rows.map((r: any) => [
          `"${r.registration_number}"`,
          `"${r.full_name}"`,
          `"${r.year}"`,
          `"${r.school_name}"`,
          `"${r.phone}"`,
          `"${r.email}"`,
          `"${r.modeling}"`,
          `"${r.deleted_at || 'Cancelled'}"`,
          `"${r.created_at}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `algo_rhythm_deleted_registrations_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export CSV error:', err);
      alert('An error occurred during export.');
    }
  };

  return (
    <AdminLayout requiredRoles={['super_admin', 'admin']}>
      <div className="space-y-6 pb-20">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-white font-outfit tracking-tight">Deleted Test Data & Trash</h1>
            </div>
            <p className="text-slate-400 text-xs">
              Review soft-deleted test data and cancelled registrations. These records are excluded from dashboard statistics and can be restored anytime.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 font-bold text-xs uppercase tracking-wider rounded-xl text-slate-200 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={fetchDeletedRegistrations}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 text-purple-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, registration number, phone, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-500/10 cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* Academic Year Filter */}
            <select
              value={year}
              onChange={(e) => { setYear(e.target.value); setPage(1); }}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-purple-500/50"
            >
              <option value="All" className="bg-[#0e0728]">All Academic Years</option>
              <option value="1st Year" className="bg-[#0e0728]">1st Year (₹100)</option>
              <option value="2nd Year" className="bg-[#0e0728]">2nd Year (₹200)</option>
            </select>

            {/* Modeling Filter */}
            <select
              value={modeling}
              onChange={(e) => { setModeling(e.target.value); setPage(1); }}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-purple-500/50"
            >
              <option value="All" className="bg-[#0e0728]">All Modeling</option>
              <option value="Yes" className="bg-[#0e0728]">Modeling: Yes</option>
              <option value="No" className="bg-[#0e0728]">Modeling: No</option>
            </select>

            <span className="text-slate-400 text-xs ml-auto">
              Total Deleted Records: <strong className="text-white">{total}</strong>
            </span>
          </div>
        </div>

        {/* Registrations Data Table */}
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0d0726] border-b border-white/5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 cursor-pointer hover:text-white" onClick={() => handleSort('registration_number')}>
                    <div className="flex items-center gap-1.5">
                      Reg Number
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 cursor-pointer hover:text-white" onClick={() => handleSort('full_name')}>
                    <div className="flex items-center gap-1.5">
                      Student Name
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5">Academic Year</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5">Modeling</th>
                  <th className="px-4 py-3.5 cursor-pointer hover:text-white" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-1.5">
                      Deleted / Registered
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Loading Deleted Records...</p>
                      </div>
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <p className="text-white font-bold font-outfit text-sm">Trash is Empty</p>
                        <p className="text-slate-400 text-xs max-w-sm">No soft-deleted test data found matching your query.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  list.map((reg) => (
                    <tr 
                      key={reg.id} 
                      className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => handleSelectRegistration(reg)}
                    >
                      {/* Reg Number */}
                      <td className="px-4 py-3.5 font-mono font-semibold text-purple-300">
                        {reg.registration_number}
                      </td>

                      {/* Student Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                          {reg.full_name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {reg.school_name}
                        </div>
                      </td>

                      {/* Academic Year */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          reg.year === '1st Year' ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        }`}>
                          {reg.year}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5">
                        <div className="text-slate-300 font-mono text-[11px]">{reg.phone}</div>
                        <div className="text-slate-500 text-[10px] truncate max-w-[160px]">{reg.email}</div>
                      </td>

                      {/* Modeling */}
                      <td className="px-4 py-3.5">
                        {reg.modeling === 'Yes' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 text-[10px] font-bold">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">No</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-[11px] text-slate-400">
                        <div>{reg.deleted_at ? new Date(reg.deleted_at).toLocaleDateString() : new Date(reg.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">{new Date(reg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleMarkAsPaid(reg)}
                          disabled={markingPaidId === reg.id || restoringId === reg.id || purgingId === reg.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                          title="Mark as Paid, restore to active registrations, and dispatch ticket email"
                        >
                          {markingPaidId === reg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                          Mark Paid
                        </button>

                        <button
                          onClick={() => handleRestoreRegistration(reg.id)}
                          disabled={restoringId === reg.id || markingPaidId === reg.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                          title="Restore back to active registrations"
                        >
                          {restoringId === reg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Restore
                        </button>

                        {adminRole === 'super_admin' && (
                          <button
                            onClick={() => handlePermanentPurge(reg.id)}
                            disabled={purgingId === reg.id || markingPaidId === reg.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                            title="Permanently purge from database"
                          >
                            {purgingId === reg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Purge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 bg-[#0a0520] text-xs">
            <div className="text-slate-400">
              Showing page <strong className="text-white">{page}</strong> of <strong className="text-white">{pages}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Detail Inspector Drawer */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0b0525] border-l border-white/10 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-bold font-outfit text-white">Deleted Record Details</h2>
              </div>
              <button
                onClick={() => setSelectedReg(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2.5">
              <button
                onClick={() => handleMarkAsPaid(selectedReg)}
                disabled={markingPaidId === selectedReg.id || restoringId === selectedReg.id || purgingId === selectedReg.id}
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600/25 to-teal-600/25 border border-emerald-500/40 hover:border-emerald-500/60 hover:from-emerald-600/35 hover:to-teal-600/35 text-emerald-300 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                {markingPaidId === selectedReg.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    Processing Payment & Dispatching Ticket...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Mark as Paid & Send Ticket Email
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => handleRestoreRegistration(selectedReg.id)}
                  disabled={restoringId === selectedReg.id || markingPaidId === selectedReg.id}
                  className="inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {restoringId === selectedReg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Restore Only
                </button>

                {adminRole === 'super_admin' && (
                  <button
                    onClick={() => handlePermanentPurge(selectedReg.id)}
                    disabled={purgingId === selectedReg.id || markingPaidId === selectedReg.id}
                    className="inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {purgingId === selectedReg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Purge
                  </button>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4 text-xs">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Student Name</span>
                  <p className="text-sm font-bold text-white font-outfit">{selectedReg.full_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-semibold">Registration Number</span>
                    <p className="font-mono text-purple-300 font-semibold">{selectedReg.registration_number}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-semibold">Academic Year</span>
                    <p className="text-slate-200 font-semibold">{selectedReg.year}</p>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">School / Department</span>
                  <p className="text-slate-200 font-semibold">{selectedReg.school_name}</p>
                </div>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-semibold">Phone</span>
                    <p className="text-slate-200 font-mono">{selectedReg.phone}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-semibold">Email</span>
                    <p className="text-slate-200 truncate">{selectedReg.email}</p>
                  </div>
                </div>
              </div>

              {selectedReg.modeling === 'Yes' && (
                <div className="bg-purple-950/20 p-4 rounded-xl border border-purple-500/20 space-y-1">
                  <span className="text-purple-300 uppercase text-[10px] font-semibold">Modeling Talent / Bio</span>
                  <p className="text-slate-300 text-xs italic">{selectedReg.modeling_talent || 'Participant registered for Ramp Walk / Modeling.'}</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </AdminLayout>
  );
}

export const dynamic = 'force-dynamic';
