import { AuthService } from './auth';
import { APP_CONFIG } from '../config/env';

export interface VerifyResult {
  success: boolean;
  status?: 'MARKED' | 'ALREADY_ENTERED' | 'INVALID' | 'UNPAID' | 'PENDING_CONFIRMATION' | 'CANCELLED';
  message?: string;
  data?: any;
  student?: {
    id: string;
    ticket_id: string;
    ticket_token: string;
    full_name: string;
    registration_number: string;
    year: string;
    school_name: string;
    modeling: string;
    photo_url?: string;
    registration_status: string;
    entry_status: string;
  };
  entry_details?: {
    first_scanned_at?: string;
    entry_time?: string;
    scanned_at?: string;
    scanned_by?: string;
    scanner_device?: string;
    total_entries?: number;
    is_test?: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

export const EntryService = {
  /**
   * Verify QR token or ticket ID
   */
  async verifyTicket(ticketToken: string): Promise<VerifyResult> {
    try {
      let cleanToken = ticketToken.trim();
      if (cleanToken.includes('/ticket/')) {
        cleanToken = cleanToken.split('/ticket/').pop()?.split('?')[0]?.split('#')[0] || cleanToken;
      }

      const token = await AuthService.getAccessToken();
      const profile = await AuthService.getStoredProfile();

      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/entry/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(profile?.email ? { 'x-coordinator-email': profile.email } : {}),
        },
        body: JSON.stringify({
          ticket_token: cleanToken,
          scanner_device: 'Android Coordinator App',
          coordinator_email: profile?.email,
          coordinator_name: profile?.name,
          coordinator_id: profile?.id,
        }),
      });

      const res = await response.json();
      return res;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err?.message || 'Network connection failed.',
        },
      };
    }
  },

  /**
   * Mark Entry or Re-Entry for an attendee
   */
  async markEntry(
    registrationId: string,
    actionType: 'ENTRY' | 'RE_ENTRY' = 'ENTRY',
    isTest: boolean = false
  ): Promise<{ success: boolean; data?: any; message?: string; error?: any }> {
    try {
      const token = await AuthService.getAccessToken();
      const profile = await AuthService.getStoredProfile();

      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/entry/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(profile?.email ? { 'x-coordinator-email': profile.email } : {}),
        },
        body: JSON.stringify({
          registration_id: registrationId,
          action: actionType,
          is_test: isTest,
          scanner_device: 'Android Coordinator App',
          coordinator_email: profile?.email,
          coordinator_name: profile?.name,
          coordinator_id: profile?.id,
        }),
      });

      const res = await response.json();
      return res;
    } catch (err: any) {
      return { success: false, error: { message: err?.message || 'Failed to mark entry.' } };
    }
  },

  /**
   * Get Coordinator Stats
   */
  async getStats(): Promise<{ total_scans: number; recent_scans: any[] }> {
    try {
      const token = await AuthService.getAccessToken();
      const profile = await AuthService.getStoredProfile();

      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/coordinator/stats`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(profile?.email ? { 'x-coordinator-email': profile.email } : {}),
        },
      });

      const res = await response.json();
      if (res.success && res.data) {
        return {
          total_scans: res.data.total_scans || 0,
          recent_scans: res.data.recent_scans || [],
        };
      }
      return { total_scans: 0, recent_scans: [] };
    } catch {
      return { total_scans: 0, recent_scans: [] };
    }
  },

  /**
   * On-Spot Attendee Registration and Payment Entry
   */
  async onSpotEntry(payload: {
    registration_number: string;
    full_name: string;
    email: string;
    phone: string;
    year?: string;
    photo_base64?: string;
  }): Promise<{ success: boolean; message?: string; data?: any; error?: any }> {
    try {
      const token = await AuthService.getAccessToken();
      const profile = await AuthService.getStoredProfile();

      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/entry/on-spot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(profile?.email ? { 'x-coordinator-email': profile.email } : {}),
        },
        body: JSON.stringify({
          ...payload,
          scanner_device: 'Android Coordinator App (On-Spot)',
          coordinator_email: profile?.email,
          coordinator_name: profile?.name,
          coordinator_id: profile?.id,
        }),
      });

      const res = await response.json();
      return res;
    } catch (err: any) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: err?.message || 'Network connection failed.' },
      };
    }
  },
};
