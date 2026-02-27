import { requireAdminPageOrRedirect } from "@/lib/adminAuth";
import { AdminPanel } from "@/components/mic-brawl/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminMicBrawlPage() {
  await requireAdminPageOrRedirect("/admin/mic-brawl");
  return <AdminPanel />;
}

