'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { 
  ScanQrCode, 
  Download, 
  Printer, 
  RotateCcw, 
  RefreshCw, 
  Copy, 
  Check, 
  ShieldCheck, 
  Users, 
  Clock, 
  Smartphone, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import QRCode from 'qrcode';

interface ScanLogEntry {
  id: string;
  coordinator_name: string;
  coordinator_email: string;
  role: string;
  scanned_at: string;
  scanner_device: string;
}

export default function AdminTestQrPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrValue, setQrValue] = useState<string>('https://algo-rhythm-freshers.vercel.app/ticket/admin-test');
  const [scanCount, setScanCount] = useState<number>(0);
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // 1. Fetch Stats from backend
  const fetchStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/test-qr');
      const json = await res.json();
      if (json.success && json.data) {
        setScanCount(json.data.count || 0);
        setScanLogs(json.data.scans || []);
        setLastScannedAt(json.data.last_scanned_at || null);
        if (json.data.qr_value) {
          setQrValue(json.data.qr_value);
        }
      }
    } catch (err) {
      console.error('Failed to fetch test QR statistics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 2. Generate QR Code image
  useEffect(() => {
    QRCode.toDataURL(qrValue, {
      margin: 2,
      width: 400,
      color: {
        dark: '#08031d',
        light: '#ffffff',
      },
    }).then(url => {
      setQrDataUrl(url);
    }).catch(err => {
      console.error('QR code generation error:', err);
    });
  }, [qrValue]);

  // 3. Initial fetch and periodic polling (every 4 seconds) for live test scan monitoring
  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // 4. Copy URL helper
  const handleCopy = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 5. Download QR Image
  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'Algo-Rhythm-Admin-Test-QR.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 6. Print QR
  const handlePrint = () => {
    window.print();
  };

  // 7. Reset Stats
  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset the scan count and clear test scan logs to 0?')) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/test-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      const json = await res.json();
      if (json.success) {
        setScanCount(0);
        setScanLogs([]);
        setLastScannedAt(null);
      } else {
        alert(json.error?.message || 'Failed to reset.');
      }
    } catch (err) {
      console.error('Reset error:', err);
      alert('Network error while resetting.');
    } finally {
      setIsResetting(false);
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <AdminLayout requiredRoles={['super_admin', 'admin']}>
      <div className="space-y-8 max-w-7xl mx-auto">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Scanner Testing & Diagnostics
            </div>
            <h1 className="text-3xl font-extrabold font-outfit text-white tracking-tight">
              Admin Test QR Code
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Standardized test entry QR code for coordinator APK and web scanner validation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStats()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-wider text-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
              Refresh Logs
            </button>
            <button
              onClick={handleReset}
              disabled={isResetting || scanCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-xs font-bold uppercase tracking-wider text-red-400 transition-all cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Stats
            </button>
          </div>
        </div>

        {/* Top Info Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border border-purple-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-outfit">Expected Scanner Result on Scan:</h4>
              <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                &ldquo;Scanned admin - test successfull&rdquo;
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Auto-refreshes in real-time every 4 seconds
          </div>
        </div>

        {/* 2-Column Grid: Left QR Display Card, Right Stats & Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: QR Card (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="glass-card rounded-3xl p-6 sm:p-8 border-purple-500/20 text-center flex flex-col items-center relative overflow-hidden bg-[#0c0724]">
              {/* Decorative top strip */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />

              <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400 mt-2 mb-1">
                Entry Gate Ticket Spec
              </span>
              <h3 className="text-xl font-extrabold font-outfit text-white tracking-wide mb-6">
                ALGO-RHYTHM TEST PASS
              </h3>

              {/* QR Code Container */}
              <div className="p-4 bg-white rounded-3xl shadow-2xl inline-flex items-center justify-center border-4 border-purple-400/30 mb-6 group hover:scale-[1.02] transition-transform">
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="Admin Test Entry QR Code" 
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                    Generating QR Code...
                  </div>
                )}
              </div>

              {/* Token Display & Copy */}
              <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2 mb-6">
                <div className="text-left overflow-hidden">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">
                    Payload Token / URL
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-300 truncate block">
                    {qrValue}
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors shrink-0"
                  title="Copy QR URL"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Save Image
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/15 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print QR
                </button>
              </div>

              {/* How it works info */}
              <div className="mt-6 pt-6 border-t border-white/5 text-left w-full space-y-2 text-xs text-slate-400">
                <p className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <span>Open Coordinator Scanner (Android APK or Web).</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <span>Point camera directly at this QR code.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <span>Screen confirms success and this page live-updates.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Scan Metrics & Coordinator Log (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-6 border-purple-500/20 relative overflow-hidden bg-[#0c0724]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Total Test Scans
                  </span>
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                    <ScanQrCode className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-black font-outfit text-white">
                    {loading ? '-' : scanCount}
                  </span>
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                    Times Verified
                  </span>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 border-purple-500/20 relative overflow-hidden bg-[#0c0724]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Last Verified At
                  </span>
                  <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-lg font-bold font-outfit text-white block">
                    {loading ? '-' : formatDateTime(scanLogs[0]?.scanned_at || lastScannedAt)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {scanLogs.length > 0 ? `By ${scanLogs[0].coordinator_name}` : 'No scans recorded yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* Coordinator Scan History Table */}
            <div className="glass-card rounded-2xl p-6 border-white/5 bg-[#0c0724] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <h3 className="font-extrabold font-outfit text-white text-base">
                    Coordinators Who Scanned
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-xs font-bold">
                    {scanLogs.length}
                  </span>
                </div>
              </div>

              {scanLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-white/10 rounded-xl space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No test scans recorded yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Scan the QR code on the left using the coordinator mobile app or web scanner to log the first test entry.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-white/5 uppercase tracking-wider text-[10px] text-slate-400 font-bold border-b border-white/5">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Coordinator Name</th>
                        <th className="py-3 px-4">Email / ID</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Device</th>
                        <th className="py-3 px-4 text-right">Scanned Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium">
                      {scanLogs.map((log, index) => (
                        <tr key={log.id || index} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 text-slate-500 font-mono">
                            {scanLogs.length - index}
                          </td>
                          <td className="py-3 px-4 font-bold text-white font-outfit">
                            {log.coordinator_name}
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {log.coordinator_email}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                              {log.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                            <span className="truncate max-w-[130px]">{log.scanner_device}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">
                            {formatDateTime(log.scanned_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

export const dynamic = 'force-dynamic';
