import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOverviewData } from "@/lib/dashboard-data";
import { AnalyticsClient } from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const data = await getOverviewData(user.id);

  return <AnalyticsClient data={data} />;
}
