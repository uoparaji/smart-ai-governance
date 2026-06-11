import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/risk-badge";
import { Plus } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/incidents")({
  head: () => ({ meta: [{ title: "Incidents — GovernAI" }] }),
  component: IncidentsPage,
});

function IncidentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: incidents } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => (await supabase.from("incidents").select("*, ai_systems(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: systems } = useQuery({
    queryKey: ["ai_systems_min"],
    queryFn: async () => (await supabase.from("ai_systems").select("id,name")).data ?? [],
  });

  const [form, setForm] = useState({ title: "", description: "", severity: "low", ai_system_id: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const { data: u } = await supabase.auth.getUser();
    const { error, data } = await supabase.from("incidents").insert({
      title: form.title, description: form.description,
      severity: form.severity as any, ai_system_id: form.ai_system_id || null,
      reported_by: u.user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await logAudit("incident.created", "incident", data.id, { title: form.title });
    toast.success("Incident logged");
    setOpen(false);
    setForm({ title: "", description: "", severity: "low", ai_system_id: "" });
    qc.invalidateQueries({ queryKey: ["incidents"] });
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("incidents").update({ status: status as any }).eq("id", id);
    await logAudit("incident.status_changed", "incident", id, { status });
    qc.invalidateQueries({ queryKey: ["incidents"] });
  }

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader title="Incidents" description="Track AI-related incidents and response."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />Log incident</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log an incident</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e)=>set("title", e.target.value)} /></div>
                <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e)=>set("description", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Severity</Label>
                    <Select value={form.severity} onValueChange={(v)=>set("severity", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Related AI system</Label>
                    <Select value={form.ai_system_id} onValueChange={(v)=>set("ai_system_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {(systems ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter><Button onClick={submit} disabled={!form.title}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Title</th>
              <th className="text-left font-medium px-4 py-2.5">Severity</th>
              <th className="text-left font-medium px-4 py-2.5">Related system</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody>
            {(incidents ?? []).length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No incidents.</td></tr>
            )}
            {(incidents ?? []).map((i: any) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{i.title}</p>
                  {i.description && <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">{i.description}</p>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={i.severity} /></td>
                <td className="px-4 py-3 text-muted-foreground">{i.ai_systems?.name || "—"}</td>
                <td className="px-4 py-3">
                  <Select value={i.status} onValueChange={(v) => updateStatus(i.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(i.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
