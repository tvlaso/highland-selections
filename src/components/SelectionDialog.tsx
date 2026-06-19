import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, SELECTION_STATUSES } from "@/lib/constants";

export interface EditableSelection {
  id?: string;
  category: string;
  item_name: string;
  image_url: string | null;
  product_link: string | null;
  allowance_price: number | null;
  actual_price: number | null;
  status: string;
  contractor_notes: string | null;
}

const blank = (category: string): EditableSelection => ({
  category,
  item_name: "",
  image_url: null,
  product_link: null,
  allowance_price: null,
  actual_price: null,
  status: "Pending",
  contractor_notes: null,
});

export function SelectionDialog({
  projectId,
  open,
  onOpenChange,
  existing,
  defaultCategory,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: EditableSelection;
  defaultCategory?: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EditableSelection>(blank(defaultCategory ?? CATEGORIES[0]));
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setForm(existing ? { ...existing } : blank(defaultCategory ?? CATEGORIES[0]));
  }, [open, existing, defaultCategory]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-photos").upload(path, file);
      if (error) throw error;
      setForm((f) => ({ ...f, image_url: path }));
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: projectId,
        category: form.category,
        item_name: form.item_name,
        image_url: form.image_url,
        product_link: form.product_link || null,
        allowance_price: form.allowance_price,
        actual_price: form.actual_price,
        status: form.status as (typeof SELECTION_STATUSES)[number],
        contractor_notes: form.contractor_notes || null,
      };
      if (existing?.id) {
        const { error } = await supabase.from("selections").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("selections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-project"] });
      toast.success(existing?.id ? "Selection updated" : "Selection added");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing?.id ? "Edit Selection" : "Add Selection"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SELECTION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Item name</Label>
            <Input value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Product link</Label>
            <Input
              value={form.product_link ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, product_link: e.target.value }))}
              placeholder="https://…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Allowance price</Label>
              <Input
                type="number"
                value={form.allowance_price ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, allowance_price: num(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Actual price</Label>
              <Input
                type="number"
                value={form.actual_price ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, actual_price: num(e.target.value) }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Product photo</Label>
            <div className="flex items-center gap-3">
              <SignedImage path={form.image_url} alt="preview" className="h-16 w-16 rounded-lg object-cover" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Contractor notes</Label>
            <Textarea
              value={form.contractor_notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contractor_notes: e.target.value }))}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="hero" disabled={mutation.isPending || !form.item_name} onClick={() => mutation.mutate()}>
            {existing?.id ? "Save Changes" : "Add Selection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}