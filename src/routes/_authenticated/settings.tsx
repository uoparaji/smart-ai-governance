import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCurrentUser, hasRole } from "@/lib/use-current-user";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — GovernAI" }] }),
  component: SettingsPage,
});

const ROLES = ["admin", "ai_owner", "reviewer", "auditor"] as const;

function SettingsPage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const isAdmin = hasRole(me?.roles, "admin");

  const { data: users } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id) }));
    },
  });

  async function addRole(userId: string, role: string) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) { toast.error(error.message); return; }
    await logAudit("role.granted", "user", userId, { role });
    qc.invalidateQueries({ queryKey: ["users-with-roles"] });
  }
  async function removeRole(id: string, userId: string, role: string) {
    await supabase.from("user_roles").delete().eq("id", id);
    await logAudit("role.revoked", "user", userId, { role });
    qc.invalidateQueries({ queryKey: ["users-with-roles"] });
  }

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title="Settings" description="Manage workspace members and their roles." />
      {!isAdmin && <Card className="p-4 mb-4 text-sm text-muted-foreground">Only admins can change roles.</Card>}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">User</th>
              <th className="text-left font-medium px-4 py-2.5">Roles</th>
              {isAdmin && <th className="text-left font-medium px-4 py-2.5">Add role</th>}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: any) => {
              const heldRoles = u.roles.map((r: any) => r.role);
              const addable = ROLES.filter((r) => !heldRoles.includes(r));
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {u.roles.map((r: any) => (
                        <span key={r.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-accent px-2 py-0.5 text-xs">
                          {r.role}
                          {isAdmin && (
                            <button onClick={() => removeRole(r.id, u.id, r.role)} className="hover:text-destructive">
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {addable.length > 0 ? (
                        <Select onValueChange={(v) => addRole(u.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Grant role…" /></SelectTrigger>
                          <SelectContent>
                            {addable.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : <span className="text-xs text-muted-foreground">All assigned</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
