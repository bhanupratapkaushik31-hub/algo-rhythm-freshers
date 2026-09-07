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
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    // Strategy 1: Server-side Authentication & Profile API
    try {
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/coordinator/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });

      const res = await response.json();

      if (response.ok && res.success && res.data) {
        const { session, profile } = res.data;
        
        // Sync session with local Supabase client
        if (session?.access_token && session?.refresh_token) {
          try {
            await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
          } catch (syncErr) {
            console.warn('Local session sync note:', syncErr);
          }
        }

        // Persist token & profile locally
        if (session?.access_token) {
          await AsyncStorage.setItem(APP_CONFIG.AUTH_STORAGE_KEY, session.access_token);
        }
        await AsyncStorage.setItem(APP_CONFIG.PROFILE_STORAGE_KEY, JSON.stringify(profile));
        return { success: true, profile };
      } else if (res.error?.message) {
        return { success: false, error: res.error.message };
      }
    } catch (serverErr) {
      console.warn('Server login attempt failed, trying direct Supabase auth:', serverErr);
    }

    // Strategy 2: Direct Supabase Client Authentication
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error || !data.session) {
        return { success: false, error: error?.message || 'Invalid email or password.' };
      }

      if (data.session.access_token) {
        await AsyncStorage.setItem(APP_CONFIG.AUTH_STORAGE_KEY, data.session.access_token);
      }

      // Fetch coordinator role & profile from backend
      try {
        const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/profile`, {
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
          },
        });

        const res = await response.json();
        if (response.ok && res.success && res.data) {
          const profile: CoordinatorProfile = res.data;
          await AsyncStorage.setItem(APP_CONFIG.PROFILE_STORAGE_KEY, JSON.stringify(profile));
          return { success: true, profile };
        }
      } catch (profErr) {
        console.warn('Profile fetch note:', profErr);
      }

      // Fallback profile from user metadata if available
      const fallbackProfile: CoordinatorProfile = {
        id: data.session.user.id,
        name: data.session.user.user_metadata?.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        role: 'coordinator',
        active: true,
      };

      await AsyncStorage.setItem(APP_CONFIG.PROFILE_STORAGE_KEY, JSON.stringify(fallbackProfile));
      return { success: true, profile: fallbackProfile };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during login. Please check internet connection.' };
    }
  },

  /**
   * Get active access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const storedToken = await AsyncStorage.getItem(APP_CONFIG.AUTH_STORAGE_KEY);
      if (storedToken) return storedToken;
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  },

  /**
   * Check persistent session on app start
   */
  async getPersistedSession(): Promise<{ loggedIn: boolean; profile?: CoordinatorProfile; token?: string }> {
    try {
      const storedProfileStr = await AsyncStorage.getItem(APP_CONFIG.PROFILE_STORAGE_KEY);
      const storedToken = await AsyncStorage.getItem(APP_CONFIG.AUTH_STORAGE_KEY);

      if (storedProfileStr) {
        const profile: CoordinatorProfile = JSON.parse(storedProfileStr);
        return { loggedIn: true, profile, token: storedToken || undefined };
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/profile`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        const res = await response.json();
        if (response.ok && res.success && res.data) {
          await AsyncStorage.setItem(APP_CONFIG.PROFILE_STORAGE_KEY, JSON.stringify(res.data));
          await AsyncStorage.setItem(APP_CONFIG.AUTH_STORAGE_KEY, session.access_token);
          return { loggedIn: true, profile: res.data, token: session.access_token };
        }
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
      await AsyncStorage.removeItem(APP_CONFIG.AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(APP_CONFIG.PROFILE_STORAGE_KEY);
    } catch (e) {
      console.warn('Logout error:', e);
    }
  },
};
