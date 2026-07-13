import { CreateWalkPanel } from "@/components/walks/CreateWalkPanel";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "New walk" };

export default async function NewWalkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/new");
  return <CreateWalkPanel userId={user.id} />;
}
