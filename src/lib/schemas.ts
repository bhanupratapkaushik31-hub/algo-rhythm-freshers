import { z } from 'zod';

export const registerSchema = z.object({
  registration_number: z
    .string()
    .min(1, "Please enter your registration number.")
    .trim()
    .toUpperCase(),
  full_name: z
    .string()
    .trim()
    .min(1, "Please enter your full name.")
    .max(100, "Name must be less than 100 characters."),
  year: z.enum(['1st Year', '2nd Year'], {
    errorMap: () => ({ message: "Please select your year." }),
  }),
  school_name: z
    .string()
    .trim()
    .min(1, "Please enter your school name."),
  modeling: z.enum(['Yes', 'No'], {
    errorMap: () => ({ message: "Please select whether you want to enroll for modeling." }),
  }),
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
});

export type RegisterInput = z.infer<typeof registerSchema>;
