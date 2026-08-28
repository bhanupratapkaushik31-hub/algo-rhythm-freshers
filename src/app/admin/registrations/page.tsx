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
  Trash2, 
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
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';

interface RegistrationDetail {
  id: string;
  ticket_id: string | null;
  ticket_token: string;
  registration_number: string;
  full_name: string;
  year: '1st Year' | '2nd Year';
  school_name: string;
  modeling: 'Yes' | 'No';
  phone: string;
  email: string;
  registration_status: 'PENDING' | 'PAID' | 'CANCELLED';
  entry_status: 'ENTERED' | 'NOT_ENTERED';
  entry_time: string | null;
  entry_scanned_by: string | null;
  razorpay_payment_id: string | null;
  payment_time: string | null;
  created_at: string;
  payment_method: string | null;
  email_sent: boolean;
  email_status: 'PENDING' | 'SENT' | 'FAILED' | null;
  email_error: string | null;
  email_sent_at: string | null;
}

export default function AdminRegistrations() {
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
  const [paymentStatus, setPaymentStatus] = useState('All');
  const [entryStatus, setEntryStatus] = useState('All');
  const [school, setSchool] = useState('');

  // Sorting States
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Inspector Drawer States
  const [selectedReg, setSelectedReg] = useState<RegistrationDetail | null>(null);
  const [adminRole, setAdminRole] = useState<'super_admin' | 'admin' | 'scanner' | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [updatingEntry, setUpdatingEntry] = useState(false);

  const handleResendEmail = async (id: string) => {
    setResendingEmail(true);
    try {
      const response = await fetch(`/api/admin/registrations/${id}/resend`, { method: 'POST' });
      const res = await response.json();
      if (response.ok && res.success) {
        alert('Ticket email has been successfully resent.');
        fetchRegistrations();
        if (selectedReg) {
          setSelectedReg({ 
            ...selectedReg, 
            email_sent: true,
            email_status: 'SENT',
            email_sent_at: new Date().toISOString(),
            email_error: null
          });
        }
      } else {
        alert(res.error?.message || 'Failed to resend email.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error force-resending email.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleManualEntry = async (id: string, action: 'checkin' | 'reset') => {
    setUpdatingEntry(true);
    try {
      const response = await fetch(`/api/admin/registrations/${id}/manual-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const res = await response.json();
      if (response.ok && res.success) {
        alert(`Entry logs successfully updated (${action === 'checkin' ? 'Checked-in' : 'Reset Check-in'}).`);
        fetchRegistrations();
        if (selectedReg) {
          setSelectedReg({
            ...selectedReg,
            entry_status: action === 'checkin' ? 'ENTERED' : 'NOT_ENTERED',
            entry_time: action === 'checkin' ? new Date().toISOString() : null,
            entry_scanned_by: action === 'checkin' ? 'Admin' : null
          });
        }
      } else {
        alert(res.error?.message || 'Failed to update entry logs.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error making manual correction.');
    } finally {
      setUpdatingEntry(false);
    }
  };

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

  // 1. Fetch Registrations list from backend
  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        year,
        modeling,
        payment_status: paymentStatus,
        entry_status: entryStatus,
        school,
        sortBy,
        sortOrder
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
        setErrorMsg(res.error?.message || 'Failed to load registrations.');
      }
    } catch (err) {
      console.error('Failed to load registrations:', err);
      setErrorMsg('Failed to load registrations. Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [page, year, modeling, paymentStatus, entryStatus, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRegistrations();
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

  // 2. Export Filtered Registrations to CSV
  const exportCSV = async () => {
    try {
      const queryParams = new URLSearchParams({
        limit: '10000', // high limit to fetch all filtered rows
        search,
        year,
        modeling,
        payment_status: paymentStatus,
        entry_status: entryStatus,
        school,
        sortBy,
        sortOrder
      });

      const response = await fetch(`/api/admin/registrations?${queryParams}`);
      const res = await response.json();

      if (!response.ok || !res.success) {
        alert('Failed to retrieve data for export.');
        return;
      }

      const data: RegistrationDetail[] = res.data.registrations;
      const headers = [
        "Registration No.", "Full Name", "Year", "School Name",
        "Modeling", "Phone", "Email", "Payment Status",
        "Ticket ID", "Email Status", "Entry Status", "Entry Time",
        "Coordinator"
      ];

      const rows = data.map(r => [
        r.registration_number,
        r.full_name,
        r.year,
        r.school_name,
        r.modeling,
        r.phone,
        r.email,
        r.registration_status,
        r.ticket_id || 'N/A',
        (r as any).email_status || (r.email_sent ? 'SENT' : 'PENDING'),
        r.entry_status,
        r.entry_time ? new Date(r.entry_time).toLocaleString() : 'N/A',
        r.entry_scanned_by || 'N/A'
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ALGO_RHYTHM_Registrations_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Export CSV error:', err);
      alert('An error occurred during export.');
    }
  };

  // 3. Cancel/Delete Registration (Super Admin Only)
  const handleCancelRegistration = async (id: string) => {
    if (!window.confirm("Are you absolutely sure you want to cancel/soft-delete this registration? Unused tickets will be invalidated. Payment record will NOT be deleted.")) {
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch(`/api/admin/registrations/${id}`, {
        method: 'DELETE'
      });

      const res = await response.json();

      if (response.ok && res.success) {
        alert('Registration was successfully cancelled.');
        setSelectedReg(null);
        fetchRegistrations();
      } else {
        alert(res.error?.message || 'Failed to cancel registration.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Failed to execute cancellation.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <AdminLayout requiredRoles={['super_admin', 'admin']}>
      
      {/* Title & Actions bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold font-outfit text-white tracking-tight">Attendees Database</h1>
          <p className="text-slate-400 text-xs mt-1">Manage student registrants, view payment logs, and check-in statuses.</p>
        </div>
        
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-950/20 border border-red-500/20 text-red-200 text-xs rounded-2xl flex gap-3 items-start">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="glass-card rounded-2xl p-6 mb-8 space-y-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by Name, Reg No, Ticket ID, Phone, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl outline-none cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-white/5">
          {/* Year */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Year</label>
            <select
              value={year}
              onChange={(e) => { setYear(e.target.value); setPage(1); }}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="All" className="bg-[#0c0724]">All Years</option>
              <option value="1st Year" className="bg-[#0c0724]">1st Year</option>
              <option value="2nd Year" className="bg-[#0c0724]">2nd Year</option>
            </select>
          </div>

          {/* Modeling */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Modeling</label>
            <select
              value={modeling}
              onChange={(e) => { setModeling(e.target.value); setPage(1); }}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="All" className="bg-[#0c0724]">All preferences</option>
              <option value="Yes" className="bg-[#0c0724]">Modeling: Yes</option>
              <option value="No" className="bg-[#0c0724]">Modeling: No</option>
            </select>
          </div>

          {/* Payment */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Payment</label>
            <select
              value={paymentStatus}
              onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="All" className="bg-[#0c0724]">All Payments</option>
              <option value="SUCCESS" className="bg-[#0c0724]">SUCCESS</option>
              <option value="PENDING" className="bg-[#0c0724]">PENDING</option>
              <option value="FAILED" className="bg-[#0c0724]">FAILED</option>
              <option value="REFUND_PROCESSING" className="bg-[#0c0724]">REFUND PROCESSING</option>
              <option value="REFUNDED" className="bg-[#0c0724]">REFUNDED</option>
            </select>
          </div>

          {/* Entry */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Check-in Status</label>
            <select
              value={entryStatus}
              onChange={(e) => { setEntryStatus(e.target.value); setPage(1); }}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="All" className="bg-[#0c0724]">All Statuses</option>
              <option value="ENTERED" className="bg-[#0c0724]">Entered</option>
              <option value="NOT_ENTERED" className="bg-[#0c0724]">Not Entered</option>
            </select>
          </div>

          {/* School filter input */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">School Name</label>
            <input
              type="text"
              placeholder="Filter by school..."
              value={school}
              onChange={(e) => { setSchool(e.target.value); setPage(1); }}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none transition-colors focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card rounded-2xl overflow-hidden mb-6 relative">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Fetching logs...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="py-24 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Registrations Found</h3>
            <p className="text-xs text-slate-500 mt-1">Try relaxing your search or filter inputs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse text-xs text-slate-300">
              
              {/* Table Headers */}
              <thead>
                <tr className="bg-white/5 border-b border-white/5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                  <th className="px-6 py-4">Photo</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('registration_number')}>
                    <span className="flex items-center gap-1.5">Reg No. <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('full_name')}>
                    <span className="flex items-center gap-1.5">Name <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('ticket_id')}>
                    <span className="flex items-center gap-1.5">Ticket ID <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Entry Status</th>
                  <th className="px-6 py-4">Entry Time</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              {/* Table Rows */}
              <tbody className="divide-y divide-white/5">
                {list.map((reg) => (
                  <tr 
                    key={reg.id} 
                    onClick={() => setSelectedReg(reg)}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/30 bg-black/40 flex items-center justify-center shrink-0">
                        <img
                          src={`/api/admin/registrations/${reg.id}/photo`}
                          alt={reg.full_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-200 font-outfit">{reg.registration_number}</td>
                    <td className="px-6 py-4 font-bold text-white truncate max-w-[150px]">{reg.full_name}</td>
                    <td className="px-6 py-4 font-bold text-white font-outfit">{reg.ticket_id || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        (reg as any).refund_status === 'REFUNDED'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                        : (reg as any).refund_status === 'PROCESSING'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10 animate-pulse'
                        : reg.registration_status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                        : reg.registration_status === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                        : 'bg-red-500/10 text-red-400 border border-red-500/10'
                      }`}>
                        {(reg as any).refund_status === 'REFUNDED' ? 'REFUNDED' :
                         (reg as any).refund_status === 'PROCESSING' ? 'REFUNDING' :
                         reg.registration_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        reg.entry_status === 'ENTERED'
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {reg.entry_status === 'ENTERED' ? 'Entered' : 'Not Entered'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {reg.entry_time ? new Date(reg.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right print:hidden" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelectedReg(reg)}
                        className="p-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"
                        title="Inspect Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {!loading && list.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 px-2">
          <span>
            Showing <strong className="text-white">{((page - 1) * limit) + 1}</strong> to{' '}
            <strong className="text-white">{Math.min(page * limit, total)}</strong> of{' '}
            <strong className="text-white">{total}</strong> attendees
          </span>
          
          <div className="inline-flex gap-2">
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 rounded-lg text-slate-300 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg font-bold text-white">
              Page {page} of {pages}
            </div>
            <button
              onClick={() => setPage(prev => Math.min(prev + 1, pages))}
              disabled={page === pages}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 rounded-lg text-slate-300 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Inspector Slide-over Drawer / Modal (Floating Detail view) */}
      {selectedReg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 flex justify-end animate-fade-in" onClick={() => setSelectedReg(null)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-full bg-[#0a0520] border-l border-white/10 p-8 flex flex-col justify-between overflow-y-auto relative animate-slide-left shadow-2xl"
          >
            {/* Glow vertical border */}
            <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-purple-500 via-pink-500 to-transparent" />
            
            {/* Drawer Top */}
            <div className="space-y-6">
              
              {/* Drawer Header */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-outfit text-white uppercase tracking-wider">Student Profile</h3>
                <button 
                  onClick={() => setSelectedReg(null)} 
                  className="p-1 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student Identification header */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 animate-fade-in">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-purple-500/30 bg-black/40 flex items-center justify-center shrink-0">
                  <img
                    src={`/api/admin/registrations/${selectedReg.id}/photo`}
                    alt={selectedReg.full_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-extrabold text-white font-outfit leading-tight text-base">{selectedReg.full_name}</h4>
                  <p className="text-slate-400 text-xs mt-0.5">{selectedReg.registration_number} &bull; {selectedReg.year}</p>
                </div>
              </div>

              {/* Details table list */}
              <div className="space-y-4 pt-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Information</h4>
                <div className="space-y-3 text-xs bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">School:</span>
                    <span className="font-semibold text-slate-300 text-right max-w-[200px] truncate">{selectedReg.school_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Modeling Participant:</span>
                    <span className="font-bold text-slate-200">{selectedReg.modeling}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone:</span>
                    <a href={`tel:${selectedReg.phone}`} className="font-bold text-purple-300 hover:text-purple-200">{selectedReg.phone}</a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-semibold text-slate-300 truncate max-w-[180px]">{selectedReg.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email Status:</span>
                    <span className={`font-bold uppercase tracking-wider ${
                      selectedReg.email_status === 'SENT' ? 'text-emerald-400' : 
                      selectedReg.email_status === 'FAILED' ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {selectedReg.email_status || (selectedReg.email_sent ? 'SENT' : 'NOT SENT')}
                    </span>
                  </div>
                  {selectedReg.email_sent_at && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email Sent At:</span>
                      <span className="text-slate-300 font-semibold">{new Date(selectedReg.email_sent_at).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedReg.email_error && (
                    <div className="flex flex-col gap-1 border-t border-white/5 pt-2 mt-1">
                      <span className="text-slate-500">Email Error:</span>
                      <span className="text-red-400 font-mono text-[10px] break-all bg-red-950/20 p-2 rounded border border-red-900/20">
                        {selectedReg.email_error}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ticket ID:</span>
                    <span className="font-bold text-amber-500">{selectedReg.ticket_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Registration Time:</span>
                    <span className="text-slate-400">{new Date(selectedReg.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Transaction details */}
              <div className="space-y-4 pt-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment & Transaction Log</h4>
                <div className="space-y-3 text-xs bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ticket Status:</span>
                    <span className={`font-bold uppercase tracking-wider ${
                      selectedReg.registration_status === 'PAID' ? 'text-emerald-400' : 'text-amber-500'
                    }`}>{selectedReg.registration_status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Status:</span>
                    <span className={`font-bold uppercase tracking-wider ${
                      (selectedReg as any).payment_status === 'SUCCESS' ? 'text-emerald-400' : 
                      (selectedReg as any).payment_status === 'FAILED' ? 'text-red-400' : 'text-amber-500'
                    }`}>{(selectedReg as any).payment_status || 'PENDING'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Method:</span>
                    <span className="font-bold text-slate-300">
                      {selectedReg.payment_method === 'TEST_SIMULATOR' ? 'TEST SIMULATOR' : (selectedReg.payment_method || 'RAZORPAY')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Razorpay Payment ID:</span>
                    <span className="font-semibold text-slate-300 font-mono text-[10px]">{selectedReg.razorpay_payment_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Razorpay Order ID:</span>
                    <span className="font-semibold text-slate-300 font-mono text-[10px]">{(selectedReg as any).razorpay_order_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Time:</span>
                    <span className="text-slate-400">{selectedReg.payment_time ? new Date(selectedReg.payment_time).toLocaleString() : 'N/A'}</span>
                  </div>

                  {/* Refund details if processing or refunded */}
                  {((selectedReg as any).refund_status && (selectedReg as any).refund_status !== 'NOT_REQUIRED') && (
                    <>
                      <div className="border-t border-white/5 pt-3 mt-3">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Refund Status:</span>
                          <span className={`font-bold uppercase tracking-wider ${
                            (selectedReg as any).refund_status === 'REFUNDED' ? 'text-red-400' : 'text-amber-500'
                          }`}>{(selectedReg as any).refund_status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Refund ID:</span>
                          <span className="font-semibold text-slate-300 font-mono text-[10px]">{(selectedReg as any).refund_id || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Refund Reason:</span>
                          <span className="text-slate-300 max-w-[200px] text-right">{(selectedReg as any).refund_reason || 'N/A'}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Check-in Logs */}
              <div className="space-y-4 pt-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Event Check-In Log</h4>
                <div className="space-y-3 text-xs bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className={`font-bold uppercase tracking-wider ${
                      selectedReg.entry_status === 'ENTERED' ? 'text-indigo-400' : 'text-slate-500'
                    }`}>{selectedReg.entry_status === 'ENTERED' ? 'Entered' : 'Not Checked-In'}</span>
                  </div>
                  {selectedReg.entry_status === 'ENTERED' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Scanned By:</span>
                        <span className="font-semibold text-slate-300">{selectedReg.entry_scanned_by || 'Staff'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Check-in Time:</span>
                        <span className="text-slate-400">{selectedReg.entry_time ? new Date(selectedReg.entry_time).toLocaleString() : 'N/A'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Drawer Actions Bottom */}
            <div className="pt-6 border-t border-white/10 space-y-3 mt-8">
              {selectedReg.registration_status === 'PAID' && (
                <>
                  <a
                    href={`/ticket/${selectedReg.ticket_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                  >
                    <QrCode className="w-4 h-4" />
                    View/Download Ticket
                  </a>

                  {/* Resend Email Button */}
                  <button
                    onClick={() => handleResendEmail(selectedReg.id)}
                    disabled={resendingEmail}
                    className="w-full inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 text-purple-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {resendingEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Resending Ticket...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Resend Ticket
                      </>
                    )}
                  </button>

                  {/* Manual entry check-in */}
                  {selectedReg.entry_status !== 'ENTERED' ? (
                    <button
                      onClick={() => handleManualEntry(selectedReg.id, 'checkin')}
                      disabled={updatingEntry}
                      className="w-full inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {updatingEntry ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                      Manual Check-In
                    </button>
                  ) : (
                    <button
                      onClick={() => handleManualEntry(selectedReg.id, 'reset')}
                      disabled={updatingEntry}
                      className="w-full inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {updatingEntry ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Reset Check-In Log
                    </button>
                  )}
                </>
              )}

              {/* soft delete trigger (Super Admin only) */}
              {adminRole === 'super_admin' && selectedReg.registration_status !== 'CANCELLED' && (
                <button
                  onClick={() => handleCancelRegistration(selectedReg.id)}
                  disabled={cancelling}
                  className="w-full inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cancelling Registration...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Cancel Registration
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </AdminLayout>
  );
}
export const dynamic = 'force-dynamic';
