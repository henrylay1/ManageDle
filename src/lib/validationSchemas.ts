import { z } from 'zod';

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Register form validation schema
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Score entry form validation schema
 */
export const scoreEntrySchema = z.object({
  score: z.number()
    .int('Score must be a whole number')
    .min(0, 'Score cannot be negative')
    .or(z.string().regex(/^\d+$/, 'Score must be a number').transform(Number)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  shareText: z.string().optional(),
});

export type ScoreEntryFormData = z.infer<typeof scoreEntrySchema>;

/**
 * Ticket/feedback form validation schema
 */
export const ticketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(100, 'Subject is too long'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(1000, 'Description is too long'),
  category: z.enum(['bug', 'feature', 'question', 'other']),
});

export type TicketFormData = z.infer<typeof ticketSchema>;

/**
 * Add game form validation schema
 */
export const addGameSchema = z.object({
  displayName: z.string().min(1, 'Game name is required').max(50, 'Name is too long'),
  url: z.string().url('Must be a valid URL'),
  icon: z.string().max(4),
  isActive: z.boolean(),
  isFailable: z.boolean(),
});

export type AddGameFormData = z.infer<typeof addGameSchema>;
