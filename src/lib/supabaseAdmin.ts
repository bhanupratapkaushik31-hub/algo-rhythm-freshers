import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isMockMode = !supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseServiceRoleKey || supabaseServiceRoleKey.includes('placeholder');

class MockAdminSupabaseClient {
  private tableName: string = '';
  private filterField: string = '';
  private filterValue: any = null;
  private sortField: string = '';
  private sortAscending: boolean = true;
  private pageRange: { from: number; to: number } | null = null;
  private isInsert: boolean = false;
  private isUpdate: boolean = false;
  private isUpsert: boolean = false;
  private writeData: any = null;
  private searchVal: string = '';

  from(name: string) {
    this.tableName = name;
    this.filterField = '';
    this.filterValue = null;
    this.sortField = '';
    this.pageRange = null;
    this.isInsert = false;
    this.isUpdate = false;
    this.isUpsert = false;
    this.writeData = null;
    this.searchVal = '';
    return this;
  }

  select(columns: string = '*', options: any = {}) {
    return this;
  }

  eq(field: string, value: any) {
    this.filterField = field;
    this.filterValue = value;
    return this;
  }

  ilike(field: string, value: any) {
    if (field === 'school_name') {
      this.filterField = 'school_name';
      this.filterValue = value.replace(/%/g, '');
    }
    return this;
  }

  or(query: string) {
    this.searchVal = query;
    return this;
  }

  order(field: string, options: any = {}) {
    this.sortField = field;
    this.sortAscending = options.ascending ?? true;
    return this;
  }

  range(from: number, to: number) {
    this.pageRange = { from, to };
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.writeData = data;
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.writeData = data;
    return this;
  }

  upsert(data: any) {
    this.isUpsert = true;
    this.writeData = data;
    return this;
  }

  maybeSingle() {
    return this.execute('maybeSingle');
  }

  single() {
    return this.execute('single');
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute('list').then(onfulfilled, onrejected);
  }

  auth = {
    async getSession() {
      return {
        data: {
          session: {
            user: { id: 'mock-admin-uuid-123', email: 'admin@algorithmfest.com' },
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
          user: { id: 'mock-admin-uuid-123', email: 'admin@algorithmfest.com' }
        },
        error: null
      };
    }
  };

  private async execute(mode: 'single' | 'maybeSingle' | 'list') {
    const mockDb = require('./mockDb');
    let result: any = null;
    let count: number | null = null;
    let error: any = null;

    try {
      const db = mockDb.readMockDb();

      if (this.isInsert) {
        if (this.tableName === 'registrations') {
          result = mockDb.mockCreateRegistration(this.writeData);
        } else if (this.tableName === 'payments') {
          result = mockDb.mockCreatePayment(this.writeData);
        } else if (this.tableName === 'entries') {
          result = mockDb.mockCreateEntry(this.writeData);
        } else if (this.tableName === 'entry_logs') {
          result = mockDb.mockCreateEntryLog(this.writeData);
        }
      } else if (this.isUpdate) {
        if (this.tableName === 'registrations') {
          result = mockDb.mockUpdateRegistration(this.filterValue, this.writeData);
        } else if (this.tableName === 'payments') {
          const pay = db.payments.find((p: any) => p[this.filterField] === this.filterValue);
          if (pay) {
            result = mockDb.mockUpdatePayment(pay.id, this.writeData);
          }
        }
      } else if (this.isUpsert) {
        if (this.tableName === 'settings') {
          result = mockDb.mockUpdateSetting(this.writeData.key, this.writeData.value);
        }
      } else {
        // SELECT operations
        if (this.tableName === 'settings') {
          const val = mockDb.mockGetSetting(this.filterValue);
          result = val ? { key: this.filterValue, value: val } : null;
        } else if (this.tableName === 'registrations') {
          if (this.filterField === 'registration_number') {
            result = mockDb.mockGetRegistrationByNumber(this.filterValue);
          } else if (this.filterField === 'id') {
            result = mockDb.mockGetRegistrationById(this.filterValue);
          } else if (this.filterField === 'ticket_token') {
            result = mockDb.mockGetRegistrationByToken(this.filterValue);
          } else if (!this.filterField) {
            result = null;
            if (this.writeData && this.writeData.registration_status) {
              count = db.registrations.filter((r: any) => r.registration_status === this.writeData.registration_status).length;
            } else {
              count = db.registrations.length;
            }
          }
        } else if (this.tableName === 'registrations_with_details') {
          if (this.filterField === 'id') {
            const reg = db.registrations.find((r: any) => r.id === this.filterValue);
            if (reg) {
              const entry = db.entries.find((e: any) => e.registration_id === reg.id);
              const payment = db.payments.find((p: any) => p.registration_id === reg.id && p.payment_status === 'SUCCESS');
              result = {
                ...reg,
                entry_status: entry ? 'ENTERED' : 'NOT_ENTERED',
                entry_time: entry ? entry.entry_time : null,
                entry_scanned_by: entry ? entry.scanned_by : null,
                razorpay_payment_id: payment ? (payment.razorpay_payment_id || payment.payment_id) : null,
                payment_time: payment ? payment.paid_at : null,
                payment_method: payment ? payment.payment_method : null
              };
            }
          } else {
            let searchWord = '';
            if (this.searchVal) {
              const match = this.searchVal.match(/%([^%]+)%/);
              if (match) searchWord = match[1];
            }

            const limitVal = this.pageRange ? (this.pageRange.to - this.pageRange.from + 1) : 25;
            const pageVal = this.pageRange ? Math.floor(this.pageRange.from / limitVal) + 1 : 1;

            const params = {
              search: searchWord,
              page: pageVal,
              limit: limitVal,
              sortBy: this.sortField || 'created_at',
              sortOrder: this.sortAscending ? 'asc' : 'desc'
            };

            const listRes = mockDb.mockListRegistrations(params);
            result = listRes.registrations;
            count = listRes.total;
          }
        } else if (this.tableName === 'payments') {
          if (this.filterField === 'razorpay_order_id') {
            result = db.payments.find((p: any) => p.razorpay_order_id === this.filterValue) || null;
          } else if (this.filterField === 'registration_id') {
            result = db.payments.find((p: any) => p.registration_id === this.filterValue) || null;
          } else if (!this.filterField) {
            result = db.payments.filter((p: any) => p.payment_status === 'SUCCESS');
          }
        } else if (this.tableName === 'entries') {
          if (this.filterField === 'registration_id') {
            result = mockDb.mockGetEntryByRegId(this.filterValue);
          } else if (!this.filterField) {
            count = db.entries.length;
          }
        } else if (this.tableName === 'entry_logs') {
          if (this.filterField === 'registration_id') {
            result = db.entry_logs.filter((l: any) => l.registration_id === this.filterValue);
          } else {
            result = db.entry_logs;
          }
        } else if (this.tableName === 'admins') {
          result = {
            id: this.filterValue || 'mock-admin-uuid-123',
            name: 'Super Coordinator',
            email: 'admin@algorithmfest.com',
            role: 'super_admin',
            created_at: new Date().toISOString()
          };
        }
      }
    } catch (err: any) {
      error = { message: err.message || 'Mock execution failure', code: err.code || 'MOCK_ERR' };
    }

    if (mode === 'single' || mode === 'maybeSingle') {
      return { data: result, error };
    } else {
      return { data: result, count, error };
    }
  }
}

export const supabaseAdmin: any = isMockMode 
  ? new MockAdminSupabaseClient() 
  : createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
