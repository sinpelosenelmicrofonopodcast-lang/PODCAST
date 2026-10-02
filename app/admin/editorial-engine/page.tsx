import type { Metadata } from "next";
import { EditorialEngineWorkbench } from "@/components/admin/EditorialEngineWorkbench";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";

export const metadata: Metadata = {
  title: "SPM Editorial Engine | Admin",
  robots: { index: false, follow: false }
};

export default async function EditorialEnginePage() {
  await requireStaffPageOrRedirect("/admin/editorial-engine", "manage_news");

  return (
    <main className="editorial-engine-page">
      <EditorialEngineWorkbench />
    </main>
  );
}
