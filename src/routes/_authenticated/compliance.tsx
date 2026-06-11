import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({ meta: [{ title: "Compliance — GovernAI" }] }),
  component: CompliancePage,
});

const FRAMEWORKS = {
  nist_ai_rmf: "NIST AI Risk Management Framework",
  iso_42001: "ISO/IEC 42001",
  eu_ai_act: "EU AI Act",
} as const;

function CompliancePage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["controls"],
    queryFn: async () => (await supabase.from("compliance_controls").select("*").order("framework").order("control_code")).data ?? [],
  });

  async function toggle(id: string, completed: boolean, code: string) {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("compliance_controls").update({ completed, updated_by: u.user?.id, updated_at: new Date().toISOString() }).eq("id", id);
    await logAudit(completed ? "control.completed" : "control.uncompleted", "control", id, { code });
    qc.invalidateQueries({ queryKey: ["controls"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const byFw = (data ?? []).reduce<Record<string, typeof data>>((acc, c) => {
    (acc[c.framework] ??= [] as any).push(c); return acc;
  }, {} as any);

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title="Compliance" description="Track governance status against major AI frameworks." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {Object.entries(FRAMEWORKS).map(([fw, label]) => {
          const items = byFw[fw] ?? [];
          const done = items.filter((c: any) => c.completed).length;
          const pct = items.length ? Math.round((done / items.length) * 100) : 0;
          return (
            <Card key={fw} className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-3xl font-semibold mt-2">{pct}%</p>
              <p className="text-xs text-muted-foreground mt-1">{done}/{items.length} controls · {items.length - done} missing</p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-3">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      {Object.entries(FRAMEWORKS).map(([fw, label]) => (
        <Card key={fw} className="p-5 mb-4">
          <h3 className="font-medium mb-3">{label}</h3>
          <div className="space-y-1">
            {(byFw[fw] ?? []).map((c: any) => (
              <label key={c.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0 cursor-pointer">
                <Checkbox checked={c.completed} onCheckedChange={(v) => toggle(c.id, !!v, c.control_code)} className="mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm"><span className="text-muted-foreground mr-2">{c.control_code}</span>{c.control_name}</p>
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                </div>
              </label>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
