"use client";

import { useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { credentialsSchema, safeNextPath } from "@/lib/validation";

type Mode = "signin" | "signup";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const scope = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-animate='card']", {
          y: 24,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
        });
        gsap.from("[data-animate='field']", {
          y: 12,
          opacity: 0,
          duration: 0.5,
          stagger: 0.08,
          delay: 0.15,
          ease: "power2.out",
        });
      });
    },
    { scope },
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const parsed = credentialsSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({
        email: flat.email?.[0],
        password: flat.password?.[0],
      });
      return;
    }
    setFieldErrors({});
    setPending(true);

    const { email, password } = parsed.data;
    const { error: authError } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setPending(false);
      return;
    }
    router.push(safeNextPath(searchParams.get("next")));
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink placeholder:text-ink-muted/60";

  return (
    <div ref={scope} className="w-full max-w-md">
      <div
        data-animate="card"
        className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-8 shadow-sm"
      >
        <header className="flex flex-col gap-1 text-center">
          <p className="font-display text-2xl text-accent" aria-hidden="true">
            道
          </p>
          <h1 className="font-display text-2xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Begin your first walk"}
          </h1>
          <p className="text-sm text-ink-muted">
            {mode === "signin"
              ? "Sign in to continue your journey."
              : "Create an account to record and share walks."}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div data-animate="field" className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-sm text-accent">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div data-animate="field" className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={8}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
            />
            {fieldErrors.password && (
              <p id="password-error" className="text-sm text-accent">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div aria-live="polite">
            {error && (
              <p className="rounded-lg bg-wash px-3 py-2 text-sm">{error}</p>
            )}
          </div>

          <button
            data-animate="field"
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending
              ? "One moment…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="flex flex-col gap-2 text-center text-sm text-ink-muted">
          <button
            type="button"
            className="underline underline-offset-4 hover:text-ink"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setFieldErrors({});
            }}
          >
            {mode === "signin"
              ? "New here? Create an account"
              : "Already walking with us? Sign in"}
          </button>
          <p>
            Just looking? Try the demo:{" "}
            <span className="text-ink">michi@seed.local</span> /{" "}
            <span className="text-ink">michi-demo-password</span>
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-ink">
          ← Back to Michi
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-canvas to-wash px-4 py-12">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
