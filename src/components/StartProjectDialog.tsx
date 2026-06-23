import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignedImage } from "@/components/SignedImage";
import {
  PROJECT_TYPES,
  CONTACT_METHODS,
  TIMELINE_OPTIONS,
  BUDGET_RANGES,
  isValidEmail,
  isValidPhone,
} from "@/lib/constants";
import {
  createIntakePhotoUpload,
  submitProjectRequest,
} from "@/lib/intake.functions";

export function StartProjectDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: (projectId: string) => void;
}) {
  const qc = useQueryClient();
  const createUpload = useServerFn(createIntakePhotoUpload);
  const submit = useServerFn(submitProjectRequest);
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [projectType, setProjectType] = useState("");
  const [description, setDescription] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setProjectType("");
    setDescription("");
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setTimeline("");
    setBudget("");
    setContactMethod("");
    setNotes("");
    setPhotos([]);
  };

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const upload = await createUpload({ data: { ext } });
        const { error } = await supabase.storage
          .from("product-photos")
          .uploadToSignedUrl(upload.path, upload.token, file, {
            contentType: file.type || "image/jpeg",
          });
        if (error) throw error;
        setPhotos((p) => [...p, upload.path]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          projectType: projectType as never,
          description,
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          timeline: timeline || null,
          budget: budget || null,
          contactMethod: contactMethod || null,
          notes: notes || null,
          photos,
        },
      }),
    onSuccess: async (res) => {
      toast.success("Project request submitted!");
      await qc.invalidateQueries({ queryKey: ["customer-projects"] });
      setOpen(false);
      reset();
      onCreated?.(res.projectId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit"),
  });

  const valid = projectType !== "" && description.trim().length > 0;
  const emailOk = isValidEmail(email);
  const phoneOk = isValidPhone(phone);
  const addressOk = address.trim().length > 0;
  const nameOk = fullName.trim().length > 0;
  const allValid = valid && emailOk && phoneOk && addressOk && nameOk;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              Project Type <span className="text-destructive">*</span>
            </Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project type" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Job Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what you would like done, what problems you're trying to solve, and any important details about the space."
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
              {phone.length > 0 && !phoneOk && (
                <p className="text-xs text-destructive">Enter a valid phone number.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {email.length > 0 && !emailOk && (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Project Address <span className="text-destructive">*</span>
            </Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Desired Timeline</Label>
              <Select value={timeline} onValueChange={setTimeline}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Budget Range</Label>
              <Select value={budget} onValueChange={setBudget}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_RANGES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Best Contact Method</Label>
            <Select value={contactMethod} onValueChange={setContactMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_METHODS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Photos / Inspiration Images</Label>
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((p) => (
                <div key={p} className="relative">
                  <SignedImage path={p} alt="inspiration" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((arr) => arr.filter((x) => x !== p))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Add Photos"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Additional Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="hero"
            disabled={mutation.isPending || uploading || !allValid}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Submitting…" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
