import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RiskBadge, StatusBadge } from "@/components/risk-badge";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { Trash2, FileText, CheckCircle2, XCircle, MessageSquareWarning } from "lucide-react";

export const Route = createFileRoute("/_authenticated/systems/$id")({
  head: () => ({ meta: [{ title: "AI System — GovernAI" }] }),
  component: SystemDetail,
});

const QUESTIONS = [
  ["decisions_about_people", "Does the system make decisions about people?"],
  ["processes_personal_data", "Does it process personal data?"],
  ["customer_facing", "Is customer-facing output generated?"],
  ["financial_harm", "Could incorrect outputs cause financial harm?"],
  ["legal_harm", "Could incorrect outputs cause legal harm?"],
  ["externally_hosted", "Is the model externally hosted?"],
  ["sensitive_data", "Is sensitive data used?"],
] as const;

const STAGES = ["security", "privacy", "legal", "compliance"] as const;

function levelFor(score: number): "low" | "medium" | "high" {
  if (score <= 2) return "low";
  if (score <= 4) return "medium";
  return "high";
}

function SystemDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: system } = useQuery({
    queryKey: ["system", id],
    queryFn: async () => (await supabase.from("ai_systems").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: risk } = useQuery({
    queryKey: ["risk", id],
    queryFn: async () => (await supabase.from("risk_assessments").select("*").eq("ai_system_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const { data: approvals } = useQuery({
    queryKey: ["approvals", id],
    queryFn: async () => (await supabase.from("approvals").select("*").eq("ai_system_id", id)).data ?? [],
  });

  if (!system) return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title={system.name}
        description={system.description || "No description"}
        actions={
          <>
            <StatusBadge status={system.deployment_status} />
            <RiskBadge level={system.risk_level} />
            <Button variant="outline" size="sm" onClick={async () => {
              if (!confirm("Delete this system?")) return;
              await supabase.from("ai_systems").delete().eq("id", id);
              await logAudit("ai_system.deleted", "ai_system", id);
              toast.success("Deleted");
              navigate({ to: "/systems" });
            }}><Trash2 className="size-4" /></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetaField label="Department" value={system.department} />
        <MetaField label="Business owner" value={system.business_owner} />
        <MetaField label="Model" value={system.ai_model} />
        <MetaField label="Vendor" value={system.vendor} />
        <MetaField label="Use case" value={system.use_case_category} />
        <MetaField label="Data sources" value={system.data_sources} />
      </div>

      <Tabs defaultValue="risk">
        <TabsList>
          <TabsTrigger value="risk">Risk assessment</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>
        <TabsContent value="risk" className="mt-4">
          <RiskAssessment systemId={id} existing={risk} onSaved={() => qc.invalidateQueries({ queryKey: ["system", id] })} />
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <ApprovalsPanel systemId={id} approvals={approvals ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["approvals", id] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm mt-1">{value || "—"}</p>
    </div>
  );
}

function RiskAssessment({ systemId, existing, onSaved }: { systemId: string; existing: any; onSaved: () => void }) {
  const [answers, setAnswers] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    QUESTIONS.forEach(([k]) => init[k] = existing?.[k] ?? false);
    return init;
  });
  useEffect(() => {
    if (existing) {
      const next: Record<string, boolean> = {};
      QUESTIONS.forEach(([k]) => next[k] = existing[k] ?? false);
      setAnswers(next);
    }
  }, [existing]);

  const score = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);
  const level = levelFor(score);

  async function save() {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("risk_assessments").insert({
      ai_system_id: systemId, ...answers, risk_score: score, risk_level: level, assessed_by: userData.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("ai_systems").update({ risk_level: level }).eq("id", systemId);
    await logAudit("risk_assessment.completed", "ai_system", systemId, { score, level });
    toast.success("Risk assessment saved");
    onSaved();
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Risk questionnaire</h3>
        <div className="flex items-center gap-3">
          <div className="text-sm">Score: <span className="font-medium">{score}/7</span></div>
          <RiskBadge level={level} />
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-6">
        <div
          className={`h-full transition-all ${level === "high" ? "bg-destructive" : level === "medium" ? "bg-warning" : "bg-success"}`}
          style={{ width: `${(score / 7) * 100}%` }}
        />
      </div>
      <div className="space-y-1">
        {QUESTIONS.map(([k, q]) => (
          <div key={k} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
            <span className="text-sm">{q}</span>
            <Switch checked={answers[k]} onCheckedChange={(v) => setAnswers((a) => ({ ...a, [k]: v }))} />
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-6">
        <Button onClick={save}>Save assessment</Button>
      </div>
    </Card>
  );
}

function ApprovalsPanel({ systemId, approvals, onChange }: { systemId: string; approvals: any[]; onChange: () => void }) {
  async function ensureStages() {
    const missing = STAGES.filter((s) => !approvals.find((a) => a.stage === s));
    if (missing.length === 0) return;
    await supabase.from("approvals").insert(missing.map((stage) => ({ ai_system_id: systemId, stage })));
    await logAudit("approval.workflow_started", "ai_system", systemId);
    onChange();
  }

  async function setStatus(approvalId: string, status: "approved" | "rejected" | "changes_requested", stage: string, notes?: string) {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("approvals").update({ status, reviewer_id: userData.user?.id, notes: notes ?? null }).eq("id", approvalId);
    await logAudit(`approval.${status}`, "ai_system", systemId, { stage });
    toast.success(`${stage} ${status.replace("_", " ")}`);
    onChange();
  }

  if (approvals.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">No approval workflow yet.</p>
        <Button onClick={ensureStages}>Start approval workflow</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {STAGES.map((stage) => {
        const a = approvals.find((x) => x.stage === stage);
        if (!a) return null;
        return <StageCard key={a.id} approval={a} onAction={(s, n) => setStatus(a.id, s, stage, n)} />;
      })}
    </div>
  );
}

function StageCard({ approval, onAction }: { approval: any; onAction: (s: "approved" | "rejected" | "changes_requested", notes?: string) => void }) {
  const [notes, setNotes] = useState(approval.notes ?? "");
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium capitalize">{approval.stage} review</h4>
          <p className="text-xs text-muted-foreground">Stage of governance workflow</p>
        </div>
        <StatusBadge status={approval.status} />
      </div>
      <Textarea placeholder="Review notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={() => onAction("approved", notes)}><CheckCircle2 className="size-4 mr-1.5" />Approve</Button>
        <Button size="sm" variant="outline" onClick={() => onAction("changes_requested", notes)}><MessageSquareWarning className="size-4 mr-1.5" />Request changes</Button>
        <Button size="sm" variant="outline" onClick={() => onAction("rejected", notes)}><XCircle className="size-4 mr-1.5" />Reject</Button>
      </div>
    </Card>
  );
}
