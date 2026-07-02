import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Only allow same-origin relative redirect targets (no open redirects). */
export function safeNextPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}
