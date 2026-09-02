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
   * Get registration fee by Year or Registration Number
   */
  getFeeForYear: (yearOrRegNo?: string | null) => {
    if (!yearOrRegNo) {
      return { inr: 100, paise: 10000 };
    }
    // If it's already '2nd Year' or starts with '125'
    if (yearOrRegNo === '2nd Year' || yearOrRegNo.trim().startsWith('125')) {
      return { inr: 200, paise: 20000 };
    }
    return { inr: 100, paise: 10000 };
  },

  contacts: [
    { name: "Bhanu Pratap Kaushik", phone: "8273930552" },
    { name: "Vaidya Vaibhava", phone: "9441262727" }
  ]
};
