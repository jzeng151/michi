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
  const data = await fetchWalkDetail(supabase, id);
  if (!data) notFound();

  return <WalkDetailPanel data={data} />;
}
