import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const isMockMode = !supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseAnonKey || supabaseAnonKey.includes('placeholder');

class MockPublicSupabaseClient {
  auth = {
    async getSession() {
      return {
        data: {
          session: {
            user: {
              id: 'mock-admin-uuid-123',
              email: 'admin@algorithmfest.com',
            },
            access_token: 'mock-jwt-access-token-xyz',
            expires_in: 3600
          }
        },
        error: null
      };
    },
    async getUser(token?: string) {
      return {
        data: {
          user: {
            id: 'mock-admin-uuid-123',
            email: 'admin@algorithmfest.com',
          }
        },
        error: null
      };
    },
    async signInWithPassword({ email, password }: any) {
      return {
        data: {
          user: { id: 'mock-admin-uuid-123', email },
          session: {
            access_token: 'mock-jwt-access-token-xyz',
            expires_in: 3600,
            user: { id: 'mock-admin-uuid-123', email }
          }
        },
        error: null
      };
    },
    async signOut() {
      return { error: null };
    }
  };

  from(name: string) {
    return {
      select: (columns?: string) => ({
        eq: (field: string, value: any) => ({
          single: async () => ({
            data: {
              id: 'mock-admin-uuid-123',
              name: 'Super Coordinator',
              email: 'admin@algorithmfest.com',
              role: 'super_admin'
            },
            error: null
          })
        })
      })
    };
  }
}

export const supabase: any = isMockMode 
  ? new MockPublicSupabaseClient() 
  : createClient(supabaseUrl, supabaseAnonKey);
