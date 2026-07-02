import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { ThemeMenu } from "@/components/dashboard/ThemeMenu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4">
        <Link
          href="/dashboard"
          className="font-display text-lg font-semibold text-ink"
        >
          <span className="text-accent" aria-hidden="true">
            道
          </span>{" "}
          Michi
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-ink-muted sm:inline">
            {profile?.display_name ?? profile?.username ?? user.email}
          </span>
          <ThemeMenu />
          <SignOutButton />
        </div>
      </header>
      <div
        id="dashboard-content"
        className="flex min-h-0 flex-1 flex-col-reverse md:flex-row"
      >
        {children}
      </div>
    </div>
  );
}
