import { supabase } from "@/integrations/supabase/client";

export async function logAudit(action: string, objectType?: string, objectId?: string, details?: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("audit_log").insert({
      user_id: data.user.id,
      user_email: data.user.email ?? null,
      action,
      object_type: objectType ?? null,
      object_id: objectId ?? null,
      details: details ?? null,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
