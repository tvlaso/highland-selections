import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignedImage } from "@/components/SignedImage";
import { supabase } from "@/integrations/supabase/client";
import { bathroomSettingsQuery } from "@/lib/bathroom/queries";
import { LAYOUTS } from "@/lib/bathroom/model";
export const Route = createFileRoute("/_authenticated/bathroom/templates")({
  head: () => ({
    meta: [
      { title: "Bathroom Master Design Templates | Highland Remodeling" },
      {
        name: "description",
        content: "Upload bathroom master reference layouts for design consultations.",
      },
      { property: "og:title", content: "Bathroom Master Design Templates | Highland Remodeling" },
      {
        property: "og:description",
        content: "Double vanity, three-wall shower and corner shower reference images.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bathroomSettingsQuery),
  component: Templates,
});
function Templates() {
  const { data } = useSuspenseQuery(bathroomSettingsQuery);
  const templates = z.record(z.string()).parse(data?.templates ?? {});
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();
  async function upload(layout: string, file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    ) {
      toast.error("Choose a JPG, PNG or WebP image under 20 MB.");
      return;
    }
    setBusy(layout);
    try {
      const path = `templates/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const { error } = await supabase.storage
        .from("bathroom-designs")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: latest, error: readError } = await supabase
        .from("bathroom_settings")
        .select("templates")
        .eq("id", "default")
        .maybeSingle();
      if (readError) throw readError;
      const { error: saveError } = await supabase
        .from("bathroom_settings")
        .upsert({
          id: "default",
          templates: { ...z.record(z.string()).parse(latest?.templates ?? {}), [layout]: path },
        });
      if (saveError) throw saveError;
      await qc.invalidateQueries({ queryKey: ["bathroom-settings"] });
      toast.success("Reference image saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save reference");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Master Design Templates" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/bathroom">
            <ArrowLeft className="h-4 w-4" />
            Bathroom Consultations
          </Link>
        </Button>
        <h1 className="my-5 text-2xl font-bold">Master Design Templates</h1>
        <div className="grid gap-5 md:grid-cols-3">
          {LAYOUTS.map((layout) => (
            <section key={layout} className="space-y-3">
              <h2 className="font-semibold">{layout}</h2>
              <SignedImage
                bucket="bathroom-designs"
                path={templates[layout]}
                alt={`${layout} master reference`}
                className="aspect-[3/2] w-full rounded-lg object-contain"
              />
              <label className="flex items-center gap-2 text-sm" htmlFor={layout}>
                <Upload className="h-4 w-4" />
                {busy === layout
                  ? "Uploading…"
                  : templates[layout]
                    ? "Replace reference"
                    : "Upload reference"}
              </label>
              <Input
                id={layout}
                aria-label={`${layout} reference image`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy !== null}
                onChange={(e) => void upload(layout, e.target.files?.[0])}
              />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
