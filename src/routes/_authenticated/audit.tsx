import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit Trail — GovernAI" }] }),
  component: AuditPage,
});

function AuditPage() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const rows = (data ?? []).filter((a) =>
    !q || [a.action, a.user_email, a.object_type, a.object_id].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader title="Audit trail" description="Every action across the workspace." />
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search className="size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions, users, objects…" className="border-0 bg-transparent focus-visible:ring-0 h-8" />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">When</th>
              <th className="text-left font-medium px-4 py-2.5">User</th>
              <th className="text-left font-medium px-4 py-2.5">Action</th>
              <th className="text-left font-medium px-4 py-2.5">Object</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No audit entries.</td></tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5">{a.user_email || "—"}</td>
                <td className="px-4 py-2.5"><code className="text-xs text-primary">{a.action}</code></td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{a.object_type}{a.object_id ? ` · ${a.object_id.slice(0, 8)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
