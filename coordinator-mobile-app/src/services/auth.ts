import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { APP_CONFIG } from '../config/env';

export interface CoordinatorProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'super_admin' | 'admin' | 'scanner' | 'coordinator';
  active: boolean;
}

export const AuthService = {
  /**
   * Log in coordinator with email and password
   */
  async login(email: string, password: string): Promise<{ success: boolean; profile?: CoordinatorProfile; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error || !data.session) {
        return { success: false, error: error?.message || 'Invalid email or password.' };
      }

      // Fetch coordinator role & profile from backend
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/profile`, {
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`,
          'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        },
      });

      const res = await response.json();
      if (!response.ok || !res.success || !res.data) {
        await supabase.auth.signOut();
        return { success: false, error: 'Authorized coordinator profile not found.' };
      }

      const profile: CoordinatorProfile = res.data;

      // Active status check
      if (profile.active === false) {
        await supabase.auth.signOut();
        return { success: false, error: 'This coordinator account is disabled.' };
      }

      // Role check
      if (!['scanner', 'coordinator', 'admin', 'super_admin'].includes(profile.role)) {
        await supabase.auth.signOut();
        return { success: false, error: 'Access Denied: Only entry coordinators can use this app.' };
      }

      // Persist profile locally
      await AsyncStorage.setItem(APP_CONFIG.PROFILE_STORAGE_KEY, JSON.stringify(profile));

      return { success: true, profile };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during login.' };
    }
  },

  /**
   * Check persistent session on app start
   */
  async getPersistedSession(): Promise<{ loggedIn: boolean; profile?: CoordinatorProfile; token?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const storedProfileStr = await AsyncStorage.getItem(APP_CONFIG.PROFILE_STORAGE_KEY);

      if (!session) {
        return { loggedIn: false };
      }

      if (storedProfileStr) {
        const profile: CoordinatorProfile = JSON.parse(storedProfileStr);
        return { loggedIn: true, profile, token: session.access_token };
      }

      // If session exists but profile not saved, re-fetch profile
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/profile`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const res = await response.json();
      if (response.ok && res.success && res.data) {
        await AsyncStorage.setItem(APP_CONFIG.PROFILE_STORAGE_KEY, JSON.stringify(res.data));
        return { loggedIn: true, profile: res.data, token: session.access_token };
      }

      return { loggedIn: false };
    } catch (e) {
      console.warn('Session restore error:', e);
      return { loggedIn: false };
    }
  },

  /**
   * Log out coordinator
   */
  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(APP_CONFIG.PROFILE_STORAGE_KEY);
    } catch (e) {
      console.warn('Logout error:', e);
    }
  },
};
