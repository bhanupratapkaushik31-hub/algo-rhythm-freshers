'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { 
  Users, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Crown, 
  TrendingUp, 
  RefreshCw,
  Loader2,
  AlertCircle,
  Mail,
  MailWarning,
  QrCode,
  Calendar,
  UserCheck
} from 'lucide-react';
import { EVENT_CONFIG } from '@/config/event';

interface StatsData {
  total_registrations: number;
  paid_registrations: number;
  pending_payments: number;
  failed_payments: number;
  modeling_yes: number;
  modeling_no: number;
  tickets_generated: number;
  emails_sent: number;
  emails_failed: number;
  entries_completed: number;
  not_yet_entered: number;
  total_collection: number;
  payment_after_deductions?: number;
  deductions_amount?: number;
}

interface CoordinatorActivity {
  id: string;
  name: string;
  email: string;
  total_scans: number;
  successful_entries: number;
  duplicate_attempts: number;
  invalid_tickets: number;
  last_scan_time: string | null;
  active: boolean;
}

interface RecentEntry {
  id: string;
  registration_number: string;
  full_name: string;
  year: string;
  entry_scanned_by: string | null;
  entry_time: string | null;
  entry_status: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [coordinators, setCoordinators] = useState<CoordinatorActivity[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [isRegOpen, setIsRegOpen] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // 1. Fetch Stats, Settings, Coordinators & Entries from DB
  const fetchData = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    setError(null);
    try {
      // 1. Fetch statistics
      const statsRes = await fetch('/api/admin/stats');
      const statsJson = await statsRes.json();
      if (!statsRes.ok || !statsJson.success) {
        throw new Error(statsJson.error?.message || 'Failed to load statistics.');
      }

      // 2. Fetch portal configuration
      const settingsRes = await fetch('/api/admin/settings');
      const settingsJson = await settingsRes.json();
      if (!settingsRes.ok || !settingsJson.success) {
        throw new Error(settingsJson.error?.message || 'Failed to load settings.');
      }

      // 3. Fetch coordinator activities
      const coordRes = await fetch('/api/admin/coordinators');
      const coordJson = await coordRes.json();
      if (coordRes.ok && coordJson.success) {
        setCoordinators(coordJson.data);
      }

      // 4. Fetch recent entries (querying paid registrations sorted by scan time)
      const entriesQueryParams = new URLSearchParams({
        page: '1',
        limit: '10',
        entry_status: 'ENTERED',
        sortBy: 'entry_time',
        sortOrder: 'desc'
      });
      const entriesRes = await fetch(`/api/admin/registrations?${entriesQueryParams}`);
      const entriesJson = await entriesRes.json();
      if (entriesRes.ok && entriesJson.success) {
        setRecentEntries(entriesJson.data.registrations);
      }

      setStats(statsJson.data);
      setIsRegOpen(settingsJson.data.open);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while compiling metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up auto-polling every 15 seconds for real-time dashboard updating
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // 2. Toggle Portal Status
  const handleToggleReg = async () => {
    setToggleLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: !isRegOpen }),
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.error?.message || 'Failed to update portal status.');
      }

      setIsRegOpen(res.data.open);
      fetchData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to toggle portal.');
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <AdminLayout requiredRoles={['super_admin', 'admin']}>
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold font-outfit text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-400 text-xs mt-1">Real-time check-in stats and entrance statistics for {EVENT_CONFIG.name}.</p>
        </div>
        <button
          onClick={() => fetchData(false)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Compiling Metrics...</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {error && (
            <div className="p-4 bg-red-950/20 border border-red-500/20 text-red-200 text-xs rounded-2xl flex gap-3 items-start max-w-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Settings / Portal Toggle Panel */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-1 relative z-10">
              <h3 className="text-base font-bold font-outfit text-white">Registration Portal Status</h3>
              <p className="text-slate-400 text-xs">
                {isRegOpen 
                  ? "Students can currently register online and purchase tickets." 
                  : "The registration page is locked. APIs will reject form submissions."
                }
              </p>
            </div>

            <div className="flex items-center gap-4 relative z-10">
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isRegOpen 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {isRegOpen ? 'Portal Open' : 'Portal Closed'}
              </span>
              
              <button
                onClick={handleToggleReg}
                disabled={toggleLoading}
                className="inline-flex justify-center items-center px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {toggleLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isRegOpen ? (
                  'Close Portal'
                ) : (
                  'Open Portal'
                )}
              </button>
            </div>
          </div>

          {/* Cards Grid: 11 cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Total registrations */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Registrations</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-white mt-1.5">{stats.total_registrations}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Paid + Pending</span>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 text-purple-400">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Paid registrations */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Paid</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-emerald-400 mt-1.5">{stats.paid_registrations}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Confirmed payments</span>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Pending Payments */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pending</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-amber-500 mt-1.5">{stats.pending_payments}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Unfinished transactions</span>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 text-amber-500">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Failed Payments */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Failed Payments</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-red-500 mt-1.5">{stats.failed_payments}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Declined checkouts</span>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 text-red-400">
                  <XCircle className="w-6 h-6" />
                </div>
              </div>

              {/* Card 5: Modeling Yes */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Modeling Yes</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-pink-400 mt-1.5">{stats.modeling_yes}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Enrolled participants</span>
                </div>
                <div className="p-4 rounded-xl bg-pink-500/10 text-pink-400">
                  <Crown className="w-6 h-6" />
                </div>
              </div>

              {/* Card 6: Modeling No */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Modeling No</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-slate-300 mt-1.5">{stats.modeling_no}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Declined enrollment</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-500/10 text-slate-300">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              {/* Card 7: Tickets Generated */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Tickets Generated</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-blue-400 mt-1.5">{stats.tickets_generated}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Confirmed ticket tokens</span>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/10 text-blue-400">
                  <QrCode className="w-6 h-6" />
                </div>
              </div>

              {/* Card 8: Total Collection */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Collection</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-amber-500 mt-1.5">₹{stats.total_collection.toLocaleString('en-IN')}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Gross revenue (INR)</span>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 text-amber-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              {/* Card 9: Payment after Deductions */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between border-emerald-500/20 bg-emerald-950/10">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Payment after Deductions</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-emerald-400 mt-1.5">
                    ₹{(stats.payment_after_deductions ?? Number((stats.total_collection * 0.977).toFixed(2))).toLocaleString('en-IN')}
                  </h3>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Net payout (-2.3% fee: ₹{(stats.deductions_amount ?? Number((stats.total_collection * 0.023).toFixed(2))).toLocaleString('en-IN')})
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CreditCard className="w-6 h-6" />
                </div>
              </div>

              {/* Card 9: Emails Sent */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Emails Sent</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-emerald-400 mt-1.5">{stats.emails_sent}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Delivered to Resend</span>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Mail className="w-6 h-6" />
                </div>
              </div>

              {/* Card 10: Emails Failed */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Emails Failed</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-red-400 mt-1.5">{stats.emails_failed}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Delivery errors recorded</span>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 text-red-400">
                  <XCircle className="w-6 h-6" />
                </div>
              </div>

              {/* Card 11: Entries Completed */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Entries Completed</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-indigo-400 mt-1.5">{stats.entries_completed}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Scanned at entrance</span>
                </div>
                <div className="p-4 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <UserCheck className="w-6 h-6" />
                </div>
              </div>

              {/* Card 12: Not Yet Entered */}
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Not Yet Entered</span>
                  <h3 className="text-3xl font-extrabold font-outfit text-slate-300 mt-1.5">{stats.not_yet_entered}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Paid but expected</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-500/10 text-slate-300">
                  <Users className="w-6 h-6" />
                </div>
              </div>

            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Recent Check-Ins Table */}
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-base font-bold font-outfit text-white uppercase tracking-wider">Recent Check-In Logs</h3>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-[10px] text-indigo-300 font-bold uppercase">LIVE LOGS</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-white/5 pb-2 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                        <th className="pb-3">Reg No.</th>
                        <th className="pb-3">Name</th>
                        <th className="pb-3">Year</th>
                        <th className="pb-3">Coordinator</th>
                        <th className="pb-3 text-right">Scan Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-600 font-medium">No check-ins completed yet.</td>
                        </tr>
                      ) : (
                        recentEntries.map((log) => (
                          <tr key={log.id} className="hover:bg-white/[0.01]">
                            <td className="py-3 font-semibold text-slate-200">{log.registration_number}</td>
                            <td className="py-3 font-bold text-white">{log.full_name}</td>
                            <td className="py-3">{log.year}</td>
                            <td className="py-3 truncate max-w-[120px]">{log.entry_scanned_by || 'Staff'}</td>
                            <td className="py-3 text-right text-slate-400">
                              {log.entry_time ? new Date(log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Coordinator Activity Panel */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-base font-bold font-outfit text-white uppercase tracking-wider mb-6">Coordinator Activity</h3>
              
              <div className="space-y-4">
                {coordinators.length === 0 ? (
                  <p className="py-12 text-center text-slate-600 text-xs font-semibold uppercase tracking-wider">No coordinators registered.</p>
                ) : (
                  coordinators.map((c) => (
                    <div key={c.id} className="flex justify-between items-center p-3.5 bg-white/5 border border-white/5 rounded-2xl text-xs">
                      <div>
                        <h4 className="font-bold text-white leading-none">{c.name}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">{c.email}</p>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          c.active ? 'bg-purple-500/10 text-purple-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {c.active ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Scans</span>
                        <span className="text-base font-extrabold font-outfit text-purple-300 block">{c.total_scans}</span>
                        {c.last_scan_time && (
                          <span className="text-[9px] text-slate-500">
                            Last: {new Date(c.last_scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </AdminLayout>
  );
}

export const dynamic = 'force-dynamic';
