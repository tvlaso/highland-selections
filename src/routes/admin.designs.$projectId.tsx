import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { DesignsGallery } from "@/components/DesignsGallery";

export const Route = createFileRoute("/admin/designs/$projectId")({
  head: () => ({ meta: [{ title: "Designs | Highland Remodeling" }] }),
  component: AdminDesigns,
});

function AdminDesigns() {
  const { projectId } = Route.useParams();
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (role === "customer") navigate({ to: "/dashboard" });
  }, [session, role, loading, navigate]);

  const projectQ = useQuery({
    queryKey: ["admin-project-name", projectId],
    enabled: role === "admin",
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("name").eq("id", projectId).maybeSingle();
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Contractor Admin" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Link
          to="/admin/$projectId"
          params={{ projectId }}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to project
        </Link>
        <h1 className="mb-6 text-2xl font-bold">{projectQ.data?.name ?? "Designs"}</h1>
        <DesignsGallery projectId={projectId} projectName={projectQ.data?.name ?? "Project"} isAdmin />
      </main>
    </div>
  );
}
