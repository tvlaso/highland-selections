import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/bathroom")({
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
      _role: "admin",
    });
    if (error || !data) throw redirect({ to: "/dashboard" });
  },
  component: Outlet,
});
