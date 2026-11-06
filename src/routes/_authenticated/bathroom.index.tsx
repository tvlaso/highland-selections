import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ArrowLeft, Settings, Image, History, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bathroomListQuery } from "@/lib/bathroom/queries";
import { DEFAULT_SELECTIONS, detailsSchema } from "@/lib/bathroom/model";
export const Route = createFileRoute("/_authenticated/bathroom/")({
  head: () => ({
    meta: [
      { title: "Bathroom Consultations | Highland Remodeling" },
      {
        name: "description",
        content: "Admin bathroom measurements, design previews, pricing and proposals.",
      },
      { property: "og:title", content: "Bathroom Consultations | Highland Remodeling" },
      {
        property: "og:description",
        content: "Highland Remodeling bathroom consultation projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bathroomListQuery),
  component: BathroomHome,
});
function BathroomHome() {
  const { data } = useSuspenseQuery(bathroomListQuery);
  const [tab, setTab] = useState("Saved");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  async function create() {
    setBusy(true);
    try {
      const { data: p, error } = await supabase
        .from("bathroom_consultations")
        .insert({ selections: DEFAULT_SELECTIONS, proposal_details: detailsSchema.parse({}) })
        .select("id")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["bathroom-projects"] });
      await nav({ to: "/bathroom/$id", params: { id: p.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create project");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Bathroom Consultations" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">
            <ArrowLeft className="h-4 w-4" />
            Jobs
          </Link>
        </Button>
        <div className="my-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Bathroom Consultations</h1>
          <Button variant="hero" disabled={busy} onClick={create}>
            <Plus className="h-4 w-4" />
            {busy ? "Creating…" : "New Bathroom Design"}
          </Button>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/bathroom/history">
              <History className="h-4 w-4" />
              Proposal History
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/bathroom/settings">
              <Settings className="h-4 w-4" />
              Pricing Settings
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/bathroom/templates">
              <Image className="h-4 w-4" />
              Master Design Templates
            </Link>
          </Button>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="max-w-full">
            <TabsTrigger value="Saved">
              Saved Projects ({data.filter((p) => p.status === "Saved").length})
            </TabsTrigger>
            <TabsTrigger value="Completed">
              Completed Projects ({data.filter((p) => p.status === "Completed").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-5 space-y-3">
          {data
            .filter((p) => p.status === tab)
            .map((p) => (
              <Link
                key={p.id}
                to="/bathroom/$id"
                params={{ id: p.id }}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <h2 className="break-words font-semibold">
                    {p.title || `Bathroom HR-B${String(p.project_number).padStart(5, "0")}`}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    HR-B{String(p.project_number).padStart(5, "0")} ·{" "}
                    {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0" />
              </Link>
            ))}
          {!data.some((p) => p.status === tab) && (
            <p className="py-12 text-center text-muted-foreground">
              No {tab.toLowerCase()} bathroom projects.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
