export const EVENT_CONFIG = {
  name: "ALGO-RHYTHM",
  title: "ALGO-RHYTHM – CSE Fresher Party 2026 🎉",
  tagline: "Freshers: Get ready for your grand welcome!",
  description: "We are thrilled to announce our annual CSE Fresher Party, a celebration to welcome our newest members to the CSE family!",
  date: "2026-09-09T13:00:00+05:30", // ISO string for countdown timer logic (9 Sept 2026, 1:00 PM IST)
  displayDate: "9 September 2026",
  displayTime: "1:00 PM onwards",
  venue: "Baldev Raj Mittal Unipolis",
  hostedBy: "School of Computing and Artificial Intelligence",
  registrationFee: 100, // Base in INR (1st Year)
  registrationFeePaise: 10000, // in Paise (for Razorpay API)
  feesByYear: {
    '1st Year': { inr: 100, paise: 10000 },
    '2nd Year': { inr: 200, paise: 20000 },
  } as Record<string, { inr: number; paise: number }>,

  /**
   * Determine academic year from registration number:
   * Starting with 125 -> 2nd Year
   * Starting with 126 -> 1st Year
   * Fallback -> null if neither
   */
  getYearFromRegNo: (regNo?: string | null): '1st Year' | '2nd Year' | null => {
    if (!regNo) return null;
    const clean = regNo.trim();
    if (clean.startsWith('125')) return '2nd Year';
    if (clean.startsWith('126')) return '1st Year';
    return null;
  },

  /**
   * Validate registration number eligibility:
   * Returns error message or null if valid.
   * - Starts with 127 or more: "wrong registration number , contact organizing team"
   * - Less than 125: "Only 1st year and second year is allowed in this freshers"
   */
  getRegNoValidationError: (regNo?: string | null): string | null => {
    if (!regNo) return "Please enter your registration number.";
    const clean = regNo.trim();
    if (!clean) return "Please enter your registration number.";
    
    // Check first 3 digits
    const prefix = clean.slice(0, 3);
    const prefixNum = parseInt(prefix, 10);

    if (clean.startsWith('125') || clean.startsWith('126')) {
      return null; // Valid!
    }

    if (!isNaN(prefixNum) && prefix.length === 3) {
      if (prefixNum >= 127) {
        return "wrong registration number , contact organizing team";
      }
      if (prefixNum < 125) {
        return "Only 1st year and second year is allowed in this freshers";
      }
    }

    // Fallback if not pure numbers or under 3 characters
    if (clean.startsWith('12')) {
      const thirdChar = clean[2];
      if (thirdChar && thirdChar >= '7') {
        return "wrong registration number , contact organizing team";
      }
      if (thirdChar && thirdChar < '5') {
        return "Only 1st year and second year is allowed in this freshers";
      }
    }

    return "Only 1st year and second year is allowed in this freshers";
  },

  coupons: {
    'ALGO50': {
      code: 'ALGO50',
      discountInr: 50,
      discountPaise: 5000,
      allowedYears: ['2nd Year'],
      description: '₹50 OFF for 2nd Year Students (Pay ₹150 instead of ₹200)'
    }
  },

  /**
   * Normalize and validate coupon code for a given academic year or reg number
   */
  validateCoupon: (couponCode?: string | null, yearOrRegNo?: string | null) => {
    if (!couponCode) {
      return { valid: false, message: null, coupon: null };
    }
    const clean = couponCode.trim().toUpperCase().replace(/[\s_-]+/g, '');
    const normalized = (clean === 'ALGO50' || clean === 'ALGO-50') ? 'ALGO50' : clean;

    if (normalized !== 'ALGO50') {
      return { valid: false, message: 'Invalid coupon code.', coupon: null };
    }

    const resolvedYear = EVENT_CONFIG.getYearFromRegNo(yearOrRegNo) || (yearOrRegNo === '2nd Year' ? '2nd Year' : (yearOrRegNo === '1st Year' ? '1st Year' : null));
    if (resolvedYear && resolvedYear !== '2nd Year') {
      return { valid: false, message: 'Coupon ALGO50 is only valid for 2nd Year students.', coupon: null };
    }

    return {
      valid: true,
      message: 'Coupon ALGO50 applied! ₹50 discount active.',
      coupon: {
        code: 'ALGO50',
        discountInr: 50,
        discountPaise: 5000
      }
    };
  },

  /**
   * Get registration fee by Year or Registration Number with optional coupon
   */
  getFeeForYear: (yearOrRegNo?: string | null, couponCode?: string | null) => {
    const is2ndYear = yearOrRegNo === '2nd Year' || (typeof yearOrRegNo === 'string' && yearOrRegNo.trim().startsWith('125'));
    const baseInr = is2ndYear ? 200 : 100;
    const basePaise = is2ndYear ? 20000 : 10000;

    if (is2ndYear) {
      const couponCheck = EVENT_CONFIG.validateCoupon(couponCode, '2nd Year');
      if (couponCheck.valid) {
        return {
          baseInr,
          basePaise,
          discountInr: 50,
          discountPaise: 5000,
          inr: 150,
          paise: 15000,
          couponCode: 'ALGO50',
          couponApplied: true
        };
      }
    }

    return {
      baseInr,
      basePaise,
      discountInr: 0,
      discountPaise: 0,
      inr: baseInr,
      paise: basePaise,
      couponCode: null,
      couponApplied: false
    };
  },

  contacts: [
    { name: "Bhanu Pratap Kaushik", phone: "8273930552" },
    { name: "Vaidya Vaibhava", phone: "9441262727" }
  ]
};
