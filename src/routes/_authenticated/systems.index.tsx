import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RiskBadge, StatusBadge } from "@/components/risk-badge";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/systems/")({
  head: () => ({ meta: [{ title: "AI Registry — GovernAI" }] }),
  component: SystemsList,
});

function SystemsList() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["ai_systems"],
    queryFn: async () => (await supabase.from("ai_systems").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const rows = (data ?? []).filter((s) =>
    !q || [s.name, s.department, s.vendor, s.ai_model, s.use_case_category].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader
        title="AI Registry"
        description="Every AI system across your organization."
        actions={
          <Link to="/systems/new">
            <Button><Plus className="size-4 mr-1.5" />Register system</Button>
          </Link>
        }
      />
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search className="size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, vendor, department…" className="border-0 bg-transparent focus-visible:ring-0 h-8" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Name</th>
                <th className="text-left font-medium px-4 py-2.5">Department</th>
                <th className="text-left font-medium px-4 py-2.5">Model</th>
                <th className="text-left font-medium px-4 py-2.5">Vendor</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-left font-medium px-4 py-2.5">Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No AI systems yet. Register your first.</td></tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-accent/40 cursor-pointer">
                  <td className="px-4 py-3">
                    <Link to="/systems/$id" params={{ id: s.id }} className="font-medium hover:text-primary">{s.name}</Link>
                    {s.business_owner && <p className="text-xs text-muted-foreground">{s.business_owner}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.department || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.ai_model || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.vendor || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.deployment_status} /></td>
                  <td className="px-4 py-3"><RiskBadge level={s.risk_level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
