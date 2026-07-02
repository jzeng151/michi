import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const walkFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give your walk a title")
    .max(120, "Keep the title under 120 characters"),
  region: z.string().trim().max(80, "Keep the region under 80 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Keep the description under 2000 characters"),
  visibility: z.enum(["public", "private"]),
});

export const photoAltSchema = z
  .string()
  .trim()
  .min(1, "Describe this photo for people who can't see it")
  .max(300);

/** Only allow same-origin relative redirect targets (no open redirects). */
export function safeNextPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}
