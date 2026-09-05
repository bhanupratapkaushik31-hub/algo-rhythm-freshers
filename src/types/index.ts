export interface Registration {
  id: string;
  ticket_id: string | null;
  ticket_token: string;
  registration_number: string;
  full_name: string;
  year: '1st Year' | '2nd Year';
  school_name: string;
  modeling: 'Yes' | 'No';
  phone: string;
  email: string;
  registration_status: 'PENDING' | 'PAID' | 'CANCELLED';
  email_sent: boolean;
  email_status?: 'PENDING' | 'SENT' | 'FAILED';
  email_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  registration_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount: number;
  currency: string;
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  registration_id: string;
  entry_status: 'ENTERED';
  entry_time: string;
  scanned_by: string;
  scanner_device: string | null;
  created_at: string;
  ticket_id?: string | null;
  coordinator_id?: string | null;
  scanned_at?: string;
  status?: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'scanner' | 'coordinator';
  created_at: string;
  active?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
