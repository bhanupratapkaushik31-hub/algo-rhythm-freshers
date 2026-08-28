'use client';

import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Scan, 
  Camera, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  UserCheck,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { EVENT_CONFIG } from '@/config/event';

type ScanResultState = 'SCANNING' | 'VERIFYING' | 'VALID' | 'ALREADY_ENTERED' | 'INVALID' | 'UNPAID' | 'MARKED';

interface ScannedStudent {
  id: string;
  ticket_id: string;
  full_name: string;
  registration_number: string;
  year: '1st Year' | '2nd Year';
  school_name: string;
  modeling: 'Yes' | 'No';
  registration_status: string;
}

export default function AdminScanner() {
  const [scanState, setScanState] = useState<ScanResultState>('SCANNING');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [entryDetails, setEntryDetails] = useState<any>(null);
  const [markingEntry, setMarkingEntry] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'qr-reader-viewport';

  // 1. Synth Beep Sound Feedback using Web Audio API
  const playBeep = (type: 'success' | 'error' | 'success-marked') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // high pitch
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'success-marked') {
        // Double high-pitch beep for entry marked!
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.12); // higher pitch C6
        gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(180, ctx.currentTime); // low buzz
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio check-in blocked/unsupported', e);
    }
  };

  // 2. Haptic Vibration Pulse
  const triggerHaptic = (duration: number | number[]) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  };

  // 3. Initialize & Start Camera Scanner
  const startCamera = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        return;
      }

      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // force back camera
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.65;
            return { width: size, height: size };
          }
        },
        (decodedText) => {
          // Scanned ticket token successfully
          handleTicketScanned(decodedText);
        },
        () => {
          // Scanning fail callbacks (triggered on every frame without match, safe to ignore)
        }
      );

      setCameraActive(true);
      setCameraPermission('granted');
    } catch (err: any) {
      console.error('Camera startup failed:', err);
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

  useEffect(() => {
    // Start camera scanner on mount
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // 4. Verify scanned token
  const handleTicketScanned = async (token: string) => {
    // Temporarily pause camera scans
    await stopCamera();
    setScanState('VERIFYING');
    setErrorMsg(null);

    try {
      // Get authentication session access token
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/entry/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ ticket_token: token }),
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        triggerHaptic(300);
        playBeep('error');
        
        if (res.error?.code === 'UNPAID_TICKET') {
          setScanState('UNPAID');
          setStudent(res.data?.student || null);
        } else {
          setScanState('INVALID');
          setErrorMsg(res.error?.message || 'Unable to verify this ticket.');
        }
        return;
      }

      // Successful lookup
      const resultData = res.data;
      triggerHaptic(100);
      playBeep('success');

      if (resultData.status === 'ALREADY_ENTERED') {
        setScanState('ALREADY_ENTERED');
        setStudent(resultData.student);
        setEntryDetails(resultData.entry_details);
      } else if (resultData.status === 'VALID' || resultData.status === 'MARKED') {
        setScanState('MARKED');
        setStudent(resultData.student);
      }

    } catch (err) {
      console.error(err);
      triggerHaptic(300);
      playBeep('error');
      setScanState('INVALID');
      setErrorMsg('Network error checking ticket validity.');
    }
  };

  // 5. Check-in Student (Mark Entry)
  const handleMarkEntry = async () => {
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
        body: JSON.stringify({ registration_id: student.id }),
      });

      const res = await response.json();

      if (response.ok && res.success) {
        triggerHaptic([80, 50, 100]); // double pulse
        playBeep('success-marked');
        setScanState('MARKED');
      } else {
        alert(res.error?.message || 'Failed to check in student.');
      }

    } catch (err) {
      console.error(err);
      alert('Failed to check in student due to connection errors.');
    } finally {
      setMarkingEntry(false);
    }
  };

  // 6. Reset scanner to scanning state
  const resetScanner = async () => {
    setStudent(null);
    setEntryDetails(null);
    setErrorMsg(null);
    setScanState('SCANNING');
    startCamera();
  };

  return (
    <AdminLayout requiredRoles={['super_admin', 'admin', 'scanner']}>
      
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold font-outfit text-white tracking-tight">QR Entry Checker</h1>
        <p className="text-slate-400 text-xs mt-1">Scan student ticket QR code to verify details and mark entry.</p>
      </div>

      {/* Render based on scanState */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
        
        {scanState === 'SCANNING' && (
          <div className="w-full flex flex-col items-center gap-6">
            
            {/* Viewport container for Html5Qrcode camera renderer */}
            <div className="relative w-full aspect-square bg-[#0b0524] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
              
              {/* Camera viewer element */}
              <div id={scannerId} className="w-full h-full" />

              {/* Scanning crosshair line animation overlays (only show when camera is active) */}
              {cameraActive && (
                <div className="absolute inset-0 border-[30px] border-[#060214]/50 pointer-events-none flex items-center justify-center">
                  <div className="w-[65%] h-[65%] border-2 border-dashed border-purple-500/40 rounded-xl relative">
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-purple-500 shadow-lg shadow-purple-500/50 animate-bounce" />
                  </div>
                </div>
              )}

              {/* No camera prompt */}
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 bg-[#0a0522]">
                  {cameraPermission === 'denied' ? (
                    <>
                      <XCircle className="w-10 h-10 text-red-500" />
                      <h3 className="font-bold text-white text-sm">Camera Permission Denied</h3>
                      <p className="text-slate-500 text-xs leading-relaxed max-w-[250px]">
                        Please allow camera permission in your browser settings to scan ticket QR codes.
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      <p className="text-slate-500 text-xs">Accessing camera stream...</p>
                    </>
                  )}
                  <button 
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-xs font-semibold text-white uppercase tracking-wider"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Camera
                  </button>
                </div>
              )}
            </div>

            <div className="text-center">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400 animate-pulse">
                <Scan className="w-4 h-4" />
                Scan Entry QR Code
              </span>
              <p className="text-slate-500 text-[10px] uppercase mt-1">Align the QR code inside the viewport box</p>
            </div>

          </div>
        )}

        {scanState === 'VERIFYING' && (
          <div className="glass-card rounded-3xl p-12 text-center w-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            <h2 className="text-xl font-bold font-outfit text-white">Verifying Ticket...</h2>
            <p className="text-slate-500 text-xs">Querying database for ticket validation state.</p>
          </div>
        )}

        {/* Valid Ticket Card */}
        {scanState === 'VALID' && student && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-emerald-500/20 shadow-emerald-500/5 shadow-2xl relative">
            <div className="h-2 w-full bg-emerald-500" />
            <div className="p-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">
                  ✓ VALID TICKET
                </span>
                <h3 className="text-2xl font-black font-outfit text-white mt-4">{student.full_name}</h3>
                <p className="text-slate-400 text-xs mt-0.5">{student.registration_number}</p>
              </div>

              <div className="space-y-2.5 text-xs bg-white/5 border border-white/5 p-4 rounded-2xl text-left text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Year:</span>
                  <span className="font-bold text-slate-200">{student.year}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Modeling:</span>
                  <span className="font-bold text-slate-200">{student.modeling}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">School:</span>
                  <span className="font-semibold text-slate-200 truncate max-w-[200px]">{student.school_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ticket ID:</span>
                  <span className="font-bold text-amber-500">{student.ticket_id}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={resetScanner}
                  className="flex-1 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-[#f8fafc] font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Cancel Scan
                </button>
                <button
                  onClick={handleMarkEntry}
                  disabled={markingEntry}
                  className="flex-1 inline-flex justify-center items-center gap-1.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  {markingEntry ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  Mark Entry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entry Marked Success Card */}
        {scanState === 'MARKED' && student && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-emerald-500/20 shadow-emerald-500/5 shadow-2xl relative">
            <div className="h-2 w-full bg-emerald-500" />
            <div className="p-8 space-y-6 text-center py-12">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/10">
                  ✓ ENTRY MARKED
                </span>
                <h3 className="text-2xl font-black font-outfit text-white mt-4">{student.full_name}</h3>
                <p className="text-purple-300 text-xs font-semibold mt-1">Welcome to ALGO-RHYTHM 2K26 🎉</p>
                <p className="text-slate-500 text-[10px] uppercase mt-2">Ticket ID: {student.ticket_id}</p>
              </div>

              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={resetScanner}
                  className="w-full inline-flex justify-center items-center gap-1.5 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Scan Next Ticket
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Already Entered Warning Card */}
        {scanState === 'ALREADY_ENTERED' && student && entryDetails && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-red-500/20 shadow-red-500/5 shadow-2xl relative">
            <div className="h-2 w-full bg-red-500" />
            <div className="p-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-full border border-red-500/10">
                  ⚠️ ALREADY ENTERED
                </span>
                <h3 className="text-xl font-bold font-outfit text-white mt-4">{student.full_name}</h3>
                <p className="text-slate-400 text-xs mt-0.5">{student.registration_number} &bull; {student.year}</p>
              </div>

              <div className="space-y-2.5 text-xs bg-red-950/10 border border-red-500/15 p-4 rounded-2xl text-left text-red-200">
                <div className="font-bold text-center border-b border-red-500/15 pb-2 mb-2 uppercase text-[10px] tracking-wider">
                  Check-in log details
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400/70">Check-in time:</span>
                  <span className="font-semibold">{new Date(entryDetails.entry_time).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400/70">Scanned By:</span>
                  <span className="font-semibold">{entryDetails.scanned_by}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400/70">Device:</span>
                  <span className="font-semibold">{entryDetails.scanner_device}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-normal max-w-xs mx-auto">
                This ticket was already checked-in and cannot be reused. Duplicate entry check-in blocked.
              </p>

              <div className="pt-2">
                <button
                  onClick={resetScanner}
                  className="w-full px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Scan Next Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unpaid Ticket Warning */}
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

              <p className="text-xs text-yellow-200 bg-yellow-950/20 border border-yellow-500/20 p-4 rounded-xl text-center leading-relaxed">
                This ticket belongs to an unpaid registration. Unpaid registrations are not permitted entry. Let them complete payment online or contact coordinators.
              </p>

              <div className="pt-2">
                <button
                  onClick={resetScanner}
                  className="w-full px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Scan Next Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invalid Ticket Card */}
        {scanState === 'INVALID' && (
          <div className="w-full glass-card rounded-3xl overflow-hidden border-red-500/20 shadow-red-500/5 shadow-2xl relative">
            <div className="h-2 w-full bg-red-500" />
            <div className="p-8 space-y-6 text-center py-12">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-full border border-red-500/10">
                  ❌ INVALID TICKET
                </span>
                <h3 className="text-lg font-bold text-white font-outfit mt-4">Verification Failed</h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-xs mx-auto">
                  {errorMsg || 'Unable to verify this ticket. This token does not correspond to any registered student.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={resetScanner}
                  className="w-full px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Scan Next Ticket
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </AdminLayout>
  );
}
export const dynamic = 'force-dynamic';
