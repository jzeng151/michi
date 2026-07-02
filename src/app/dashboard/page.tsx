import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchBrowseLists } from "@/lib/walks";
import { WalkList } from "@/components/walks/WalkList";

export const metadata = { title: "Explore walks" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout already redirects unauthenticated visitors.
  const lists = await fetchBrowseLists(supabase, user!.id);

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="sr-only">Explore walks</h1>
      <Link
        href="/dashboard/new"
        className="self-start rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
      >
        ＋ New walk
      </Link>
      <WalkList lists={lists} />
    </div>
  );
}
