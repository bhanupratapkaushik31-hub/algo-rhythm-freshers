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
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { EntryService, VerifyResult } from '../services/api';
import { AuthService, CoordinatorProfile } from '../services/auth';
import { APP_CONFIG } from '../config/env';

const qr100Img = require('../../assets/qr_100.jpg');
const qr200Img = require('../../assets/qr_200.jpg');

interface ScannerScreenProps {
  coordinator: CoordinatorProfile;
  onLogout: () => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ coordinator, onLogout }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  // Manual entry modal
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualToken, setManualToken] = useState('');

  // Stats
  const [totalScanned, setTotalScanned] = useState(0);

  // On-Spot Entry States
  const [onSpotModalVisible, setOnSpotModalVisible] = useState(false);
  const [onSpotStep, setOnSpotStep] = useState<'FORM' | 'CAMERA' | 'QR' | 'SUCCESS'>('FORM');
  const [onSpotRegNo, setOnSpotRegNo] = useState('');
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
  }, []);

  const fetchStats = async () => {
    const stats = await EntryService.getStats();
    setTotalScanned(stats.total_scans);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || verifying) return;
    setScanned(true);
    setVerifying(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const res = await EntryService.verifyTicket(data);
    setVerifying(false);
    setResult(res);

    if (res.success && res.status === 'MARKED') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setTotalScanned(prev => prev + 1);
    } else {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  };

  const handleManualSubmit = async () => {
    if (!manualToken.trim()) return;
    setManualModalVisible(false);
    setScanned(true);
    setVerifying(true);

    const res = await EntryService.verifyTicket(manualToken.trim());
    setVerifying(false);
    setResult(res);
    setManualToken('');

    if (res.success && res.status === 'MARKED') {
      setTotalScanned(prev => prev + 1);
    }
  };

  const resetScanner = () => {
    setResult(null);
    setScanned(false);
    setVerifying(false);
  };

  // On-Spot Calculations & Handlers
  const is1stYearOnSpot = onSpotRegNo.trim().startsWith('126');
  const onSpotYear = is1stYearOnSpot ? '1st Year' : '2nd Year';
  const onSpotFee = is1stYearOnSpot ? 100 : 200;

  const resetOnSpotForm = () => {
    setOnSpotRegNo('');
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
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setTotalScanned(prev => prev + 1);
      setOnSpotSuccessData(res.data);
      setOnSpotStep('SUCCESS');
    } else {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
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

  const student = result?.student || result?.data?.student;
  const status = result?.status || result?.data?.status;
  const isSuccess = (result?.success === true) && (status === 'MARKED' || status === 'PENDING_CONFIRMATION' || !!student);
  const isAlreadyEntered = status === 'ALREADY_ENTERED';
  const isAdminTest = student?.id === 'admin-test-id' || result?.message?.includes('admin') || result?.data?.message?.includes('admin');
  const displayMessage = result?.message || result?.data?.message || result?.error?.message || (isSuccess ? 'Entry scanned and verified.' : 'Invalid ticket.');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070417" />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Algo-Rhythm 2026</Text>
          <Text style={styles.headerSubtitle}>
            Coordinator: <Text style={styles.coordinatorName}>{coordinator.name || coordinator.email}</Text>
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.statsBadge}>
            <Text style={styles.statsBadgeText}>✓ {totalScanned} Entered</Text>
          </View>
          <TouchableOpacity onPress={handleLogoutConfirm} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Camera Viewfinder */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Viewfinder Target Reticle Overlay */}
        <View style={styles.overlay}>
          <View style={styles.targetFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {verifying && (
              <View style={styles.verifyingBox}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.verifyingText}>Verifying Ticket...</Text>
              </View>
            )}
          </View>
          <Text style={styles.hintText}>Point camera at student's Ticket QR Code</Text>
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

      {/* Scan Result Modal / Card */}
      {result && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              {/* Header Status Pill */}
              <View
                style={[
                  styles.resultHeader,
                  isSuccess && styles.headerSuccess,
                  isAlreadyEntered && styles.headerWarning,
                  !isSuccess && !isAlreadyEntered && styles.headerError,
                ]}
              >
                <Text style={styles.resultStatusText}>
                  {isSuccess
                    ? (isAdminTest ? '✅ TEST SCAN SUCCESSFUL' : '✅ ENTRY AUTHORIZED')
                    : isAlreadyEntered
                    ? '⚠️ ALREADY ENTERED'
                    : '❌ ACCESS DENIED'}
                </Text>
                <Text style={styles.resultMessageText}>
                  {displayMessage}
                </Text>
              </View>

              {student && (
                <ScrollView style={styles.studentInfoScroll}>
                  {/* Photo & Name */}
                  <View style={styles.studentRow}>
                    <Image
                      source={{
                        uri: `${APP_CONFIG.API_BASE_URL}/api/admin/registrations/${student.id}/photo`,
                      }}
                      style={styles.studentPhoto}
                      defaultSource={require('../../assets/splash.png')}
                    />
                    <View style={styles.studentMeta}>
                      <Text style={styles.studentName}>{student.full_name}</Text>
                      <Text style={styles.studentRegNo}>{student.registration_number}</Text>
                      <View style={styles.badgesRow}>
                        <View style={styles.yearBadge}>
                          <Text style={styles.yearBadgeText}>{student.year}</Text>
                        </View>
                        {student.modeling === 'Yes' && (
                          <View style={styles.modelingBadge}>
                            <Text style={styles.modelingBadgeText}>👑 Modeling</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* School & Ticket Details */}
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>SCHOOL / DEPARTMENT</Text>
                    <Text style={styles.detailValue}>{student.school_name || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>TICKET ID</Text>
                    <Text style={styles.ticketIdText}>#{student.ticket_id || 'PENDING'}</Text>
                  </View>

                  {/* If Already Entered details */}
                  {isAlreadyEntered && result.entry_details && (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningBoxTitle}>Previous Check-in Record:</Text>
                      <Text style={styles.warningBoxText}>
                        First Scanned:{' '}
                        {result.entry_details.first_scanned_at
                          ? new Date(result.entry_details.first_scanned_at).toLocaleTimeString()
                          : 'N/A'}
                      </Text>
                      {result.entry_details.scanned_by && (
                        <Text style={styles.warningBoxText}>
                          Scanned By: {result.entry_details.scanned_by}
                        </Text>
                      )}
                    </View>
                  )}
                </ScrollView>
              )}

              {/* Reset / Next Scan Button */}
              <TouchableOpacity style={styles.nextScanBtn} onPress={resetScanner}>
                <Text style={styles.nextScanBtnText}>SCAN NEXT CANDIDATE (RESET)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Manual Code Modal */}
      <Modal visible={manualModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
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
                <Text style={styles.manualSubmitText}>Verify</Text>
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

                  {/* Year & Pricing Badge */}
                  <View style={styles.onSpotFeeBanner}>
                    <Text style={styles.onSpotFeeBannerTitle}>
                      {onSpotRegNo.trim() ? `Detected: ${onSpotYear}` : 'Batch Auto-Detection'}
                    </Text>
                    <Text style={styles.onSpotFeeBannerAmount}>
                      Ticket Fee: ₹{onSpotFee}
                    </Text>
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
                      onChangeText={setOnSpotRegNo}
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
                      <Text style={styles.onSpotMainSubtitle}>Attendee: {onSpotName} ({onSpotYear})</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setOnSpotStep('FORM')}
                      style={styles.onSpotCloseIconBtn}
                    >
                      <Text style={styles.onSpotCloseIconText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Amount Banner */}
                  <View style={styles.qrAmountHeader}>
                    <Text style={styles.qrAmountLabel}>AMOUNT TO PAY</Text>
                    <Text style={styles.qrAmountValue}>₹{onSpotFee}</Text>
                    <Text style={styles.qrAmountSubtitle}>
                      {is1stYearOnSpot ? '1st Year Freshers Rate' : '2nd Year / Senior Rate'}
                    </Text>
                  </View>

                  {/* Razorpay QR Code Display Card */}
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

                  {/* Confirmation Button */}
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
    backgroundColor: '#070417',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#070417',
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
    backgroundColor: '#0c0724',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
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
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statsBadgeText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '800',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  targetFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#a855f7',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  verifyingBox: {
    backgroundColor: 'rgba(12, 7, 36, 0.85)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  verifyingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  hintText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#0c0724',
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0f082e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  resultHeader: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  headerWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#f59e0b',
    borderWidth: 1,
  },
  headerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  resultStatusText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resultMessageText: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  studentInfoScroll: {
    marginBottom: 16,
  },
  studentRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 16,
  },
  studentPhoto: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#000000',
  },
  studentMeta: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  studentRegNo: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#c084fc',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  yearBadge: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  yearBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  modelingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  modelingBadgeText: {
    color: '#fcd34d',
    fontSize: 10,
    fontWeight: '800',
  },
  detailBox: {
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 10,
    borderRadius: 12,
  },
  detailLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '600',
    marginTop: 2,
  },
  ticketIdText: {
    fontSize: 13,
    color: '#c084fc',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    marginTop: 2,
  },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  warningBoxTitle: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  warningBoxText: {
    color: '#fde68a',
    fontSize: 11,
  },
  nextScanBtn: {
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
  nextScanBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  manualCard: {
    backgroundColor: '#0f082e',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 24,
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
    backgroundColor: '#0f082e',
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
    marginBottom: 14,
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
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 4,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    marginBottom: 12,
  },
  razorpayQrImage: {
    width: 220,
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
