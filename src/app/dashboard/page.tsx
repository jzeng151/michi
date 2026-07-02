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
    <div className="p-4">
      <h1 className="sr-only">Explore walks</h1>
      <WalkList lists={lists} />
    </div>
  );
}
