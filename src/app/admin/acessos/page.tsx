import { requireAdmin } from "@/lib/auth";
import { getAccessList } from "@/lib/access-data";
import AccessManager from "@/components/AccessManager";

export const dynamic = "force-dynamic";

export default async function AcessosPage() {
  const session = await requireAdmin();
  const accesses = await getAccessList();

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 md:px-8">
      <h1 className="mb-6 text-2xl font-bold">Acessos</h1>
      <AccessManager
        initialAccesses={accesses}
        currentUserId={session.userId}
      />
    </div>
  );
}
