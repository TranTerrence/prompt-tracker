import { requireAdmin } from "@/lib/auth";
import ExportClient from "./export-client";

export default async function AdminExportPage() {
  const { org } = await requireAdmin();
  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Export des données
      </h1>
      <ExportClient orgId={org.id} />
    </div>
  );
}
