'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Scan, 
  Camera, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  LogOut, 
  Sparkles,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  History
} from 'lucide-react';
import { EVENT_CONFIG } from '@/config/event';

type ScanResultState = 'SCANNING' | 'VERIFYING' | 'MARKED' | 'ALREADY_ENTERED' | 'INVALID' | 'UNPAID' | 'PENDING_CONFIRMATION';

interface ScannedStudent {
  id: string;
  ticket_id: string;
  full_name: string;
  registration_number: string;
  year: '1st Year' | '2nd Year';
  school_name: string;
  modeling: 'Yes' | 'No';
  photo_url?: string;
}

export default function CoordinatorScanner() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [coordinator, setCoordinator] = useState<any>(null);
  const [scanState, setScanState] = useState<ScanResultState>('SCANNING');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [entryDetails, setEntryDetails] = useState<any>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [markingEntry, setMarkingEntry] = useState(false);
  const [isTestModeScanned, setIsTestModeScanned] = useState(false);
  
  // History & Statistics
  const [myStats, setMyStats] = useState({ total_scans: 0, recent_scans: [] as any[] });
  const [statsLoading, setStatsLoading] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'coordinator-viewport';

  // 1. Auth check on mount
  useEffect(() => {
    supabase.auth.getSession().then((res: any) => {
      const session = res.data?.session;
      if (!session) {
        router.push('/coordinator/login');
        return;
      }
      
      fetch('/api/admin/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      .then(r => r.json())
      .then((res2: any) => {
        const profile = res2.success ? res2.data : null;
        if (!profile || !['scanner', 'coordinator', 'admin', 'super_admin'].includes(profile.role) || profile.active === false) {
          supabase.auth.signOut();
          router.push('/coordinator/login');
        } else {
          setCoordinator(profile);
          setLoading(false);
          fetchMyStats();
          startCamera();
        }
      })
      .catch(() => {
        supabase.auth.signOut();
        router.push('/coordinator/login');
      });
    });

    return () => {
      stopCamera();
    };
  }, []);

  // Fetch statistics from backend API
  const fetchMyStats = async () => {
    setStatsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/coordinator/stats', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      const res = await response.json();
      if (response.ok && res.success) {
        setMyStats(res.data);
      }
    } catch (e) {
      console.error('Failed to load coordinator stats:', e);
    } finally {
      setStatsLoading(false);
    }
  };

  // Sound Feedback using Web Audio API
  const playBeep = (type: 'success' | 'error' | 'already') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        // Double high-pitch beep for entry marked!
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.12);
        gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.25);
      } else if (type === 'already') {
        // High to low sliding frequency warning beep
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Low buzz
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  // Haptic Vibration Pulse
  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Start Camera Scanner
  const startCamera = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        return;
      }
      
      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.65;
            return { width: size, height: size };
          }
        },
        (decodedText) => {
          handleTicketScanned(decodedText);
        },
        () => {}
      );

      setCameraActive(true);
      setCameraPermission('granted');
    } catch (err: any) {
      console.error('Camera startup error:', err);
      if (err.toString().includes('Permission')) {
        setCameraPermission('denied');
      }
      setCameraActive(false);
    }
  };

  // Stop Camera Scanner
  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setCameraActive(false);
      } catch (err) {
        console.error('Stop scanner error:', err);
      }
    }
  };

  // Verify scanned token
  const handleTicketScanned = async (token: string) => {
    await stopCamera();
    setScanState('VERIFYING');
    setErrorMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/entry/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ ticket_token: token, scanner_device: 'Mobile Scanner' }),
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        triggerHaptic(300);
        
        if (res.error?.code === 'UNPAID_TICKET') {
          playBeep('error');
          setScanState('UNPAID');
          setStudent(res.data?.student || null);
        } else {
          playBeep('error');
          setScanState('INVALID');
          setErrorMsg(res.error?.message || 'Invalid QR code.');
        }

        // Auto reset scanner after 3.5 seconds
        setTimeout(resetScanner, 3500);
        return;
      }

      const resultData = res.data;
      setStudent(resultData.student);
      setEntryDetails(resultData.entry_details);
      setIsTestModeScanned(!!resultData.is_test);

      if (resultData.status === 'ALREADY_ENTERED') {
        triggerHaptic([150, 100, 150]);
        playBeep('already');
        setScanState('ALREADY_ENTERED');
        // Do not auto-reset: coordinator needs to verify re-entry or click dismiss
      } else if (resultData.status === 'PENDING_CONFIRMATION') {
        setScanState('PENDING_CONFIRMATION');
        // Wait for manual coordinator visual verification
      }

    } catch (err) {
      console.error(err);
      triggerHaptic(300);
      playBeep('error');
      setScanState('INVALID');
      setErrorMsg('Network connectivity error.');
      setTimeout(resetScanner, 3500);
    }
  };

  // Mark entry / re-entry helper
  const handleMarkEntry = async (actionType: 'ENTRY' | 'RE_ENTRY') => {
    if (!student) return;
    setMarkingEntry(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/entry/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          registration_id: student.id,
          action: actionType,
          is_test: isTestModeScanned,
          scanner_device: 'Mobile QR Terminal'
        }),
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        triggerHaptic(300);
        playBeep('error');
        setScanState('INVALID');
        setErrorMsg(res.error?.message || 'Failed to mark entry.');
        setTimeout(resetScanner, 3500);
      } else {
        triggerHaptic([80, 50, 80]);
        playBeep('success');
        setScanState('MARKED');
        
        // Refresh local scanning logs
        fetchMyStats();
        
        // Auto reset scanner after 3 seconds for fast checking
        setTimeout(resetScanner, 3000);
      }
    } catch (err) {
      console.error(err);
      triggerHaptic(300);
      playBeep('error');
      setScanState('INVALID');
      setErrorMsg('Network connectivity error.');
      setTimeout(resetScanner, 3500);
    } finally {
      setMarkingEntry(false);
    }
  };

  // Reset scanner to scanning state
  const resetScanner = async () => {
    setStudent(null);
    setEntryDetails(null);
    setErrorMsg(null);
    setScanState('SCANNING');
    startCamera();
  };

  // Handle Logout
  const handleLogout = async () => {
    await stopCamera();
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    router.push('/coordinator/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#060214] text-slate-100 font-sans">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Loading Terminal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#060214] text-slate-100 font-sans px-4 py-8 max-w-lg mx-auto w-full justify-between">
      
      {/* 1. Header Area */}
      <header className="flex justify-between items-center pb-4 border-b border-white/5 mb-6">
        <div>
          <span className="text-[10px] text-purple-400 font-black tracking-widest uppercase">TERMINAL GATEWAY</span>
          <h1 className="text-lg font-black font-outfit text-white tracking-wide leading-none mt-1">ALGO-RHYTHM 2K26</h1>
        </div>
        
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-xl transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </header>

      {/* 2. Main Scan Viewport / Status Cards */}
      <main className="flex-1 flex flex-col justify-center items-center py-2 w-full gap-6">
        
        {scanState === 'SCANNING' && (
          <div className="w-full flex flex-col items-center gap-6">
            
            {/* Viewport container */}
            <div className="relative w-full aspect-square bg-[#0b0524] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
              <div id={scannerId} className="w-full h-full" />

              {/* Scanning crosshair line overlays */}
              {cameraActive && (
                <div className="absolute inset-0 border-[30px] border-[#060214]/60 pointer-events-none flex items-center justify-center">
                  <div className="w-[70%] h-[70%] border border-dashed border-purple-500/30 rounded-2xl relative">
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-purple-500 shadow-md shadow-purple-500/50 animate-bounce" />
                  </div>
                </div>
              )}

              {/* No camera prompt */}
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 bg-[#0a0522]">
                  {cameraPermission === 'denied' ? (
                    <>
                      <XCircle className="w-10 h-10 text-red-500" />
                      <h3 className="font-bold text-white text-sm">Camera Blocked</h3>
                      <p className="text-slate-500 text-xs leading-relaxed max-w-[250px]">
                        Please allow camera permission in your settings to scan tickets.
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      <p className="text-slate-500 text-xs">Initializing camera feed...</p>
                    </>
                  )}
                  <button 
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-xs font-semibold text-white uppercase tracking-wider cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Camera
                  </button>
                </div>
              )}
            </div>

            <div className="text-center">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400 animate-pulse bg-purple-500/5 px-4 py-1.5 rounded-full border border-purple-500/10">
                <Scan className="w-4 h-4" />
                Scan Ticket QR Code
              </span>
              <p className="text-slate-500 text-[10px] uppercase mt-2">Status: READY TO SCAN</p>
            </div>

          </div>
        )}

        {scanState === 'VERIFYING' && (
          <div className="glass-card rounded-3xl p-12 text-center w-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            <h2 className="text-xl font-bold font-outfit text-white">Verifying...</h2>
            <p className="text-slate-500 text-xs">Securing database lock.</p>
          </div>
        )}

        {/* Verification Screen: PENDING_CONFIRMATION */}
        {scanState === 'PENDING_CONFIRMATION' && student && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-purple-500/25 shadow-purple-500/5 shadow-2xl relative animate-fade-in">
            <div className="h-2 w-full bg-purple-500" />
            <div className="p-6 space-y-5 text-center flex flex-col items-center">
              
              <span className="text-[10px] uppercase tracking-wider text-purple-400 font-extrabold bg-purple-500/10 px-3.5 py-1 rounded-full border border-purple-500/10 flex items-center gap-1.5 animate-pulse">
                <CheckCircle className="w-4 h-4 text-purple-400" />
                ✓ TICKET FOUND
              </span>

              {/* LARGE STUDENT PHOTO */}
              <div className="w-48 h-48 rounded-2xl overflow-hidden border-2 border-purple-500/30 bg-black/40 flex items-center justify-center shrink-0 shadow-lg relative my-1">
                <img 
                  src={student.photo_url} 
                  alt="Scanned Student Attendee" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h3 className="text-xl font-black font-outfit text-white tracking-tight leading-tight">{student.full_name}</h3>
                <p className="text-purple-400 text-xs font-bold mt-1 font-mono">Ticket ID: {student.ticket_id || 'N/A'}</p>
                <p className="text-slate-300 text-xs font-bold mt-0.5 uppercase tracking-wider">{student.registration_number}</p>
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">{student.year} &bull; {student.school_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full text-xs pt-1">
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Payment Status</span>
                  <span className="font-extrabold text-emerald-400">✓ PAID</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Current Entry Status</span>
                  <span className="font-extrabold text-yellow-500">NOT ENTERED</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={resetScanner}
                  disabled={markingEntry}
                  className="w-full inline-flex justify-center items-center py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-red-500/10"
                >
                  Reject Entry
                </button>
                <button
                  onClick={() => handleMarkEntry('ENTRY')}
                  disabled={markingEntry}
                  className="w-full inline-flex justify-center items-center gap-1.5 py-3 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-500/10"
                >
                  {markingEntry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify & Mark Entry'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Marked/Success Check-in screen */}
        {scanState === 'MARKED' && student && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-emerald-500/20 shadow-emerald-500/5 shadow-2xl relative animate-fade-in">
            <div className="h-2 w-full bg-emerald-500" />
            <div className="p-6 space-y-5 text-center flex flex-col items-center py-8">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/10">
                ✓ ENTRY MARKED SUCCESSFULLY
              </span>

              {/* STUDENT PHOTO */}
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-black/40 flex items-center justify-center shrink-0 shadow-lg relative my-1">
                <img 
                  src={student.photo_url} 
                  alt="Scanned Student Attendee" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h3 className="text-xl font-black font-outfit text-white mt-1">{student.full_name}</h3>
                <p className="text-purple-300 text-xs font-bold mt-1 font-mono">Ticket ID: {student.ticket_id}</p>
                <p className="text-slate-300 text-xs font-bold mt-0.5 uppercase tracking-wider">{student.registration_number}</p>
                <p className="text-slate-400 text-[10px] mt-0.5">{student.year} &bull; {student.school_name}</p>
              </div>

              <div className="pt-4 border-t border-white/5 w-full">
                <p className="text-purple-300 text-xs font-bold uppercase tracking-wide">Welcome to ALGO-RHYTHM 2K26 🎉</p>
                <p className="text-slate-500 text-[9px] uppercase mt-1">Scanned by: {coordinator.name} &bull; {new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Already Entered screen */}
        {scanState === 'ALREADY_ENTERED' && student && entryDetails && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-red-500/25 shadow-red-500/5 shadow-2xl relative animate-fade-in">
            <div className="h-2 w-full bg-red-500" />
            <div className="p-6 space-y-5 text-center flex flex-col items-center">
              
              <span className="text-[10px] uppercase tracking-wider text-red-400 font-extrabold bg-red-500/10 px-3.5 py-1 rounded-full border border-red-500/10 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                ALREADY ENTERED
              </span>

              {/* STUDENT PHOTO */}
              <div className="w-44 h-44 rounded-2xl overflow-hidden border-2 border-red-500/20 bg-black/40 flex items-center justify-center shrink-0 shadow-lg relative my-1">
                <img 
                  src={student.photo_url} 
                  alt="Scanned Student Attendee" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h3 className="text-xl font-bold font-outfit text-white tracking-tight leading-tight">{student.full_name}</h3>
                <p className="text-amber-400 text-xs font-bold mt-1 font-mono">Ticket ID: {student.ticket_id}</p>
                <p className="text-slate-400 text-xs mt-0.5 font-semibold uppercase tracking-wider">{student.registration_number}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full text-xs">
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Payment Status</span>
                  <span className="font-extrabold text-emerald-400">✓ PAID</span>
                </div>
                <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-red-400 block">Current Status</span>
                  <span className="font-extrabold text-red-300">ALREADY ENTERED</span>
                </div>
              </div>

              <div className="space-y-2 text-xs bg-red-950/15 border border-red-500/15 p-4 rounded-xl text-left text-red-200 w-full animate-fade-in">
                <div className="flex justify-between border-b border-red-500/15 pb-1 mb-1 font-bold text-[9px] uppercase tracking-wider">
                  <span>Previous Entry Record</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-red-400/70">Previous entry time:</span>
                  <span className="font-semibold">{new Date(entryDetails.entry_time).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-red-400/70">Scanned By:</span>
                  <span className="font-semibold truncate max-w-[150px]">{entryDetails.scanned_by}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-red-400/70">Scanner device:</span>
                  <span className="font-semibold text-right truncate max-w-[150px]">{entryDetails.scanner_device}</span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="w-full grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={resetScanner}
                  disabled={markingEntry}
                  className="w-full inline-flex justify-center items-center py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-white/5"
                >
                  Dismiss / Reset
                </button>
                <button
                  onClick={() => handleMarkEntry('RE_ENTRY')}
                  disabled={markingEntry}
                  className="w-full inline-flex justify-center items-center gap-1.5 py-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  {markingEntry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Allow Re-Entry'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Unpaid Ticket warning screen */}
        {scanState === 'UNPAID' && student && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-yellow-500/20 shadow-yellow-500/5 shadow-2xl relative">
            <div className="h-2 w-full bg-yellow-500" />
            <div className="p-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-yellow-400 font-bold bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/10">
                  ❌ PAYMENT NOT VERIFIED
                </span>
                <h3 className="text-xl font-bold font-outfit text-white mt-4">{student.full_name}</h3>
                <p className="text-slate-400 text-xs mt-0.5">{student.registration_number}</p>
              </div>
              <p className="text-xs text-yellow-300 leading-normal max-w-xs mx-auto">
                Entry is not permitted. This ticket belongs to an unpaid registration.
              </p>
            </div>
          </div>
        )}

        {/* Invalid Ticket warning screen */}
        {scanState === 'INVALID' && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-red-500/20 shadow-red-500/5 shadow-2xl relative">
            <div className="h-2 w-full bg-red-500" />
            <div className="p-8 space-y-6 text-center py-10">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-full border border-red-500/10">
                  ❌ INVALID TICKET
                </span>
                <h3 className="text-lg font-bold text-white font-outfit mt-4">Scan Rejected</h3>
                <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                  {errorMsg || 'Ticket could not be verified.'}
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 3. Scan History & Statistics Area */}
      <footer className="mt-8 pt-4 border-t border-white/5">
        
        {/* Statistics block */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase">
            <History className="w-4 h-4 text-purple-400" />
            My Scans History
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-[10px] font-bold text-purple-300 uppercase border border-purple-500/10">
            Total Scans: {myStats.total_scans}
          </span>
        </div>

        {/* Recent scans list */}
        <div className="max-h-36 overflow-y-auto space-y-2 text-xs">
          {statsLoading && myStats.recent_scans.length === 0 ? (
            <div className="py-4 flex justify-center items-center text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading history...
            </div>
          ) : myStats.recent_scans.length === 0 ? (
            <div className="py-6 text-center text-slate-600 text-xs uppercase tracking-wider">
              No entries checked in by you yet.
            </div>
          ) : (
            myStats.recent_scans.slice(0, 5).map((log: any) => (
              <div 
                key={log.id} 
                className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-xl"
              >
                <div>
                  <p className="font-bold text-white leading-none">{log.student_name}</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">{log.registration_number} &bull; {log.ticket_id}</p>
                </div>
                <span className="text-[10px] font-semibold text-slate-400">
                  {new Date(log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Camera toggle controller */}
        <div className="grid grid-cols-2 gap-3 mt-4 print:hidden">
          <button
            onClick={cameraActive ? stopCamera : startCamera}
            className={`w-full inline-flex justify-center items-center gap-1.5 px-4 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors ${
              cameraActive 
                ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-300'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/10'
            }`}
          >
            <Camera className="w-4 h-4" />
            {cameraActive ? 'Stop Camera' : 'Start Camera'}
          </button>
          
          <button
            onClick={resetScanner}
            disabled={scanState === 'SCANNING'}
            className="w-full inline-flex justify-center items-center gap-1.5 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-wider rounded-xl text-white cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Scanner
          </button>
        </div>

      </footer>

    </div>
  );
}

export const dynamic = 'force-dynamic';
