import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { EntryService } from '../services/api';
import { AuthService, CoordinatorProfile } from '../services/auth';
import { APP_CONFIG } from '../config/env';

const qr100Img = require('../../assets/qr_100.jpg');
const qr200Img = require('../../assets/qr_200.jpg');

type ScanResultState =
  | 'SCANNING'
  | 'VERIFYING'
  | 'PENDING_CONFIRMATION'
  | 'MARKED'
  | 'ALREADY_ENTERED'
  | 'UNPAID'
  | 'INVALID';

interface ScannedStudent {
  id: string;
  ticket_id: string;
  full_name: string;
  registration_number: string;
  year: string;
  school_name: string;
  modeling: string;
  photo_url?: string;
  registration_status?: string;
  entry_status?: string;
}

interface ScannerScreenProps {
  coordinator: CoordinatorProfile;
  onLogout: () => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ coordinator, onLogout }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);

  // Scan lifecycle states
  const [scanState, setScanState] = useState<ScanResultState>('SCANNING');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [entryDetails, setEntryDetails] = useState<any>(null);
  const [markingEntry, setMarkingEntry] = useState(false);
  const [isTestModeScanned, setIsTestModeScanned] = useState(false);

  // Debounce & atomic locks
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const autoResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Manual entry modal
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualToken, setManualToken] = useState('');

  // Stats
  const [totalScanned, setTotalScanned] = useState(0);

  // On-Spot Entry States
  const [onSpotModalVisible, setOnSpotModalVisible] = useState(false);
  const [onSpotStep, setOnSpotStep] = useState<'FORM' | 'CAMERA' | 'QR' | 'SUCCESS'>('FORM');
  const [onSpotRegNo, setOnSpotRegNo] = useState('');
  const [onSpotSelectedYear, setOnSpotSelectedYear] = useState<'1st Year' | '2nd Year' | null>(null);
  const [onSpotName, setOnSpotName] = useState('');
  const [onSpotEmail, setOnSpotEmail] = useState('');
  const [onSpotPhone, setOnSpotPhone] = useState('');
  const [onSpotPhotoUri, setOnSpotPhotoUri] = useState<string | null>(null);
  const [onSpotPhotoBase64, setOnSpotPhotoBase64] = useState<string | null>(null);
  const [onSpotFacing, setOnSpotFacing] = useState<'back' | 'front'>('back');
  const [onSpotSubmitting, setOnSpotSubmitting] = useState(false);
  const [onSpotError, setOnSpotError] = useState<string | null>(null);
  const [onSpotSuccessData, setOnSpotSuccessData] = useState<any | null>(null);
  const onSpotCameraRef = useRef<any>(null);

  useEffect(() => {
    fetchStats();
    return () => {
      if (autoResetTimeoutRef.current) {
        clearTimeout(autoResetTimeoutRef.current);
      }
    };
  }, []);

  const fetchStats = async () => {
    const stats = await EntryService.getStats();
    setTotalScanned(stats.total_scans);
  };

  const playHaptic = (type: 'success' | 'warning' | 'error' | 'medium') => {
    try {
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}
  };

  const scheduleAutoReset = (delay: number) => {
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
    }
    autoResetTimeoutRef.current = setTimeout(() => {
      resetScanner();
    }, delay);
  };

  const processTokenVerification = async (token: string) => {
    setScanState('VERIFYING');
    setErrorMsg(null);
    playHaptic('medium');

    const res = await EntryService.verifyTicket(token);

    if (!res.success) {
      playHaptic('error');
      if (res.error?.code === 'UNPAID_TICKET') {
        setScanState('UNPAID');
        setStudent(res.data?.student || res.student || null);
      } else {
        setScanState('INVALID');
        setErrorMsg(res.error?.message || 'Invalid or unregistered QR code.');
      }
      return;
    }

    const resultData = res.data || res;
    const resolvedStudent = resultData.student || res.student;
    const resolvedStatus = resultData.status || res.status;
    const resolvedEntryDetails = resultData.entry_details || res.entry_details;
    const isTest = !!resultData.is_test;

    setStudent(resolvedStudent);
    setEntryDetails(resolvedEntryDetails);
    setIsTestModeScanned(isTest);

    if (resolvedStatus === 'MARKED') {
      playHaptic('success');
      setScanState('MARKED');
      fetchStats();
      scheduleAutoReset(3500);
    } else if (resolvedStatus === 'ALREADY_ENTERED') {
      playHaptic('warning');
      setScanState('ALREADY_ENTERED');
    } else if (resolvedStatus === 'PENDING_CONFIRMATION' || resolvedStudent) {
      playHaptic('medium');
      setScanState('PENDING_CONFIRMATION');
    } else {
      playHaptic('error');
      setScanState('INVALID');
      setErrorMsg('Unexpected ticket response.');
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanState !== 'SCANNING' || isProcessingRef.current) return;

    const clean = data.trim();
    if (!clean) return;

    const now = Date.now();
    if (clean === lastScannedTokenRef.current && now - lastScanTimeRef.current < 4000) {
      return;
    }

    isProcessingRef.current = true;
    lastScannedTokenRef.current = clean;
    lastScanTimeRef.current = now;

    await processTokenVerification(clean);
  };

  const handleManualSubmit = async () => {
    if (!manualToken.trim()) return;
    const token = manualToken.trim();
    setManualModalVisible(false);
    setManualToken('');
    isProcessingRef.current = true;
    await processTokenVerification(token);
  };

  const handleMarkEntry = async (actionType: 'ENTRY' | 'RE_ENTRY') => {
    if (!student?.id) return;
    setMarkingEntry(true);

    try {
      const res = await EntryService.markEntry(student.id, actionType, isTestModeScanned);
      setMarkingEntry(false);

      if (res.success) {
        playHaptic('success');
        setScanState('MARKED');
        fetchStats();
        scheduleAutoReset(3500);
      } else {
        playHaptic('error');
        setScanState('INVALID');
        setErrorMsg(res.error?.message || 'Failed to mark entry check-in.');
      }
    } catch (err: any) {
      setMarkingEntry(false);
      playHaptic('error');
      setScanState('INVALID');
      setErrorMsg(err?.message || 'Network connectivity error.');
    }
  };

  const resetScanner = () => {
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
      autoResetTimeoutRef.current = null;
    }
    setStudent(null);
    setEntryDetails(null);
    setErrorMsg(null);
    setScanState('SCANNING');
    isProcessingRef.current = false;
  };

  // On-Spot Calculations & Handlers
  const detected1stYear = onSpotRegNo.trim().startsWith('126');
  const effectiveYear = onSpotSelectedYear || (detected1stYear ? '1st Year' : '2nd Year');
  const is1stYearOnSpot = effectiveYear === '1st Year';
  const onSpotYear = effectiveYear;
  const onSpotFee = is1stYearOnSpot ? 100 : 200;

  const resetOnSpotForm = () => {
    setOnSpotRegNo('');
    setOnSpotSelectedYear(null);
    setOnSpotName('');
    setOnSpotEmail('');
    setOnSpotPhone('');
    setOnSpotPhotoUri(null);
    setOnSpotPhotoBase64(null);
    setOnSpotError(null);
    setOnSpotSuccessData(null);
    setOnSpotStep('FORM');
  };

  const handleSnapAttendeePhoto = async () => {
    try {
      if (!onSpotCameraRef.current) return;
      const photo = await onSpotCameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
      });
      if (photo) {
        setOnSpotPhotoUri(photo.uri);
        setOnSpotPhotoBase64(photo.base64 || null);
        setOnSpotStep('FORM');
      }
    } catch (err: any) {
      console.warn('Take photo error:', err);
      Alert.alert('Camera Error', 'Could not capture attendee photo.');
    }
  };

  const handleProceedToQR = () => {
    const reg = onSpotRegNo.trim();
    const name = onSpotName.trim();
    const em = onSpotEmail.trim();
    const ph = onSpotPhone.trim();

    if (!reg || !name || !em || !ph) {
      setOnSpotError('Please fill in Registration Number, Full Name, Email, and Phone.');
      return;
    }
    if (!em.includes('@')) {
      setOnSpotError('Please enter a valid email address.');
      return;
    }
    if (ph.length < 10) {
      setOnSpotError('Please enter a valid 10-digit phone number.');
      return;
    }

    setOnSpotError(null);
    setOnSpotStep('QR');
  };

  const handleConfirmOnSpotPayment = async () => {
    setOnSpotSubmitting(true);
    setOnSpotError(null);

    const res = await EntryService.onSpotEntry({
      registration_number: onSpotRegNo.trim(),
      full_name: onSpotName.trim(),
      email: onSpotEmail.trim(),
      phone: onSpotPhone.trim(),
      year: onSpotYear,
      photo_base64: onSpotPhotoBase64 || undefined,
    });

    setOnSpotSubmitting(false);

    if (res.success) {
      playHaptic('success');
      setTotalScanned(prev => prev + 1);
      setOnSpotSuccessData(res.data);
      setOnSpotStep('SUCCESS');
    } else {
      playHaptic('error');
      setOnSpotError(res.error?.message || 'Failed to confirm on-spot entry.');
    }
  };

  const handleLogoutConfirm = () => {
    Alert.alert(
      'Confirm Sign Out',
      'Are you sure you want to sign out? Your credentials are kept safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await AuthService.logout();
            onLogout();
          },
        },
      ]
    );
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.permissionText}>Loading camera configuration...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          The Algo-Rhythm Coordinator app requires camera permissions to scan attendee ticket QR codes.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const studentPhotoUri = student?.photo_url
    ? student.photo_url
    : student?.id
    ? `${APP_CONFIG.API_BASE_URL}/api/admin/registrations/${student.id}/photo`
    : undefined;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#060214" />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerCategory}>TERMINAL GATEWAY</Text>
          <Text style={styles.headerTitle}>ALGO-RHYTHM 2K26</Text>
          <Text style={styles.headerSubtitle}>
            Coordinator: <Text style={styles.coordinatorName}>{coordinator.name || coordinator.email}</Text>
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.statsBadge}>
            <Text style={styles.statsBadgeText}>✓ {totalScanned} Scanned</Text>
          </View>
          <TouchableOpacity onPress={handleLogoutConfirm} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Viewport & Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanState === 'SCANNING' ? handleBarCodeScanned : undefined}
        />

        {/* Viewfinder Target Reticle Overlay */}
        <View style={styles.overlay}>
          <View style={styles.targetFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.scanningLine} />
          </View>
          <View style={styles.hintPill}>
            <Text style={styles.hintText}>⚡ POINT CAMERA AT TICKET QR CODE</Text>
          </View>
        </View>
      </View>

      {/* Bottom Controls Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.controlBtn, torch && styles.controlBtnActive]}
          onPress={() => setTorch(!torch)}
        >
          <Text style={styles.controlBtnText}>{torch ? '🔦 Torch ON' : '💡 Torch'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
        >
          <Text style={styles.controlBtnText}>🔄 Flip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setManualModalVisible(true)}
        >
          <Text style={styles.controlBtnText}>⌨️ Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.onSpotControlBtn]}
          onPress={() => {
            resetOnSpotForm();
            setOnSpotModalVisible(true);
          }}
        >
          <Text style={styles.onSpotControlBtnText}>⚡ On-Spot</Text>
        </TouchableOpacity>
      </View>

      {/* VERIFYING OVERLAY */}
      {scanState === 'VERIFYING' && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.centerModalBackdrop}>
            <View style={styles.verifyingCard}>
              <ActivityIndicator size="large" color="#c084fc" />
              <Text style={styles.verifyingCardTitle}>Verifying Ticket...</Text>
              <Text style={styles.verifyingCardSubtitle}>Securing database lock</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* PENDING_CONFIRMATION: TICKET FOUND (COORDINATOR VERIFICATION) */}
      {scanState === 'PENDING_CONFIRMATION' && student && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.purpleTopAccent} />

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Status Pill */}
                <View style={styles.pillContainer}>
                  <View style={styles.ticketFoundPill}>
                    <Text style={styles.ticketFoundPillText}>✓ TICKET FOUND</Text>
                  </View>
                </View>

                {/* Large Student Photo */}
                <View style={styles.photoContainer}>
                  {studentPhotoUri ? (
                    <Image source={{ uri: studentPhotoUri }} style={styles.studentLargePhoto} />
                  ) : (
                    <View style={[styles.studentLargePhoto, styles.photoPlaceholder]}>
                      <Text style={styles.photoPlaceholderText}>NO PHOTO</Text>
                    </View>
                  )}
                </View>

                {/* Student Info */}
                <View style={styles.studentInfoCenter}>
                  <Text style={styles.studentFullName}>{student.full_name}</Text>
                  <Text style={styles.studentTicketId}>Ticket ID: {student.ticket_id || 'N/A'}</Text>
                  <Text style={styles.studentRegNoBold}>{student.registration_number}</Text>
                  <Text style={styles.studentSubDetails}>
                    {student.year} &bull; {student.school_name || 'School of Computing'}
                  </Text>
                  {student.modeling === 'Yes' && (
                    <View style={styles.modelingBadge}>
                      <Text style={styles.modelingBadgeText}>👑 MODELING CANDIDATE</Text>
                    </View>
                  )}
                </View>

                {/* Payment & Entry Status Grid */}
                <View style={styles.statusGrid}>
                  <View style={styles.statusGridBox}>
                    <Text style={styles.statusGridLabel}>PAYMENT STATUS</Text>
                    <Text style={styles.statusPaidText}>✓ PAID</Text>
                  </View>
                  <View style={styles.statusGridBox}>
                    <Text style={styles.statusGridLabel}>CURRENT STATUS</Text>
                    <Text style={styles.statusNotEnteredText}>NOT ENTERED</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionGrid}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={resetScanner}
                    disabled={markingEntry}
                  >
                    <Text style={styles.rejectBtnText}>Reject Entry</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.markEntryBtn}
                    onPress={() => handleMarkEntry('ENTRY')}
                    disabled={markingEntry}
                  >
                    {markingEntry ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.markEntryBtnText}>Verify & Mark Entry</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* MARKED: ENTRY MARKED SUCCESSFULLY */}
      {scanState === 'MARKED' && student && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.emeraldTopAccent} />

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.pillContainer}>
                  <View style={styles.markedSuccessPill}>
                    <Text style={styles.markedSuccessPillText}>✓ ENTRY MARKED SUCCESSFULLY</Text>
                  </View>
                </View>

                <View style={styles.photoContainer}>
                  {studentPhotoUri ? (
                    <Image source={{ uri: studentPhotoUri }} style={styles.studentMediumPhoto} />
                  ) : (
                    <View style={[styles.studentMediumPhoto, styles.photoPlaceholder]}>
                      <Text style={styles.photoPlaceholderText}>NO PHOTO</Text>
                    </View>
                  )}
                </View>

                <View style={styles.studentInfoCenter}>
                  <Text style={styles.studentFullName}>{student.full_name}</Text>
                  <Text style={styles.studentTicketId}>Ticket ID: {student.ticket_id || 'N/A'}</Text>
                  <Text style={styles.studentRegNoBold}>{student.registration_number}</Text>
                  <Text style={styles.studentSubDetails}>
                    {student.year} &bull; {student.school_name || 'School of Computing'}
                  </Text>
                </View>

                <View style={styles.welcomeBox}>
                  <Text style={styles.welcomeTitle}>Welcome to ALGO-RHYTHM 2K26 🎉</Text>
                  <Text style={styles.welcomeSubtitle}>
                    Scanned by: {coordinator.name || coordinator.email} &bull; {new Date().toLocaleTimeString()}
                  </Text>
                </View>

                <TouchableOpacity style={styles.scanNextBtn} onPress={resetScanner}>
                  <Text style={styles.scanNextBtnText}>SCAN NEXT TICKET</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ALREADY_ENTERED: WARNING */}
      {scanState === 'ALREADY_ENTERED' && student && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.redTopAccent} />

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.pillContainer}>
                  <View style={styles.alreadyEnteredPill}>
                    <Text style={styles.alreadyEnteredPillText}>⚠️ ALREADY ENTERED</Text>
                  </View>
                </View>

                <View style={styles.photoContainer}>
                  {studentPhotoUri ? (
                    <Image source={{ uri: studentPhotoUri }} style={styles.studentMediumPhoto} />
                  ) : (
                    <View style={[styles.studentMediumPhoto, styles.photoPlaceholder]}>
                      <Text style={styles.photoPlaceholderText}>NO PHOTO</Text>
                    </View>
                  )}
                </View>

                <View style={styles.studentInfoCenter}>
                  <Text style={styles.studentFullName}>{student.full_name}</Text>
                  <Text style={styles.studentTicketId}>Ticket ID: {student.ticket_id || 'N/A'}</Text>
                  <Text style={styles.studentRegNoBold}>{student.registration_number}</Text>
                </View>

                <View style={styles.statusGrid}>
                  <View style={styles.statusGridBox}>
                    <Text style={styles.statusGridLabel}>PAYMENT STATUS</Text>
                    <Text style={styles.statusPaidText}>✓ PAID</Text>
                  </View>
                  <View style={[styles.statusGridBox, styles.statusGridBoxRed]}>
                    <Text style={styles.statusGridLabelRed}>CURRENT STATUS</Text>
                    <Text style={styles.statusAlreadyText}>ALREADY ENTERED</Text>
                  </View>
                </View>

                {entryDetails && (
                  <View style={styles.prevAuditBox}>
                    <Text style={styles.prevAuditHeading}>PREVIOUS ENTRY RECORD</Text>
                    <View style={styles.prevAuditRow}>
                      <Text style={styles.prevAuditLabel}>Previous Entry Time:</Text>
                      <Text style={styles.prevAuditValue}>
                        {entryDetails.entry_time
                          ? new Date(entryDetails.entry_time).toLocaleString()
                          : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.prevAuditRow}>
                      <Text style={styles.prevAuditLabel}>Scanned By:</Text>
                      <Text style={styles.prevAuditValue}>{entryDetails.scanned_by || 'Coordinator'}</Text>
                    </View>
                    <View style={styles.prevAuditRow}>
                      <Text style={styles.prevAuditLabel}>Scanner Device:</Text>
                      <Text style={styles.prevAuditValue}>{entryDetails.scanner_device || 'Terminal'}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.actionGrid}>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={resetScanner}
                    disabled={markingEntry}
                  >
                    <Text style={styles.dismissBtnText}>Dismiss / Reset</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reEntryBtn}
                    onPress={() => handleMarkEntry('RE_ENTRY')}
                    disabled={markingEntry}
                  >
                    {markingEntry ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.reEntryBtnText}>Allow Re-Entry</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* UNPAID TICKET SCREEN */}
      {scanState === 'UNPAID' && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.yellowTopAccent} />

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.pillContainer}>
                  <View style={styles.unpaidPill}>
                    <Text style={styles.unpaidPillText}>❌ PAYMENT NOT VERIFIED</Text>
                  </View>
                </View>

                <View style={styles.errorIconCircle}>
                  <Text style={{ fontSize: 32 }}>⚠️</Text>
                </View>

                {student && (
                  <View style={styles.studentInfoCenter}>
                    <Text style={styles.studentFullName}>{student.full_name}</Text>
                    <Text style={styles.studentRegNoBold}>{student.registration_number}</Text>
                  </View>
                )}

                <Text style={styles.unpaidWarningText}>
                  Entry is not permitted. This ticket belongs to an unpaid registration.
                </Text>

                <TouchableOpacity style={styles.dismissBtnFull} onPress={resetScanner}>
                  <Text style={styles.dismissBtnText}>SCAN NEXT TICKET</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* INVALID TICKET SCREEN */}
      {scanState === 'INVALID' && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.redTopAccent} />

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.pillContainer}>
                  <View style={styles.invalidPill}>
                    <Text style={styles.invalidPillText}>❌ INVALID TICKET</Text>
                  </View>
                </View>

                <View style={styles.errorIconCircleRed}>
                  <Text style={{ fontSize: 32 }}>✕</Text>
                </View>

                <Text style={styles.scanRejectedHeading}>Scan Rejected</Text>
                <Text style={styles.invalidErrorText}>
                  {errorMsg || 'Ticket could not be verified or record was not found.'}
                </Text>

                <TouchableOpacity style={styles.dismissBtnFull} onPress={resetScanner}>
                  <Text style={styles.dismissBtnText}>SCAN NEXT TICKET</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Manual Code Modal */}
      <Modal visible={manualModalVisible} transparent animationType="fade">
        <View style={styles.centerModalBackdrop}>
          <View style={styles.manualCard}>
            <Text style={styles.manualTitle}>Manual Ticket Verification</Text>
            <Text style={styles.manualSubtitle}>
              Enter Ticket ID (e.g. ALG26-CSE-0001) or Registration Number:
            </Text>

            <TextInput
              style={styles.manualInput}
              placeholder="e.g. 12401234 or Ticket Token"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              value={manualToken}
              onChangeText={setManualToken}
              autoFocus
            />

            <View style={styles.manualActionRow}>
              <TouchableOpacity
                style={styles.manualCancelBtn}
                onPress={() => setManualModalVisible(false)}
              >
                <Text style={styles.manualCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.manualSubmitBtn} onPress={handleManualSubmit}>
                <Text style={styles.manualSubmitText}>Verify Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* On-Spot Gate Entry Modal */}
      <Modal visible={onSpotModalVisible} animationType="slide" transparent={onSpotStep !== 'CAMERA'}>
        {onSpotStep === 'CAMERA' ? (
          <View style={styles.onSpotCameraContainer}>
            <CameraView
              ref={onSpotCameraRef}
              style={StyleSheet.absoluteFillObject}
              facing={onSpotFacing}
            />
            <View style={styles.onSpotCameraOverlay}>
              <View style={styles.onSpotCameraHeader}>
                <TouchableOpacity
                  style={styles.onSpotCameraCloseBtn}
                  onPress={() => setOnSpotStep('FORM')}
                >
                  <Text style={styles.onSpotCameraCloseText}>✕ Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.onSpotCameraFlipBtn}
                  onPress={() => setOnSpotFacing(onSpotFacing === 'back' ? 'front' : 'back')}
                >
                  <Text style={styles.onSpotCameraCloseText}>🔄 Flip Camera</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.onSpotFaceGuide}>
                <View style={styles.faceOvalGuide} />
                <Text style={styles.faceGuideText}>Position attendee face inside frame</Text>
              </View>

              <View style={styles.onSpotShutterRow}>
                <TouchableOpacity
                  style={styles.onSpotShutterBtn}
                  onPress={handleSnapAttendeePhoto}
                >
                  <View style={styles.onSpotShutterInner} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.modalBackdrop}>
            <View style={styles.onSpotCard}>
              {onSpotStep === 'FORM' && (
                <ScrollView contentContainerStyle={styles.onSpotScroll} keyboardShouldPersistTaps="handled">
                  <View style={styles.onSpotHeaderRow}>
                    <View>
                      <Text style={styles.onSpotMainTitle}>⚡ On-Spot Gate Entry</Text>
                      <Text style={styles.onSpotMainSubtitle}>Quick Registration & Spot Check-in</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setOnSpotModalVisible(false)}
                      style={styles.onSpotCloseIconBtn}
                    >
                      <Text style={styles.onSpotCloseIconText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Year & Pricing Banner */}
                  <View style={styles.onSpotFeeBanner}>
                    <Text style={styles.onSpotFeeBannerTitle}>
                      {`Selected: ${onSpotYear}`}
                    </Text>
                    <Text style={styles.onSpotFeeBannerAmount}>Ticket Fee: ₹{onSpotFee}</Text>
                  </View>

                  {/* Batch / Year Toggle Buttons */}
                  <View style={styles.onSpotYearSelectorRow}>
                    <TouchableOpacity
                      style={[
                        styles.onSpotYearPill,
                        is1stYearOnSpot && styles.onSpotYearPillActive100,
                      ]}
                      onPress={() => setOnSpotSelectedYear('1st Year')}
                    >
                      <Text
                        style={[
                          styles.onSpotYearPillText,
                          is1stYearOnSpot && styles.onSpotYearPillTextActive,
                        ]}
                      >
                        🎓 1st Year (₹100)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.onSpotYearPill,
                        !is1stYearOnSpot && styles.onSpotYearPillActive200,
                      ]}
                      onPress={() => setOnSpotSelectedYear('2nd Year')}
                    >
                      <Text
                        style={[
                          styles.onSpotYearPillText,
                          !is1stYearOnSpot && styles.onSpotYearPillTextActive,
                        ]}
                      >
                        🏆 2nd Year (₹200)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {onSpotError && (
                    <View style={styles.onSpotErrorBox}>
                      <Text style={styles.onSpotErrorText}>⚠️ {onSpotError}</Text>
                    </View>
                  )}

                  {/* Form Inputs */}
                  <View style={styles.onSpotInputGroup}>
                    <Text style={styles.onSpotInputLabel}>REGISTRATION NUMBER</Text>
                    <TextInput
                      style={styles.onSpotInput}
                      placeholder="e.g. 12601234 (1st Yr) or 12501234 (2nd Yr)"
                      placeholderTextColor="#64748b"
                      value={onSpotRegNo}
                      onChangeText={(val) => {
                        setOnSpotRegNo(val);
                        const clean = val.trim();
                        if (clean.startsWith('126')) {
                          setOnSpotSelectedYear('1st Year');
                        } else if (
                          clean.startsWith('125') ||
                          clean.startsWith('124') ||
                          clean.startsWith('123')
                        ) {
                          setOnSpotSelectedYear('2nd Year');
                        }
                      }}
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={styles.onSpotInputGroup}>
                    <Text style={styles.onSpotInputLabel}>FULL NAME</Text>
                    <TextInput
                      style={styles.onSpotInput}
                      placeholder="e.g. Rahul Sharma"
                      placeholderTextColor="#64748b"
                      value={onSpotName}
                      onChangeText={setOnSpotName}
                    />
                  </View>

                  <View style={styles.onSpotInputGroup}>
                    <Text style={styles.onSpotInputLabel}>EMAIL ADDRESS</Text>
                    <TextInput
                      style={styles.onSpotInput}
                      placeholder="attendee@gmail.com"
                      placeholderTextColor="#64748b"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={onSpotEmail}
                      onChangeText={setOnSpotEmail}
                    />
                  </View>

                  <View style={styles.onSpotInputGroup}>
                    <Text style={styles.onSpotInputLabel}>PHONE NUMBER</Text>
                    <TextInput
                      style={styles.onSpotInput}
                      placeholder="10-digit mobile number"
                      placeholderTextColor="#64748b"
                      keyboardType="phone-pad"
                      value={onSpotPhone}
                      onChangeText={setOnSpotPhone}
                      maxLength={10}
                    />
                  </View>

                  {/* Live Photo Section */}
                  <View style={styles.onSpotPhotoSection}>
                    <Text style={styles.onSpotInputLabel}>ATTENDEE PHOTO</Text>
                    {onSpotPhotoUri ? (
                      <View style={styles.onSpotPhotoPreviewRow}>
                        <Image source={{ uri: onSpotPhotoUri }} style={styles.onSpotPhotoThumb} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.onSpotPhotoSuccessText}>✓ Live photo captured</Text>
                          <TouchableOpacity
                            style={styles.onSpotRetakeBtn}
                            onPress={() => setOnSpotStep('CAMERA')}
                          >
                            <Text style={styles.onSpotRetakeText}>📸 Retake Photo</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.onSpotTakePhotoBtn}
                        onPress={() => setOnSpotStep('CAMERA')}
                      >
                        <Text style={styles.onSpotTakePhotoBtnText}>📸 Tap to Open Camera & Take Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Proceed to QR Button */}
                  <TouchableOpacity
                    style={styles.onSpotProceedBtn}
                    onPress={handleProceedToQR}
                  >
                    <Text style={styles.onSpotProceedBtnText}>
                      PROCEED TO PAYMENT (₹{onSpotFee}) →
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}

              {onSpotStep === 'QR' && (
                <ScrollView contentContainerStyle={styles.onSpotScroll}>
                  <View style={styles.onSpotHeaderRow}>
                    <View>
                      <Text style={styles.onSpotMainTitle}>💳 Collect Payment</Text>
                      <Text style={styles.onSpotMainSubtitle}>
                        Attendee: {onSpotName} ({onSpotYear})
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setOnSpotStep('FORM')}
                      style={styles.onSpotCloseIconBtn}
                    >
                      <Text style={styles.onSpotCloseIconText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.qrAmountHeader}>
                    <Text style={styles.qrAmountLabel}>AMOUNT TO PAY</Text>
                    <Text style={styles.qrAmountValue}>₹{onSpotFee}</Text>
                    <Text style={styles.qrAmountSubtitle}>
                      {is1stYearOnSpot ? '1st Year Freshers Rate' : '2nd Year / Senior Rate'}
                    </Text>
                  </View>

                  <View style={styles.razorpayQrWrapper}>
                    <Image
                      source={is1stYearOnSpot ? qr100Img : qr200Img}
                      style={styles.razorpayQrImage}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.qrInstructions}>
                    Ask <Text style={{ fontWeight: '800', color: '#ffffff' }}>{onSpotName}</Text> to scan this QR code with any UPI App (GPay, PhonePe, Paytm) to pay ₹{onSpotFee}.
                  </Text>

                  {onSpotError && (
                    <View style={styles.onSpotErrorBox}>
                      <Text style={styles.onSpotErrorText}>⚠️ {onSpotError}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.onSpotConfirmBtn, onSpotSubmitting && { opacity: 0.6 }]}
                    onPress={handleConfirmOnSpotPayment}
                    disabled={onSpotSubmitting}
                  >
                    {onSpotSubmitting ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator color="#ffffff" />
                        <Text style={styles.onSpotConfirmBtnText}>RECORDING ENTRY...</Text>
                      </View>
                    ) : (
                      <Text style={styles.onSpotConfirmBtnText}>
                        ✅ PAYMENT RECEIVED — CONFIRM ENTRY
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.onSpotBackBtn}
                    onPress={() => setOnSpotStep('FORM')}
                    disabled={onSpotSubmitting}
                  >
                    <Text style={styles.onSpotBackBtnText}>← Edit Student Details</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}

              {onSpotStep === 'SUCCESS' && (
                <View style={styles.onSpotSuccessContainer}>
                  <View style={styles.successIconCircle}>
                    <Text style={{ fontSize: 36 }}>✅</Text>
                  </View>

                  <Text style={styles.successHeading}>ENTRY AUTHORIZED</Text>
                  <Text style={styles.successSubheading}>Ticket Created & Payment Verified</Text>

                  <View style={styles.successCardBox}>
                    <View style={styles.successDetailRow}>
                      <Text style={styles.successDetailLabel}>STUDENT NAME</Text>
                      <Text style={styles.successDetailValue}>{onSpotName}</Text>
                    </View>
                    <View style={styles.successDetailRow}>
                      <Text style={styles.successDetailLabel}>REGISTRATION NO</Text>
                      <Text style={styles.successDetailValue}>{onSpotRegNo}</Text>
                    </View>
                    <View style={styles.successDetailRow}>
                      <Text style={styles.successDetailLabel}>BATCH & YEAR</Text>
                      <Text style={styles.successDetailValue}>{onSpotYear}</Text>
                    </View>
                    <View style={styles.successDetailRow}>
                      <Text style={styles.successDetailLabel}>AMOUNT COLLECTED</Text>
                      <Text style={[styles.successDetailValue, { color: '#34d399', fontWeight: '900' }]}>
                        ₹{onSpotFee} (On-Spot UPI)
                      </Text>
                    </View>
                    <View style={styles.successDetailRow}>
                      <Text style={styles.successDetailLabel}>TICKET ID</Text>
                      <Text style={[styles.successDetailValue, { color: '#a855f7', fontWeight: '800' }]}>
                        #{onSpotSuccessData?.student?.ticket_id || 'CONFIRMED'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.successFooterNotice}>
                    ✓ Check-in recorded under coordinator {coordinator.name || coordinator.email}.{'\n'}
                    ✓ Official ticket confirmation sent to {onSpotEmail}.
                  </Text>

                  <TouchableOpacity
                    style={styles.onSpotNextBtn}
                    onPress={() => {
                      resetOnSpotForm();
                      setOnSpotModalVisible(false);
                    }}
                  >
                    <Text style={styles.onSpotNextBtnText}>CHECK IN NEXT ATTENDEE</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060214',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#060214',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  permissionButton: {
    marginTop: 24,
    backgroundColor: '#9333ea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#0b0524',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerCategory: {
    fontSize: 9,
    fontWeight: '900',
    color: '#c084fc',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  coordinatorName: {
    color: '#d8b4fe',
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsBadge: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderColor: 'rgba(192, 132, 252, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statsBadgeText: {
    color: '#d8b4fe',
    fontSize: 11,
    fontWeight: '800',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logoutBtnText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  targetFrame: {
    width: 260,
    height: 260,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#c084fc',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanningLine: {
    position: 'absolute',
    top: '50%',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#a855f7',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  hintPill: {
    marginTop: 24,
    backgroundColor: 'rgba(6, 2, 20, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
  },
  hintText: {
    color: '#d8b4fe',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#0b0524',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  controlBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  controlBtnActive: {
    backgroundColor: '#9333ea',
  },
  controlBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  onSpotControlBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  onSpotControlBtnText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  centerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  verifyingCard: {
    backgroundColor: '#0b0524',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  verifyingCardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  verifyingCardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  modalCard: {
    backgroundColor: '#0b0524',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  purpleTopAccent: {
    height: 4,
    width: 60,
    backgroundColor: '#a855f7',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  emeraldTopAccent: {
    height: 4,
    width: 60,
    backgroundColor: '#10b981',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  redTopAccent: {
    height: 4,
    width: 60,
    backgroundColor: '#ef4444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  yellowTopAccent: {
    height: 4,
    width: 60,
    backgroundColor: '#f59e0b',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pillContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketFoundPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ticketFoundPillText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  markedSuccessPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  markedSuccessPillText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  alreadyEnteredPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  alreadyEnteredPillText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  unpaidPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  unpaidPillText: {
    color: '#fcd34d',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  invalidPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  invalidPillText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  studentLargePhoto: {
    width: 150,
    height: 150,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    backgroundColor: '#000000',
  },
  studentMediumPhoto: {
    width: 120,
    height: 120,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: '#000000',
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  studentInfoCenter: {
    alignItems: 'center',
    marginBottom: 16,
  },
  studentFullName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  studentTicketId: {
    fontSize: 13,
    color: '#c084fc',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    marginTop: 4,
  },
  studentRegNoBold: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  studentSubDetails: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  modelingBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
  },
  modelingBadgeText: {
    color: '#fcd34d',
    fontSize: 10,
    fontWeight: '900',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statusGridBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusGridBoxRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusGridLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statusGridLabelRed: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f87171',
    letterSpacing: 0.5,
  },
  statusPaidText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#34d399',
    marginTop: 4,
  },
  statusNotEnteredText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#eab308',
    marginTop: 4,
  },
  statusAlreadyText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#f87171',
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  markEntryBtn: {
    flex: 1.5,
    backgroundColor: '#9333ea',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  markEntryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  welcomeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  welcomeTitle: {
    color: '#d8b4fe',
    fontSize: 13,
    fontWeight: '800',
  },
  welcomeSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 4,
  },
  scanNextBtn: {
    backgroundColor: '#9333ea',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  scanNextBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  prevAuditBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  prevAuditHeading: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  prevAuditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  prevAuditLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  prevAuditValue: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  dismissBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  dismissBtnFull: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  reEntryBtn: {
    flex: 1.5,
    backgroundColor: '#d97706',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  reEntryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 2,
    borderColor: '#f59e0b',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorIconCircleRed: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: '#ef4444',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  unpaidWarningText: {
    color: '#fde68a',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  scanRejectedHeading: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  invalidErrorText: {
    color: '#cbd5e1',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  manualCard: {
    backgroundColor: '#0b0524',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  manualSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 16,
  },
  manualInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 16,
  },
  manualActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  manualCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manualCancelText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  manualSubmitBtn: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  manualSubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  // On-Spot Styles
  onSpotCard: {
    backgroundColor: '#0b0524',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 390,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  onSpotScroll: {
    paddingBottom: 8,
  },
  onSpotHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  onSpotMainTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  onSpotMainSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  onSpotCloseIconBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  onSpotCloseIconText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
  },
  onSpotFeeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  onSpotFeeBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6ee7b7',
  },
  onSpotFeeBannerAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#34d399',
  },
  onSpotYearSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  onSpotYearPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onSpotYearPillActive100: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderColor: '#a855f7',
  },
  onSpotYearPillActive200: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#f59e0b',
  },
  onSpotYearPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
  },
  onSpotYearPillTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  onSpotErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  onSpotErrorText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '700',
  },
  onSpotInputGroup: {
    marginBottom: 12,
  },
  onSpotInputLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  onSpotInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#ffffff',
  },
  onSpotPhotoSection: {
    marginTop: 4,
    marginBottom: 16,
  },
  onSpotTakePhotoBtn: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  onSpotTakePhotoBtnText: {
    color: '#d8b4fe',
    fontSize: 12,
    fontWeight: '800',
  },
  onSpotPhotoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  onSpotPhotoThumb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1e1b4b',
  },
  onSpotPhotoSuccessText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '800',
  },
  onSpotRetakeBtn: {
    marginTop: 4,
  },
  onSpotRetakeText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  onSpotProceedBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 4,
  },
  onSpotProceedBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  qrAmountHeader: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  qrAmountLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  qrAmountValue: {
    color: '#34d399',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  qrAmountSubtitle: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  razorpayQrWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 4,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    marginBottom: 14,
    width: '100%',
    maxWidth: 320,
  },
  razorpayQrImage: {
    width: 280,
    height: 290,
  },
  qrInstructions: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  onSpotConfirmBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 8,
  },
  onSpotConfirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  onSpotBackBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  onSpotBackBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  onSpotSuccessContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  successSubheading: {
    fontSize: 12,
    color: '#34d399',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 16,
  },
  successCardBox: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  successDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  successDetailLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
  },
  successDetailValue: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  successFooterNotice: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  onSpotNextBtn: {
    width: '100%',
    backgroundColor: '#9333ea',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  onSpotNextBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  onSpotCameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  onSpotCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  onSpotCameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onSpotCameraCloseBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  onSpotCameraFlipBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  onSpotCameraCloseText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  onSpotFaceGuide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOvalGuide: {
    width: 220,
    height: 280,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  faceGuideText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  onSpotShutterRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  onSpotShutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onSpotShutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ffffff',
  },
});
