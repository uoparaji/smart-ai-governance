import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/risk-badge";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Approvals — GovernAI" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { data } = useQuery({
    queryKey: ["all-approvals"],
    queryFn: async () => (await supabase
      .from("approvals")
      .select("id, stage, status, updated_at, ai_systems(id,name,risk_level)")
      .order("updated_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader title="Approvals" description="All governance reviews across AI systems." />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">System</th>
              <th className="text-left font-medium px-4 py-2.5">Stage</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No approvals in progress.</td></tr>
            )}
            {(data ?? []).map((a: any) => (
              <tr key={a.id} className="border-t border-border hover:bg-accent/40">
                <td className="px-4 py-3">
                  {a.ai_systems ? (
                    <Link to="/systems/$id" params={{ id: a.ai_systems.id }} className="font-medium hover:text-primary">{a.ai_systems.name}</Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{a.stage}</td>
                <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(a.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
