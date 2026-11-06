import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Proposal } from "@/components/bathroom/Proposal";
import { bathroomHistoryQuery } from "@/lib/bathroom/queries";
import { snapshotSchema, type Snapshot } from "@/lib/bathroom/model";
import { bathroomPdf } from "@/lib/bathroom/pdf";
export const Route = createFileRoute("/_authenticated/bathroom/history")({
  head: () => ({
    meta: [
      { title: "Bathroom Proposal History | Highland Remodeling" },
      {
        name: "description",
        content: "View saved bathroom proposal versions and download proposals.",
      },
      { property: "og:title", content: "Bathroom Proposal History | Highland Remodeling" },
      {
        property: "og:description",
        content: "Saved Highland Remodeling bathroom proposal versions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bathroomHistoryQuery()),
  component: HistoryPage,
});
function HistoryPage() {
  const { data } = useSuspenseQuery(bathroomHistoryQuery());
  const [preview, setPreview] = useState<{ snapshot: Snapshot; version: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function download(id: string, s: Snapshot, v: number) {
    setBusy(id);
    try {
      const pdf = await bathroomPdf(s, v);
      pdf.save(`Highland-Bathroom-${s.number}-v${v}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download PDF");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Proposal History" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/bathroom">
            <ArrowLeft className="h-4 w-4" />
            Bathroom Consultations
          </Link>
        </Button>
        <h1 className="my-5 text-2xl font-bold">Proposal History</h1>
        <div className="space-y-3">
          {data.map((v) => {
            const s = snapshotSchema.parse(v.snapshot);
            return (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div>
                  <Link
                    className="font-semibold"
                    to="/bathroom/$id"
                    params={{ id: v.consultation_id }}
                  >
                    {s.title || `HR-B${String(s.number).padStart(5, "0")}`}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Version {v.version} · {new Date(v.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Preview version ${v.version}`}
                    onClick={() => setPreview({ snapshot: s, version: v.version })}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Download version ${v.version}`}
                    disabled={busy !== null}
                    onClick={() => void download(v.id, s, v.version)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {data.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No saved proposals.</p>
          )}
        </div>
        <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
          <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
            <DialogTitle>Saved Proposal</DialogTitle>
            {preview && <Proposal snapshot={preview.snapshot} version={preview.version} />}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
