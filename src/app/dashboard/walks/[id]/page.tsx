import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fetchWalkDetail } from "@/lib/walks";
import { WalkDetailPanel } from "@/components/walks/WalkDetailPanel";

export default async function WalkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout already redirects unauthenticated visitors.
  const [data, profileRes] = await Promise.all([
    fetchWalkDetail(supabase, id, user!.id),
    supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user!.id)
      .single(),
  ]);
  if (!data) notFound();

  const viewerName =
    profileRes.data?.display_name ?? profileRes.data?.username ?? "You";
  const viewerUsername = profileRes.data?.username ?? "you";

  return (
    <WalkDetailPanel
      data={data}
      viewerId={user!.id}
      viewerName={viewerName}
      viewerUsername={viewerUsername}
    />
  );
}
