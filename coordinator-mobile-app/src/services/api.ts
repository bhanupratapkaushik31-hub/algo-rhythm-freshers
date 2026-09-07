import { AuthService } from './auth';
import { APP_CONFIG } from '../config/env';

export interface VerifyResult {
  success: boolean;
  status?: 'MARKED' | 'ALREADY_ENTERED' | 'INVALID' | 'UNPAID' | 'CANCELLED';
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
    scanned_by?: string;
    total_entries?: number;
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
      const token = await AuthService.getAccessToken();

      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/entry/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ticket_token: ticketToken.trim(),
          scanner_device: 'Android Coordinator App',
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
   * Mark Entry for an attendee
   */
  async markEntry(registrationId: string): Promise<{ success: boolean; message?: string; error?: any }> {
    try {
      const token = await AuthService.getAccessToken();

      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/entry/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          registration_id: registrationId,
          scanner_device: 'Android Coordinator App',
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

      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/coordinator/stats`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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
};
