import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { bathroomSettingsQuery } from "@/lib/bathroom/queries";
import { ratesSchema, RATE_LABELS, type Rates } from "@/lib/bathroom/model";
export const Route = createFileRoute("/_authenticated/bathroom/settings")({
  head: () => ({
    meta: [
      { title: "Bathroom Pricing Settings | Highland Remodeling" },
      {
        name: "description",
        content: "Edit bathroom consultation rates and installation minimums.",
      },
      { property: "og:title", content: "Bathroom Pricing Settings | Highland Remodeling" },
      { property: "og:description", content: "Admin bathroom remodeling pricing settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bathroomSettingsQuery),
  component: PricingSettings,
});
function PricingSettings() {
  const { data } = useSuspenseQuery(bathroomSettingsQuery);
  const [rates, setRates] = useState(() => ratesSchema.parse(data?.rates ?? {}));
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("bathroom_settings")
        .upsert({ id: "default", rates: ratesSchema.parse(rates) });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["bathroom-settings"] });
      toast.success("Pricing settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save rates");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Pricing Settings" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/bathroom">
            <ArrowLeft className="h-4 w-4" />
            Bathroom Consultations
          </Link>
        </Button>
        <div className="my-5 flex flex-wrap justify-between gap-3">
          <h1 className="text-2xl font-bold">Pricing Settings</h1>
          <Button onClick={save} disabled={busy}>
            <Save className="h-4 w-4" />
            {busy ? "Saving…" : "Save Rates"}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(RATE_LABELS) as (keyof Rates)[]).map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{RATE_LABELS[key]} ($)</Label>
              <Input
                id={key}
                type="number"
                min="0"
                step="0.01"
                value={rates[key]}
                onChange={(e) => setRates({ ...rates, [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
