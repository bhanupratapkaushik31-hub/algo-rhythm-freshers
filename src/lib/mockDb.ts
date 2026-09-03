import fs from 'fs';
import path from 'path';

const MOCK_DB_FILE = path.join(process.cwd(), 'db_mock.json');

interface MockDbSchema {
  registrations: any[];
  payments: any[];
  entries: any[];
  entry_logs: any[];
  settings: Record<string, any>;
}

// 1. Helper to read JSON file
export function readMockDb(): MockDbSchema {
  try {
    if (!fs.existsSync(MOCK_DB_FILE)) {
      const initialDb: MockDbSchema = {
        registrations: [],
        payments: [],
        entries: [],
        entry_logs: [],
        settings: {
          registration_status: { open: true },
          event_details: {
            name: "ALGO-RHYTHM",
            title: "ALGO-RHYTHM – CSE Fresher Party 2026 🎉",
            fee: 100,
            date: "9 September 2026",
            time: "1:00 PM onwards",
            venue: "Baldev Raj Mittal Unipolis"
          }
        }
      };
      fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }
    const content = fs.readFileSync(MOCK_DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.entry_logs) {
      parsed.entry_logs = [];
    }
    return parsed;
  } catch (err) {
    console.error('Error reading mock DB:', err);
    return { registrations: [], payments: [], entries: [], entry_logs: [], settings: {} };
  }
}


// 2. Helper to write JSON file
export function writeMockDb(db: MockDbSchema) {
  try {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing mock DB:', err);
  }
}

// 3. Settings helper
export function mockGetSetting(key: string) {
  const db = readMockDb();
  return db.settings[key] || null;
}

export function mockUpdateSetting(key: string, value: any) {
  const db = readMockDb();
  db.settings[key] = value;
  writeMockDb(db);
  return db.settings[key];
}

// 4. Registration helpers
export function mockGetRegistrationByNumber(regNum: string) {
  const db = readMockDb();
  return db.registrations.find(r => r.registration_number === regNum) || null;
}

export function mockGetRegistrationById(id: string) {
  const db = readMockDb();
  return db.registrations.find(r => r.id === id) || null;
}

export function mockGetRegistrationByToken(token: string) {
  const db = readMockDb();
  return db.registrations.find(r => r.ticket_token === token) || null;
}

export function mockCreateRegistration(data: any) {
  const db = readMockDb();
  
  // Auto-generate ticket_id
  const nextSeq = db.registrations.length + 1;
  const ticketId = `ALG26-CSE-${String(nextSeq).padStart(4, '0')}`;
  
  const newReg = {
    id: Math.random().toString(36).substring(2, 15),
    ...data,
    ticket_id: ticketId,
    email_sent: false,
    email_status: 'PENDING',
    email_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  db.registrations.push(newReg);
  writeMockDb(db);
  return newReg;
}

export function mockUpdateRegistration(id: string, updates: any) {
  const db = readMockDb();
  const index = db.registrations.findIndex(r => r.id === id);
  if (index === -1) return null;

  db.registrations[index] = {
    ...db.registrations[index],
    ...updates,
    updated_at: new Date().toISOString()
  };
  writeMockDb(db);
  return db.registrations[index];
}

export function mockSoftDeleteRegistration(id: string) {
  return mockUpdateRegistration(id, {
    deleted_at: new Date().toISOString(),
    is_deleted: true,
    registration_status: 'CANCELLED'
  });
}

export function mockRestoreRegistration(id: string) {
  return mockUpdateRegistration(id, {
    deleted_at: null,
    is_deleted: false,
    registration_status: 'PAID'
  });
}

// 5. Payment helpers
export function mockGetPaymentByOrderId(orderId: string) {
  const db = readMockDb();
  return db.payments.find(p => p.razorpay_order_id === orderId) || null;
}

export function mockCreatePayment(data: any) {
  const db = readMockDb();
  const newPay = {
    id: Math.random().toString(36).substring(2, 15),
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.payments.push(newPay);
  writeMockDb(db);
  return newPay;
}

export function mockUpdatePayment(id: string, updates: any) {
  const db = readMockDb();
  const index = db.payments.findIndex(p => p.id === id);
  if (index === -1) return null;

  db.payments[index] = {
    ...db.payments[index],
    ...updates,
    updated_at: new Date().toISOString()
  };
  writeMockDb(db);
  return db.payments[index];
}

// 6. Entry helpers
export function mockGetEntryByRegId(regId: string) {
  const db = readMockDb();
  return db.entries.find(e => e.registration_id === regId) || null;
}

export function mockCreateEntry(data: any) {
  const db = readMockDb();
  const newEntry = {
    id: Math.random().toString(36).substring(2, 15),
    ...data,
    entry_time: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  db.entries.push(newEntry);
  writeMockDb(db);
  return newEntry;
}

// 7. Stats aggregator
export function mockGetStats() {
  const db = readMockDb();
  
  const activeRegs = db.registrations.filter(r => !r.is_deleted && !r.deleted_at && r.registration_status !== 'CANCELLED');
  const totalReg = activeRegs.length;
  const paidRegs = activeRegs.filter(r => r.registration_status === 'PAID');
  const paidCount = paidRegs.length;
  const pendingReg = activeRegs.filter(r => r.registration_status === 'PENDING').length;
  
  // Sum payments for active paid registrations (1st Year: ₹100, 2nd Year: ₹200)
  const totalCollection = paidRegs.reduce((sum, r) => {
    const fee = r.year === '2nd Year' ? 200 : 100;
    return sum + fee;
  }, 0);
  
  const entriesCompleted = db.entries.length;
  const notYetEntered = Math.max(0, paidCount - entriesCompleted);
  const modelingRegistrations = paidRegs.filter(r => r.modeling === 'Yes').length;

  // Calculate 2.5% payment deductions
  const deductionRate = 0.025;
  const deductionsAmount = Number((totalCollection * deductionRate).toFixed(2));
  const paymentAfterDeductions = Number((totalCollection * (1 - deductionRate)).toFixed(2));

  return {
    total_registrations: totalReg,
    paid_registrations: paidCount,
    pending_payments: pendingReg,
    total_collection: totalCollection,
    deductions_amount: deductionsAmount,
    payment_after_deductions: paymentAfterDeductions,
    entries_completed: entriesCompleted,
    not_yet_entered: notYetEntered,
    modeling_registrations: modelingRegistrations
  };
}

// 8. Registrations Query Builder (with Search, Sorting, Filtering, and Pagination)
export function mockListRegistrations(params: any) {
  const db = readMockDb();
  const isDeletedView = params.deleted === 'true';
  
  // Pre-join registrations with entries and payments (mimic view registrations_with_details)
  let joinedList = db.registrations.map(r => {
    const entry = db.entries.find(e => e.registration_id === r.id);
    const payment = db.payments.find(p => p.registration_id === r.id && p.payment_status === 'SUCCESS');
    return {
      ...r,
      entry_status: entry ? 'ENTERED' : 'NOT_ENTERED',
      entry_time: entry ? entry.entry_time : null,
      entry_scanned_by: entry ? entry.scanned_by : null,
      razorpay_payment_id: payment ? (payment.razorpay_payment_id || payment.payment_id) : null,
      payment_time: payment ? payment.paid_at : null,
      payment_method: payment ? payment.payment_method : null,
      payment_status: payment ? payment.payment_status : (r.registration_status === 'PAID' ? 'SUCCESS' : 'PENDING'),
      refund_status: payment ? (payment.refund_status || 'NOT_REQUIRED') : 'NOT_REQUIRED'
    };
  });

  // Filter soft-deleted
  if (isDeletedView) {
    joinedList = joinedList.filter(r => r.is_deleted || r.deleted_at || r.registration_status === 'CANCELLED');
  } else {
    joinedList = joinedList.filter(r => !r.is_deleted && !r.deleted_at && r.registration_status !== 'CANCELLED');
  }

  const search = params.search || '';
  const page = params.page || 1;
  const limit = params.limit || 50;
  const year = params.year || 'All';
  const modeling = params.modeling || 'All';
  const paymentStatus = params.payment_status || 'All';
  const entryStatus = params.entry_status || 'All';
  const school = params.school || '';
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';

  // Apply filters
  if (search) {
    const s = search.toLowerCase();
    joinedList = joinedList.filter(r => 
      r.full_name.toLowerCase().includes(s) ||
      r.registration_number.toLowerCase().includes(s) ||
      (r.ticket_id && r.ticket_id.toLowerCase().includes(s)) ||
      r.email.toLowerCase().includes(s) ||
      r.phone.includes(s)
    );
  }

  if (year !== 'All') {
    joinedList = joinedList.filter(r => r.year === year);
  }

  if (modeling !== 'All') {
    joinedList = joinedList.filter(r => r.modeling === modeling);
  }

  if (paymentStatus !== 'All') {
    joinedList = joinedList.filter(r => r.registration_status === paymentStatus);
  }

  if (entryStatus !== 'All') {
    joinedList = joinedList.filter(r => r.entry_status === entryStatus);
  }

  if (school) {
    const sch = school.toLowerCase();
    joinedList = joinedList.filter(r => r.school_name.toLowerCase().includes(sch));
  }

  // Sorting
  joinedList.sort((a, b) => {
    let valA = a[sortBy] || '';
    let valB = b[sortBy] || '';

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const count = joinedList.length;

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit;
  const slicedList = joinedList.slice(from, to);

  return {
    registrations: slicedList,
    total: count,
    page,
    limit,
    pages: Math.ceil(count / limit)
  };
}

export function mockCreateEntryLog(data: any) {
  const db = readMockDb();
  const newLog = {
    id: Math.random().toString(36).substring(2, 15),
    ...data,
    scanned_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  db.entry_logs.push(newLog);
  writeMockDb(db);
  return newLog;
}

