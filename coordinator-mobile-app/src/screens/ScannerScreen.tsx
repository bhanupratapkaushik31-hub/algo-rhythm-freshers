import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { EntryService, VerifyResult } from '../services/api';
import { AuthService, CoordinatorProfile } from '../services/auth';
import { APP_CONFIG } from '../config/env';

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

  const student = result?.student;
  const isSuccess = result?.success && result?.status === 'MARKED';
  const isAlreadyEntered = result?.status === 'ALREADY_ENTERED';

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
          <Text style={styles.controlBtnText}>⌨️ Enter Code</Text>
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
                    ? '✅ ENTRY AUTHORIZED'
                    : isAlreadyEntered
                    ? '⚠️ ALREADY ENTERED'
                    : '❌ ACCESS DENIED'}
                </Text>
                <Text style={styles.resultMessageText}>
                  {result.message || (isSuccess ? 'Entry scanned and verified.' : 'Invalid ticket.')}
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
});
