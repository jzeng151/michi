"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="rounded-full border border-line px-3 py-1.5 text-sm transition-colors hover:bg-wash"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
