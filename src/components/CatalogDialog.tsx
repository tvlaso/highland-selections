import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { CATEGORIES } from "@/lib/constants";
import { createProductPhotoUpload } from "@/lib/admin.functions";

export interface EditableCatalogItem {
  id?: string;
  brand: string | null;
  product_name: string;
  category: string;
  vendor: string | null;
  price: number | null;
  image_url: string | null;
  product_url: string | null;
  sku: string | null;
  finish: string | null;
  description: string | null;
  active: boolean;
}

const blank = (): EditableCatalogItem => ({
  brand: null,
  product_name: "",
  category: CATEGORIES[0],
  vendor: null,
  price: null,
  image_url: null,
  product_url: null,
  sku: null,
  finish: null,
  description: null,
  active: true,
});

export function CatalogDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: EditableCatalogItem;
}) {
  const qc = useQueryClient();
  const createUpload = useServerFn(createProductPhotoUpload);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EditableCatalogItem>(blank());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setForm(existing ? { ...existing } : blank());
  }, [open, existing]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `catalog/${crypto.randomUUID()}.${ext}`;
      const upload = await createUpload({ data: { path } });
      const { error } = await supabase.storage.from("product-photos").uploadToSignedUrl(path, upload.token, file, {
        contentType: file.type || "image/jpeg",
      });
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
        brand: form.brand || null,
        product_name: form.product_name,
        category: form.category,
        vendor: form.vendor || null,
        price: form.price,
        image_url: form.image_url,
        product_url: form.product_url || null,
        sku: form.sku || null,
        finish: form.finish || null,
        description: form.description || null,
        active: form.active,
      };
      if (existing?.id) {
        const { error } = await supabase.from("master_catalog").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("master_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(existing?.id ? "Product updated" : "Product added to catalog");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing?.id ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Input value={form.brand ?? ""} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Product name</Label>
            <Input value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Input value={form.vendor ?? ""} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
          </div>
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
              <Label>Price</Label>
              <Input
                type="number"
                value={form.price ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, price: num(e.target.value) }))}
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
            <Label>Manufacturer PDF</Label>
            <Input
              value={form.product_url ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, product_url: e.target.value }))}
              placeholder="https://… (link to manufacturer spec sheet / PDF)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input value={form.sku ?? ""} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Finish</Label>
              <Input value={form.finish ?? ""} onChange={(e) => setForm((f) => ({ ...f, finish: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description / Notes</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Inactive products can't be added to projects.</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="hero" disabled={mutation.isPending || !form.product_name} onClick={() => mutation.mutate()}>
            {existing?.id ? "Save Changes" : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}