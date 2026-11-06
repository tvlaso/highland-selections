import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export const bathroomListQuery = queryOptions({
  queryKey: ["bathroom-projects"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("bathroom_consultations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
export const bathroomSettingsQuery = queryOptions({
  queryKey: ["bathroom-settings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("bathroom_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});
export const bathroomProjectQuery = (id: string) =>
  queryOptions({
    queryKey: ["bathroom-project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bathroom_consultations")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
export const bathroomHistoryQuery = (id?: string) =>
  queryOptions({
    queryKey: ["bathroom-history", id ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("bathroom_proposal_versions")
        .select("*,bathroom_consultations(project_number,title)")
        .order("created_at", { ascending: false });
      if (id) q = q.eq("consultation_id", id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
