import { getSupabaseServer } from "@/lib/supabase";
import ApplicationDetail from "./Detail";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ApplicationPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = getSupabaseServer();
  const { data: application } = await supabase
    .from("applications")
    .select("*, contacts(name, email, company_name)")
    .eq("id", params.id)
    .single();

  if (!application) notFound();

  return <ApplicationDetail initial={application} />;
}
