import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userData.user.id),
      ]);
      return {
        user: userData.user,
        profile,
        roles: (roles ?? []).map((r) => r.role),
      };
    },
  });
}

export function hasRole(roles: string[] | undefined, ...needed: string[]) {
  if (!roles) return false;
  return roles.some((r) => needed.includes(r));
}
