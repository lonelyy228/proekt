import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional()
});

export const totpVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => /^\d{6}$/.test(value) || /^[A-Z0-9]{10}$/.test(value), {
      message: "Код 2FA должен содержать 6 цифр или 10 символов резервного кода"
    })
});
