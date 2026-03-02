import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPinnedArtifacts } from "@/lib/dashboard-data";
import { DashboardLayoutClient } from "./DashboardLayoutClient";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const pinnedArtifacts = await getPinnedArtifacts(user.id);

  return (
    <DashboardLayoutClient pinnedArtifacts={pinnedArtifacts}>
      {children}
    </DashboardLayoutClient>
  );
}
