import { z } from 'zod';
import { EVENT_CONFIG } from '@/config/event';

export const registerSchema = z.object({
  registration_number: z
    .string()
    .min(1, "Please enter your registration number.")
    .trim()
    .toUpperCase()
    .superRefine((val, ctx) => {
      const err = EVENT_CONFIG.getRegNoValidationError(val);
      if (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err,
        });
      }
    }),
  full_name: z
    .string()
    .trim()
    .min(1, "Please enter your full name.")
    .max(100, "Name must be less than 100 characters."),
  year: z.enum(['1st Year', '2nd Year']).optional(),
  school_name: z
    .string()
    .trim()
    .min(1, "Please enter your school name."),
  modeling: z.enum(['Yes', 'No', 'Male', 'Female', 'Yes - Male', 'Yes - Female'], {
    errorMap: () => ({ message: "Please select whether you want to enroll for modeling." }),
  }),
  modeling_talent: z
    .string()
    .trim()
    .max(1000, "Please keep your description under 1000 characters.")
    .optional()
    .nullable(),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number."),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address."),
  photo_path: z
    .string()
    .optional(),
}).superRefine((data, ctx) => {
  // Cross-field validation: modeling_talent is required when modeling is enrolled (not 'No')
  if (data.modeling && data.modeling !== 'No' && !data.modeling_talent?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['modeling_talent'],
      message: 'Please tell us about your talent or what you would like to perform.',
    });
  }
});

export type RegisterInput = z.infer<typeof registerSchema>;
