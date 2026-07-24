/**
 * Shared contract for the lead-capture endpoint (`/api/lead`).
 *
 * Kept separate from the route handler so client components (forms) can
 * import the types without pulling server-only code, mirroring how
 * `calculator-schema.ts` is shared between the calculator route and UI.
 */

import { z } from "zod";

/** Where on the site the lead originated. */
export const leadSourceSchema = z.enum([
  "contacts",
  "calculator",
  "lot",
  "catalog",
]);

export type LeadSource = z.infer<typeof leadSourceSchema>;

export const leadInputSchema = z.object({
  name: z.string().trim().min(1, "Укажите ваше имя").max(200),
  phone: z
    .string()
    .trim()
    .min(5, "Укажите номер телефона")
    .max(40)
    .refine((v) => (v.match(/\d/g) ?? []).length >= 10, {
      message: "Укажите телефон полностью, с кодом города или оператора",
    }),
  source: leadSourceSchema,
  /** What the visitor is interested in (vehicle type, lot title, etc.). */
  interest: z.string().trim().max(500).optional(),
  comment: z.string().trim().max(2000).optional(),
  /** Page the form was submitted from — helps the manager with context. */
  pageUrl: z.string().trim().max(2000).optional(),
  /**
   * Honeypot: visually hidden field humans never fill. Non-empty value
   * means an automated submission — the API pretends success and drops it.
   */
  website: z.string().max(200).optional(),
  /** Free-form extra context (calculator params, lot id, …). */
  meta: z.record(z.string(), z.string()).optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export interface LeadResponseOk {
  ok: true;
}

export interface LeadResponseError {
  ok: false;
  error: "invalid_json" | "validation" | "delivery_failed";
  issues?: unknown[];
}

export type LeadResponse = LeadResponseOk | LeadResponseError;
