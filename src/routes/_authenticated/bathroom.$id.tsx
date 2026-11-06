import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RefreshCw,
  Eye,
  Download,
  Save,
  Pencil,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Proposal } from "@/components/bathroom/Proposal";
import {
  bathroomProjectQuery,
  bathroomSettingsQuery,
  bathroomHistoryQuery,
} from "@/lib/bathroom/queries";
import {
  AREAS,
  FIELDS,
  LAYOUTS,
  selectionsSchema,
  detailsSchema,
  ratesSchema,
  imagesSchema,
  calculate,
  money,
  type Selections,
  type Details,
  type Snapshot,
  type Field,
} from "@/lib/bathroom/model";
import { generateBathroomImage } from "@/lib/bathroom/images.functions";
import { bathroomPdf } from "@/lib/bathroom/pdf";
export const Route = createFileRoute("/_authenticated/bathroom/$id")({
  head: () => ({
    meta: [
      { title: "Bathroom Design & Proposal | Highland Remodeling" },
      {
        name: "description",
        content:
          "Bathroom scope, reference-based AI designs, grouped pricing and branded proposal.",
      },
      { property: "og:title", content: "Bathroom Design & Proposal | Highland Remodeling" },
      {
        property: "og:description",
        content: "Highland Remodeling four-step bathroom consultation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(bathroomProjectQuery(params.id)),
      context.queryClient.ensureQueryData(bathroomSettingsQuery),
      context.queryClient.ensureQueryData(bathroomHistoryQuery(params.id)),
    ]),
  component: BathroomEditor,
});
const STEPS = ["Scope & Measurements", "AI Design", "Pricing", "Proposal"];
function BathroomEditor() {
  const { id } = Route.useParams();
  return <Editor key={id} id={id} />;
}
function Editor({ id }: { id: string }) {
  const { data: project } = useSuspenseQuery(bathroomProjectQuery(id));
  const { data: settings } = useSuspenseQuery(bathroomSettingsQuery);
  const { data: history } = useSuspenseQuery(bathroomHistoryQuery(id));
  const [selections, setSelections] = useState(() => selectionsSchema.parse(project.selections));
  const [details, setDetails] = useState(() => detailsSchema.parse(project.proposal_details));
  const [title, setTitle] = useState(project.title);
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState("Saved");
  const [images, setImages] = useState(() => imagesSchema.parse(project.approved_images));
  const [layout, setLayout] = useState<(typeof LAYOUTS)[number]>("Three-wall shower");
  const [generating, setGenerating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState(project.status);
  const qc = useQueryClient();
  const generate = useServerFn(generateBathroomImage);
  const rates = ratesSchema.parse(settings?.rates ?? {});
  const pricing = calculate(selections, rates, details);
  const latest = useRef({ title, selections, details });
  latest.current = { title, selections, details };
  const persisted = useRef(JSON.stringify(latest.current));
  const queue = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function save() {
    clearTimeout(timer.current);
    const value = latest.current;
    const fingerprint = JSON.stringify(value);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (persisted.current === fingerprint) return;
        setSaveState("Saving…");
        const { error } = await supabase
          .from("bathroom_consultations")
          .update({
            title: value.title,
            selections: value.selections,
            proposal_details: value.details,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) {
          setSaveState("Save failed");
          throw new Error("Your latest changes could not be saved. Please retry.");
        }
        persisted.current = fingerprint;
        setSaveState("Saved");
        void qc.invalidateQueries({ queryKey: ["bathroom-projects"] });
      });
    return queue.current;
  }
  useEffect(() => {
    if (JSON.stringify(latest.current) === persisted.current) return;
    setSaveState("Unsaved changes");
    timer.current = setTimeout(() => void save().catch((e) => toast.error(e.message)), 700);
    return () => clearTimeout(timer.current);
  }, [title, selections, details]);
  useEffect(
    () => () => {
      void save().catch(() => {});
    },
    [],
  );
  const update = (key: string, value: string | number | boolean) =>
    setSelections((s) => ({ ...s, values: { ...s.values, [key]: value } }));
  function field(f: Field) {
    const value = selections.values[f.key];
    return (
      <div key={f.key} className="space-y-2">
        {f.type === "boolean" ? (
          <label className="flex items-center gap-2 py-3">
            <Checkbox checked={value === true} onCheckedChange={(v) => update(f.key, v === true)} />
            {f.label}
          </label>
        ) : (
          <>
            <Label htmlFor={f.key}>{f.label}</Label>
            {f.type === "select" ? (
              <Select
                value={typeof value === "string" ? value : undefined}
                onValueChange={(v) => update(f.key, v)}
              >
                <SelectTrigger id={f.key}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {f.options?.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={f.key}
                type={f.type === "number" ? "number" : "text"}
                min={f.type === "number" ? 0 : undefined}
                step={f.type === "number" ? "any" : undefined}
                value={typeof value === "string" || typeof value === "number" ? value : ""}
                onChange={(e) =>
                  update(
                    f.key,
                    f.type === "number" ? Math.max(0, Number(e.target.value)) : e.target.value,
                  )
                }
              />
            )}
          </>
        )}
      </div>
    );
  }
  async function generateImage(area: "Shower" | "Vanity") {
    setGenerating(area);
    try {
      await save();
      await generate({ data: { id, area, layout: area === "Vanity" ? "Double vanity" : layout } });
      const { data, error } = await supabase
        .from("bathroom_consultations")
        .select("approved_images")
        .eq("id", id)
        .single();
      if (error) throw error;
      setImages(imagesSchema.parse(data.approved_images));
      toast.success(`${area} design saved for review`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate image");
    } finally {
      setGenerating(null);
    }
  }
  async function approve(area: string) {
    try {
      const { data, error: readError } = await supabase
        .from("bathroom_consultations")
        .select("approved_images")
        .eq("id", id)
        .single();
      if (readError) throw readError;
      const next = imagesSchema.parse(data.approved_images);
      if (!next[area]) return;
      next[area] = { ...next[area], approved: !next[area].approved };
      const { error } = await supabase
        .from("bathroom_consultations")
        .update({ approved_images: next, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setImages(next);
    } catch {
      toast.error("Could not update image approval");
    }
  }
  const snapshot: Snapshot = {
    number: project.project_number,
    title,
    selections,
    details,
    rates,
    images,
  };
  async function proposal(download: boolean) {
    if (!selections.areas.length) {
      toast.error("Select at least one remodeling area.");
      return;
    }
    setBusy(true);
    try {
      await save();
      const { data: version, error } = await supabase.rpc("save_bathroom_proposal", {
        p_id: id,
        p_snapshot: snapshot,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["bathroom-history"] });
      const pdf = download ? await bathroomPdf(snapshot, version) : null;
      if (pdf) pdf.save(`Highland-Bathroom-${project.project_number}-v${version}.pdf`);
      toast.success(`Proposal version ${version} saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save proposal");
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(value: string) {
    try {
      await save();
      const { error } = await supabase
        .from("bathroom_consultations")
        .update({ status: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setStatus(value);
      await qc.invalidateQueries({ queryKey: ["bathroom-projects"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Bathroom Design & Proposal" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/bathroom">
              <ArrowLeft className="h-4 w-4" />
              Bathroom Consultations
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {saveState}
            </span>
            {saveState === "Save failed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void save().catch((e) => toast.error(e.message))}
              >
                Retry Save
              </Button>
            )}
            <Select value={status} onValueChange={(v) => void changeStatus(v)}>
              <SelectTrigger aria-label="Consultation status" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Saved">Saved</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <h1 className="mb-3 mt-5 text-2xl font-bold">
          Bathroom HR-B{String(project.project_number).padStart(5, "0")}
        </h1>
        <Label htmlFor="projectTitle">Project title (optional)</Label>
        <Input
          id="projectTitle"
          className="mb-6 mt-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            {STEPS.map((label, i) => (
              <TabsTrigger className="whitespace-normal py-3" key={label} value={String(i)}>
                {i + 1}. {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="mt-6">
          {step === 0 && (
            <>
              <h2 className="mb-4 text-lg font-semibold">Remodeling Scope</h2>
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {AREAS.map((area) => (
                  <label
                    key={area}
                    className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <Checkbox
                      checked={selections.areas.includes(area)}
                      onCheckedChange={(checked) =>
                        setSelections((s) => ({
                          ...s,
                          areas: checked ? [...s.areas, area] : s.areas.filter((a) => a !== area),
                        }))
                      }
                    />
                    {area}
                  </label>
                ))}
              </div>
              <div className="space-y-8">
                {selections.areas.map((area) => (
                  <section key={area} className="border-t border-border pt-5">
                    <h3 className="mb-4 text-lg font-semibold">{area}</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {FIELDS[area].map(field)}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div className="mb-5 max-w-sm space-y-2">
                <Label>Shower reference layout</Label>
                <Select value={layout} onValueChange={(v) => setLayout(v as typeof layout)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Three-wall shower">Three-wall shower</SelectItem>
                    <SelectItem value="Corner shower">Corner shower</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {(["Shower", "Vanity"] as const)
                  .filter((a) => selections.areas.includes(a))
                  .map((area) => (
                    <section className="space-y-3" key={area}>
                      <h2 className="text-lg font-semibold">{area} Design</h2>
                      <SignedImage
                        bucket="bathroom-designs"
                        path={images[area]?.path}
                        alt={`${area} design preview`}
                        className="aspect-[3/2] w-full rounded-lg object-contain"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={generating !== null}
                          onClick={() => void generateImage(area)}
                        >
                          <RefreshCw className="h-4 w-4" />
                          {generating === area
                            ? "Generating…"
                            : images[area]
                              ? "Regenerate"
                              : "Generate Preview"}
                        </Button>
                        {images[area] && (
                          <Button
                            variant={images[area].approved ? "success" : "outline"}
                            disabled={generating !== null}
                            onClick={() => void approve(area)}
                          >
                            <Check className="h-4 w-4" />
                            {images[area].approved ? "Approved" : "Approve Image"}
                          </Button>
                        )}
                      </div>
                    </section>
                  ))}
              </div>
              {!selections.areas.some((a) => a === "Shower" || a === "Vanity") && (
                <p className="py-10 text-center text-muted-foreground">
                  No shower or vanity in this scope.
                </p>
              )}
              <Button asChild variant="ghost" size="sm" className="mt-5">
                <Link to="/bathroom/templates">Master Design Templates</Link>
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="mb-4 text-lg font-semibold">Internal Calculations</h2>
              <div className="space-y-2">
                {pricing.lines.map((line, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-4 border-b border-border py-2 text-sm"
                  >
                    <div>
                      <span className="block text-xs text-muted-foreground">{line.group}</span>
                      {line.label}
                    </div>
                    <span className="shrink-0">{money(line.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  ["materialAllowance", "Provisional material allowance ($)"],
                  ["adjustment", "Manual adjustment ($)"],
                  ["taxRate", "Applicable tax (%)"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      type="number"
                      step="0.01"
                      min={key === "adjustment" ? undefined : 0}
                      max={key === "taxRate" ? 100 : undefined}
                      value={details[key as "taxRate"]}
                      onChange={(e) =>
                        setDetails((d) => ({
                          ...d,
                          [key]:
                            key === "taxRate"
                              ? Math.min(100, Math.max(0, Number(e.target.value)))
                              : key === "materialAllowance"
                                ? Math.max(0, Number(e.target.value))
                                : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="adjustmentReason">Adjustment reason</Label>
                  <Input
                    id="adjustmentReason"
                    value={details.adjustmentReason}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, adjustmentReason: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="customWork">Custom work requiring separate pricing</Label>
                  <Textarea
                    id="customWork"
                    value={details.customWork}
                    onChange={(e) => setDetails((d) => ({ ...d, customWork: e.target.value }))}
                  />
                </div>
              </div>
              {pricing.flags.length > 0 && (
                <ul className="mt-5 space-y-2 border-l-4 border-warning pl-4 text-sm">
                  {pricing.flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              )}
              <dl className="mt-6 space-y-2 border-t border-border pt-4">
                {[
                  ["Subtotal", pricing.subtotal],
                  ["Applicable tax", pricing.tax],
                  ["Total", pricing.total],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between font-semibold">
                    <dt>{label}</dt>
                    <dd>{money(Number(value))}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {step === 3 && (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                {[
                  ["overview", "Project overview"],
                  ["duration", "Estimated duration"],
                  ["allowances", "Allowances"],
                  ["exclusions", "Exclusions"],
                  ["notes", "Proposal notes"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Textarea
                      id={key}
                      value={details[key as "overview"]}
                      onChange={(e) => setDetails((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mb-6 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPreview(true)}>
                  <Eye className="h-4 w-4" />
                  Preview Proposal
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("overview")?.focus()}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Proposal
                </Button>
                <Button disabled={busy} onClick={() => void proposal(true)}>
                  <Download className="h-4 w-4" />
                  {busy ? "Preparing…" : "Download PDF"}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void proposal(false)}>
                  <Save className="h-4 w-4" />
                  Save Version
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/bathroom/history">
                    <History className="h-4 w-4" />
                    History ({history.length})
                  </Link>
                </Button>
              </div>
              <Proposal snapshot={snapshot} />
            </>
          )}
        </div>
        <div className="mt-8 flex justify-between border-t border-border pt-5">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {step < 3 && (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Dialog open={preview} onOpenChange={setPreview}>
          <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
            <DialogTitle>Proposal Preview</DialogTitle>
            <Proposal snapshot={snapshot} />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
