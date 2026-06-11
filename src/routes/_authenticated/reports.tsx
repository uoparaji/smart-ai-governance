import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — GovernAI" }] }),
  component: ReportsPage,
});

type Template = "risk_assessment" | "system_profile" | "compliance_summary";

function ReportsPage() {
  const [template, setTemplate] = useState<Template>("risk_assessment");
  const [systemId, setSystemId] = useState<string>("");

  const { data: systems } = useQuery({
    queryKey: ["ai_systems_full"],
    queryFn: async () => (await supabase.from("ai_systems").select("*")).data ?? [],
  });
  const { data: risk } = useQuery({
    queryKey: ["risk-for-report", systemId],
    queryFn: async () => systemId ? (await supabase.from("risk_assessments").select("*").eq("ai_system_id", systemId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data : null,
    enabled: !!systemId,
  });
  const { data: approvals } = useQuery({
    queryKey: ["approvals-for-report", systemId],
    queryFn: async () => systemId ? (await supabase.from("approvals").select("*").eq("ai_system_id", systemId)).data ?? [] : [],
    enabled: !!systemId,
  });
  const { data: controls } = useQuery({
    queryKey: ["controls-for-report"],
    queryFn: async () => (await supabase.from("compliance_controls").select("*").order("framework").order("control_code")).data ?? [],
  });

  const system = (systems ?? []).find((s) => s.id === systemId);
  const needsSystem = template !== "compliance_summary";

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title="Reports"
        description="Generate governance documentation as PDF (use your browser's Save as PDF)."
        actions={<Button onClick={() => window.print()} disabled={needsSystem && !system}><Printer className="size-4 mr-1.5" />Print / Save PDF</Button>}
      />
      <Card className="p-5 no-print mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Template</p>
            <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="risk_assessment">AI Risk Assessment Report</SelectItem>
                <SelectItem value="system_profile">AI System Profile</SelectItem>
                <SelectItem value="compliance_summary">Compliance Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {needsSystem && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">AI system</p>
              <Select value={systemId} onValueChange={setSystemId}>
                <SelectTrigger><SelectValue placeholder="Select system" /></SelectTrigger>
                <SelectContent>
                  {(systems ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      <div className="print-area bg-white text-black rounded-md p-10 border border-border">
        <header className="flex items-center justify-between border-b border-gray-300 pb-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">GovernAI · Governance Report</p>
            <h2 className="text-2xl font-semibold mt-1">
              {template === "risk_assessment" && "AI Risk Assessment Report"}
              {template === "system_profile" && "AI System Profile"}
              {template === "compliance_summary" && "Compliance Summary"}
            </h2>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Generated</p>
            <p>{new Date().toLocaleString()}</p>
          </div>
        </header>

        {template === "compliance_summary" ? (
          <ComplianceReport controls={controls ?? []} />
        ) : !system ? (
          <p className="text-gray-500 text-sm">Select a system to render the report.</p>
        ) : template === "risk_assessment" ? (
          <RiskReport system={system} risk={risk} />
        ) : (
          <SystemProfile system={system} approvals={approvals ?? []} risk={risk} />
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="col-span-2 text-sm">{value || "—"}</p>
    </div>
  );
}

function SystemProfile({ system, approvals, risk }: any) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold mb-2">System overview</h3>
        <Row label="Name" value={system.name} />
        <Row label="Description" value={system.description} />
        <Row label="Department" value={system.department} />
        <Row label="Business owner" value={system.business_owner} />
        <Row label="Use case" value={system.use_case_category} />
        <Row label="Model" value={system.ai_model} />
        <Row label="Vendor" value={system.vendor} />
        <Row label="Data sources" value={system.data_sources} />
        <Row label="Deployment status" value={system.deployment_status} />
        <Row label="Risk level" value={system.risk_level} />
      </section>
      <section>
        <h3 className="font-semibold mb-2">Approval workflow</h3>
        {(approvals ?? []).length === 0 ? <p className="text-sm text-gray-500">No reviews recorded.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 uppercase tracking-wider"><th className="py-1">Stage</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {approvals.map((a: any) => (
                <tr key={a.id} className="border-t border-gray-200"><td className="py-1.5 capitalize">{a.stage}</td><td className="capitalize">{a.status.replace("_"," ")}</td><td className="text-gray-600">{a.notes || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {risk && (
        <section>
          <h3 className="font-semibold mb-2">Latest risk assessment</h3>
          <Row label="Score" value={`${risk.risk_score}/7`} />
          <Row label="Level" value={risk.risk_level} />
        </section>
      )}
    </div>
  );
}

function RiskReport({ system, risk }: any) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold mb-2">System</h3>
        <Row label="Name" value={system.name} />
        <Row label="Department" value={system.department} />
        <Row label="Owner" value={system.business_owner} />
      </section>
      {!risk ? <p className="text-sm text-gray-500">No risk assessment recorded yet.</p> : (
        <section>
          <h3 className="font-semibold mb-2">Assessment</h3>
          <Row label="Risk score" value={`${risk.risk_score}/7`} />
          <Row label="Risk level" value={risk.risk_level} />
          <Row label="Decisions about people" value={risk.decisions_about_people ? "Yes" : "No"} />
          <Row label="Processes personal data" value={risk.processes_personal_data ? "Yes" : "No"} />
          <Row label="Customer-facing output" value={risk.customer_facing ? "Yes" : "No"} />
          <Row label="Potential financial harm" value={risk.financial_harm ? "Yes" : "No"} />
          <Row label="Potential legal harm" value={risk.legal_harm ? "Yes" : "No"} />
          <Row label="Externally hosted" value={risk.externally_hosted ? "Yes" : "No"} />
          <Row label="Sensitive data" value={risk.sensitive_data ? "Yes" : "No"} />
          <Row label="Assessed at" value={new Date(risk.created_at).toLocaleString()} />
        </section>
      )}
    </div>
  );
}

function ComplianceReport({ controls }: { controls: any[] }) {
  const FW: Record<string, string> = {
    nist_ai_rmf: "NIST AI Risk Management Framework",
    iso_42001: "ISO/IEC 42001",
    eu_ai_act: "EU AI Act",
  };
  const grouped = controls.reduce<Record<string, any[]>>((acc, c) => { (acc[c.framework] ??= []).push(c); return acc; }, {});
  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([fw, items]) => {
        const done = items.filter((c) => c.completed).length;
        return (
          <section key={fw}>
            <div className="flex justify-between items-baseline mb-2">
              <h3 className="font-semibold">{FW[fw] ?? fw}</h3>
              <p className="text-sm text-gray-500">{done}/{items.length} controls ({Math.round((done/items.length)*100)}%)</p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 uppercase tracking-wider"><th className="py-1 w-24">Control</th><th>Name</th><th className="w-24">Status</th></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t border-gray-200">
                    <td className="py-1.5 font-mono text-xs">{c.control_code}</td>
                    <td>{c.control_name}</td>
                    <td className={c.completed ? "text-green-700" : "text-gray-400"}>{c.completed ? "✓ Met" : "Not met"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
