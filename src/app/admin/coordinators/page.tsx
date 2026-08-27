'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { 
  UserPlus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Key, 
  Loader2, 
  UserCheck, 
  X, 
  AlertCircle,
  Clock,
  Sparkles,
  Users
} from 'lucide-react';

interface Coordinator {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  total_scans: number;
  successful_entries: number;
  last_scan_time: string | null;
}

export default function AdminCoordinators() {
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<'super_admin' | 'admin' | null>(null);

  // Modals / Form states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedCoord, setSelectedCoord] = useState<Coordinator | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // 1. Fetch current logged-in role
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

  // 2. Fetch coordinators
  const fetchCoordinators = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/coordinators');
      const res = await response.json();
      if (response.ok && res.success) {
        setCoordinators(res.data);
      } else {
        setError(res.error?.message || 'Failed to load coordinators.');
      }
    } catch (err) {
      console.error(err);
      setError('Network connection error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoordinators();
  }, []);

  // 3. Toggle Status (Active / Disabled)
  const handleToggleStatus = async (coord: Coordinator) => {
    try {
      const response = await fetch(`/api/admin/coordinators/${coord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !coord.active })
      });
      const res = await response.json();
      if (response.ok && res.success) {
        // Toggle locally
        setCoordinators(prev => prev.map(c => c.id === coord.id ? { ...c, active: !c.active } : c));
      } else {
        alert(res.error?.message || 'Failed to update coordinator status.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating coordinator status.');
    }
  };

  // 4. Create Coordinator
  const handleCreateCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      alert('Please fill in all fields.');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/coordinators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword })
      });
      const res = await response.json();
      if (response.ok && res.success) {
        setIsCreateOpen(false);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        fetchCoordinators();
      } else {
        alert(res.error?.message || 'Failed to create coordinator account.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error creating coordinator.');
    } finally {
      setCreating(false);
    }
  };

  // 5. Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoord || !resetPassword) return;

    setResetting(true);
    try {
      const response = await fetch(`/api/admin/coordinators/${selectedCoord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword })
      });
      const res = await response.json();
      if (response.ok && res.success) {
        alert(`Password for ${selectedCoord.name} reset successfully.`);
        setIsResetOpen(false);
        setResetPassword('');
        setSelectedCoord(null);
      } else {
        alert(res.error?.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error resetting password.');
    } finally {
      setResetting(false);
    }
  };

  // 6. Delete Coordinator (Super Admin Only)
  const handleDeleteCoordinator = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete this coordinator account? Authentication credentials will be destroyed.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/coordinators/${id}`, {
        method: 'DELETE'
      });
      const res = await response.json();
      if (response.ok && res.success) {
        setCoordinators(prev => prev.filter(c => c.id !== id));
      } else {
        alert(res.error?.message || 'Failed to delete coordinator.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting coordinator.');
    }
  };

  return (
    <AdminLayout requiredRoles={['super_admin', 'admin']}>
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold font-outfit text-white tracking-tight">Coordinator Terminals</h1>
          <p className="text-slate-400 text-xs mt-1">Manage staff check-in terminals, check status, and scan counters.</p>
        </div>
        
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Create Coordinator
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/20 border border-red-500/20 text-red-200 text-xs rounded-2xl flex gap-3 items-start max-w-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid table */}
      <div className="glass-card rounded-2xl overflow-hidden relative">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Querying Accounts...</p>
          </div>
        ) : coordinators.length === 0 ? (
          <div className="py-24 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Coordinators Found</h3>
            <p className="text-xs text-slate-500 mt-1">Create one to start event-day entry scanning.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse text-xs text-slate-300">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Successful Scans</th>
                  <th className="px-6 py-4">Last scan</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {coordinators.map(coord => (
                  <tr key={coord.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{coord.name}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{coord.email}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        coord.active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                          : 'bg-red-500/10 text-red-400 border border-red-500/10'
                      }`}>
                        {coord.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold font-outfit text-white text-sm">{coord.total_scans}</td>
                    <td className="px-6 py-4">
                      {coord.last_scan_time ? (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span>{new Date(coord.last_scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">Never scanned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{new Date(coord.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right flex gap-3 justify-end items-center" onClick={e => e.stopPropagation()}>
                      
                      {/* Toggle status */}
                      <button
                        onClick={() => handleToggleStatus(coord)}
                        className={`text-slate-400 hover:text-white transition-colors cursor-pointer`}
                        title={coord.active ? 'Disable Coordinator' : 'Enable Coordinator'}
                      >
                        {coord.active ? (
                          <ToggleRight className="w-6 h-6 text-purple-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </button>

                      {/* Reset password */}
                      <button
                        onClick={() => { setSelectedCoord(coord); setIsResetOpen(true); }}
                        className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-amber-400 cursor-pointer"
                        title="Reset Password"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete (Super Admin only) */}
                      {adminRole === 'super_admin' && (
                        <button
                          onClick={() => handleDeleteCoordinator(coord.id)}
                          className="p-1 rounded bg-white/5 border border-white/10 hover:bg-red-500/10 text-red-400 hover:text-red-300 cursor-pointer"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE COORDINATOR MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#0a0520] border border-white/10 rounded-2xl overflow-hidden relative shadow-2xl"
          >
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            
            <div className="p-6 flex justify-between items-center border-b border-white/5">
              <h3 className="text-base font-bold font-outfit text-white uppercase tracking-wider">New Coordinator Account</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoordinator} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Bhanu Pratap Kaushik"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Email Username</label>
                <input 
                  type="email" 
                  placeholder="coordinator@domain.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Default Password</label>
                <input 
                  type="password" 
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                  minLength={6}
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-xs uppercase tracking-wider rounded-xl text-white disabled:opacity-50 cursor-pointer"
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  Register Coordinator
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetOpen && selectedCoord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#0a0520] border border-white/10 rounded-2xl overflow-hidden relative shadow-2xl"
          >
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            
            <div className="p-6 flex justify-between items-center border-b border-white/5">
              <h3 className="text-base font-bold font-outfit text-white uppercase tracking-wider">Reset Password</h3>
              <button onClick={() => { setIsResetOpen(false); setSelectedCoord(null); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-xs text-slate-400">
                You are resetting the password for coordinator <strong className="text-white">{selectedCoord.name}</strong> ({selectedCoord.email}).
              </p>
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">New Password</label>
                <input 
                  type="password" 
                  placeholder="Enter new strong password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                  minLength={6}
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setIsResetOpen(false); setSelectedCoord(null); }}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-xs uppercase tracking-wider rounded-xl text-white disabled:opacity-50 cursor-pointer"
                >
                  {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Update Password
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </AdminLayout>
  );
}

export const dynamic = 'force-dynamic';
