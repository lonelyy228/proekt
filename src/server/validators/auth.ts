import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Введите корректный email").max(255, "Email слишком длинный"),
  password: z
    .string()
    .min(10, "Пароль должен быть минимум 10 символов")
    .max(128, "Пароль слишком длинный")
    .regex(/[A-Z]/, "Пароль должен содержать хотя бы одну заглавную латинскую букву")
    .regex(/[a-z]/, "Пароль должен содержать хотя бы одну строчную латинскую букву")
    .regex(/[0-9]/, "Пароль должен содержать хотя бы одну цифру")
    .regex(/[^A-Za-z0-9]/, "Пароль должен содержать хотя бы один спецсимвол, например !")
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
