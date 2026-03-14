import { requireAdminPageOrRedirect } from "@/lib/adminAuth";
import { SocialRepliesAdminClient } from "@/components/admin/SocialRepliesAdminClient";

export default async function AdminSocialRepliesPage() {
  await requireAdminPageOrRedirect("/admin/social-replies");

  return (
    <main>
      <h1 className="section-title">Social Auto Reply</h1>
      <p className="muted">Webhook seguro para responder comentarios de Facebook e Instagram solo cuando caen en reglas claras.</p>
      <div style={{ marginTop: 16 }}>
        <SocialRepliesAdminClient />
      </div>
    </main>
  );
}
