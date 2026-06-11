import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/systems/new")({
  head: () => ({ meta: [{ title: "Register AI System — GovernAI" }] }),
  component: NewSystem,
});

function NewSystem() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", department: "", business_owner: "",
    ai_model: "", vendor: "", data_sources: "", use_case_category: "",
    deployment_status: "proposed" as "proposed" | "testing" | "production" | "retired",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("ai_systems").insert({ ...form, created_by: userData.user?.id }).select().single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    await logAudit("ai_system.created", "ai_system", data.id, { name: form.name });
    toast.success("AI system registered");
    navigate({ to: "/systems/$id", params: { id: data.id } });
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="Register AI system" description="Add a new AI use case to the registry." />
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="System name" required><Input value={form.name} onChange={(e)=>set("name", e.target.value)} required /></Field>
            <Field label="Department"><Input value={form.department} onChange={(e)=>set("department", e.target.value)} placeholder="e.g. Marketing" /></Field>
            <Field label="Business owner"><Input value={form.business_owner} onChange={(e)=>set("business_owner", e.target.value)} placeholder="Name or email" /></Field>
            <Field label="Use case category"><Input value={form.use_case_category} onChange={(e)=>set("use_case_category", e.target.value)} placeholder="e.g. Customer support" /></Field>
            <Field label="AI model"><Input value={form.ai_model} onChange={(e)=>set("ai_model", e.target.value)} placeholder="e.g. GPT-5" /></Field>
            <Field label="Vendor"><Input value={form.vendor} onChange={(e)=>set("vendor", e.target.value)} placeholder="e.g. OpenAI" /></Field>
            <Field label="Deployment status">
              <Select value={form.deployment_status} onValueChange={(v)=>set("deployment_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data sources"><Input value={form.data_sources} onChange={(e)=>set("data_sources", e.target.value)} placeholder="e.g. CRM, support tickets" /></Field>
          </div>
          <Field label="Description"><Textarea rows={4} value={form.description} onChange={(e)=>set("description", e.target.value)} /></Field>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={()=>navigate({ to: "/systems" })}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Register"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 col-span-1">
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}
