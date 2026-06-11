import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Boxes, ShieldAlert, GitPullRequestArrow, AlertOctagon, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GovernAI" }] }),
  component: Dashboard,
});

function Stat({ icon: Icon, label, value, hint, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold mt-2">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={`size-9 rounded-md grid place-items-center ${accent ?? "bg-accent"}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const PIE = ["oklch(0.68 0.16 158)", "oklch(0.78 0.16 75)", "oklch(0.62 0.22 22)"];

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [systems, incidents, approvals, controls] = await Promise.all([
        supabase.from("ai_systems").select("id,risk_level,department,deployment_status"),
        supabase.from("incidents").select("id,status"),
        supabase.from("approvals").select("id,status"),
        supabase.from("compliance_controls").select("completed"),
      ]);
      return {
        systems: systems.data ?? [],
        incidents: incidents.data ?? [],
        approvals: approvals.data ?? [],
        controls: controls.data ?? [],
      };
    },
  });

  const systems = data?.systems ?? [];
  const incidents = data?.incidents ?? [];
  const approvals = data?.approvals ?? [];
  const controls = data?.controls ?? [];

  const high = systems.filter((s) => s.risk_level === "high").length;
  const pending = approvals.filter((a) => a.status === "pending").length;
  const openInc = incidents.filter((i) => i.status !== "resolved").length;
  const complianceScore = controls.length ? Math.round((controls.filter((c) => c.completed).length / controls.length) * 100) : 0;

  const byRisk = ["low", "medium", "high"].map((r) => ({ name: r, value: systems.filter((s) => s.risk_level === r).length }));
  const byDept = Object.entries(systems.reduce<Record<string, number>>((acc, s) => {
    const k = s.department || "Unassigned"; acc[k] = (acc[k] ?? 0) + 1; return acc;
  }, {})).map(([name, count]) => ({ name, count }));
  const byApproval = ["pending", "approved", "rejected", "changes_requested"].map((s) => ({ name: s.replace("_"," "), value: approvals.filter((a) => a.status === s).length }));

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader title="Dashboard" description="A live view of your AI governance posture." />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={Boxes} label="AI systems" value={systems.length} hint={`${systems.filter((s)=>s.deployment_status==="production").length} in production`} />
        <Stat icon={ShieldAlert} label="High-risk" value={high} accent="bg-destructive/15 text-destructive" />
        <Stat icon={GitPullRequestArrow} label="Pending reviews" value={pending} accent="bg-warning/15 text-warning" />
        <Stat icon={AlertOctagon} label="Open incidents" value={openInc} accent="bg-destructive/15 text-destructive" />
        <Stat icon={TrendingUp} label="Compliance" value={`${complianceScore}%`} hint={`${controls.filter(c=>c.completed).length}/${controls.length} controls`} accent="bg-success/15 text-success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-medium">AI systems by risk</h3>
          <div className="h-56 mt-2">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byRisk} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {byRisk.map((_, i) => <Cell key={i} fill={PIE[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.20 0.014 264)", border: "1px solid oklch(0.26 0.013 264)", borderRadius: 6 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs">
            {byRisk.map((r, i) => (
              <div key={r.name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm" style={{ background: PIE[i] }} />
                <span className="capitalize">{r.name}</span> <span className="text-muted-foreground">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-medium">AI systems by department</h3>
          <div className="h-56 mt-2">
            <ResponsiveContainer>
              <BarChart data={byDept}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.013 264)" />
                <XAxis dataKey="name" stroke="oklch(0.65 0.018 264)" fontSize={11} />
                <YAxis stroke="oklch(0.65 0.018 264)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.014 264)", border: "1px solid oklch(0.26 0.013 264)", borderRadius: 6 }} cursor={{ fill: "oklch(0.24 0.015 264)" }} />
                <Bar dataKey="count" fill="oklch(0.68 0.18 268)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <h3 className="text-sm font-medium">Approval status</h3>
          <div className="h-56 mt-2">
            <ResponsiveContainer>
              <BarChart data={byApproval} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.013 264)" />
                <XAxis type="number" stroke="oklch(0.65 0.018 264)" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="oklch(0.65 0.018 264)" fontSize={11} width={120} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.014 264)", border: "1px solid oklch(0.26 0.013 264)", borderRadius: 6 }} cursor={{ fill: "oklch(0.24 0.015 264)" }} />
                <Bar dataKey="value" fill="oklch(0.68 0.16 158)" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
