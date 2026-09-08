export const EVENT_CONFIG = {
  name: "ALGO-RHYTHM",
  title: "ALGO-RHYTHM – CSE Fresher Party 2026 🎉",
  tagline: "Freshers: Get ready for your grand welcome!",
  description: "We are thrilled to announce our annual CSE Fresher Party, a celebration to welcome our newest members to the CSE family!",
  date: "2026-09-09T13:00:00+05:30", // ISO string for countdown timer logic (9 Sept 2026, 1:00 PM IST)
  displayDate: "9 September 2026",
  displayTime: "1:00 PM onwards",
  registrationDeadline: "2026-09-09T00:00:00+05:30", // 8-9 Sept 2026, 12:00 Midnight IST (Extended till 12 AM)
  displayRegistrationDeadline: "Today, 8 Sept at 12:00 Midnight (Extended)",
  venue: "Baldev Raj Mittal Unipolis",
  hostedBy: "School of Computing and Artificial Intelligence",
  registrationFee: 100, // Base in INR (1st Year)
  registrationFeePaise: 10000, // in Paise (for Razorpay API)
  feesByYear: {
    '1st Year': { inr: 100, paise: 10000 },
    '2nd Year': { inr: 200, paise: 20000 },
    '3rd Year': { inr: 200, paise: 20000 },
    '4th Year': { inr: 200, paise: 20000 },
  } as Record<string, { inr: number; paise: number }>,

  /**
   * Determine academic year from registration number:
   * Starting with 126 -> 1st Year
   * Starting with 125 -> 2nd Year
   * Starting with 124 -> 3rd Year
   * Starting with 123 -> 4th Year
   * Fallback -> null if not matched
   */
  getYearFromRegNo: (regNo?: string | null): '1st Year' | '2nd Year' | '3rd Year' | '4th Year' | null => {
    if (!regNo) return null;
    const clean = regNo.trim();
    if (clean.startsWith('126')) return '1st Year';
    if (clean.startsWith('125')) return '2nd Year';
    if (clean.startsWith('124')) return '3rd Year';
    if (clean.startsWith('123')) return '4th Year';
    return null;
  },

  /**
   * Validate registration number eligibility:
   * Returns error message or null if valid.
   * Allowed batches: 123 (4th yr), 124 (3rd yr), 125 (2nd yr), 126 (1st yr)
   */
  getRegNoValidationError: (regNo?: string | null): string | null => {
    if (!regNo) return "Please enter your registration number.";
    const clean = regNo.trim();
    if (!clean) return "Please enter your registration number.";
    
    // Check first 3 digits
    const prefix = clean.slice(0, 3);
    const prefixNum = parseInt(prefix, 10);

    if (
      clean.startsWith('123') || 
      clean.startsWith('124') || 
      clean.startsWith('125') || 
      clean.startsWith('126')
    ) {
      return null; // Valid!
    }

    if (!isNaN(prefixNum) && prefix.length === 3) {
      if (prefixNum >= 127) {
        return "wrong registration number , contact organizing team";
      }
      if (prefixNum < 123) {
        return "Only 1st, 2nd, 3rd, and 4th year students are allowed in this freshers";
      }
    }

    // Fallback if not pure numbers or under 3 characters
    if (clean.startsWith('12')) {
      const thirdChar = clean[2];
      if (thirdChar && thirdChar >= '7') {
        return "wrong registration number , contact organizing team";
      }
      if (thirdChar && thirdChar < '3') {
        return "Only 1st, 2nd, 3rd, and 4th year students are allowed in this freshers";
      }
    }

    return "Only 1st, 2nd, 3rd, and 4th year students are allowed in this freshers";
  },

  coupons: {} as Record<string, any>,

  /**
   * Normalize and validate coupon code
   */
  validateCoupon: (_couponCode?: string | null, _yearOrRegNo?: string | null) => {
    return { valid: false, message: null, coupon: null };
  },

  /**
   * Get registration fee by Year or Registration Number
   * 1st Year (126...): ₹100 (10000 paise)
   * 2nd Year (125...), 3rd Year (124...), 4th Year (123...): ₹200 (20000 paise)
   */
  getFeeForYear: (yearOrRegNo?: string | null, _couponCode?: string | null) => {
    const is1stYear = yearOrRegNo === '1st Year' || (typeof yearOrRegNo === 'string' && yearOrRegNo.trim().startsWith('126'));
    const baseInr = is1stYear ? 100 : 200;
    const basePaise = is1stYear ? 10000 : 20000;

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
