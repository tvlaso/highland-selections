import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
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
import { CATEGORIES } from "@/lib/constants";
import {
  extractProductFromUrl,
  type ImportPreview,
} from "@/lib/catalog-import.functions";

interface EditableImport {
  brand: string;
  product_name: string;
  vendor: string;
  category: string;
  price: string;
  sku: string;
  finish: string;
  description: string;
}

function toEditable(p: ImportPreview): EditableImport {
  return {
    brand: p.product.brand ?? "",
    product_name: p.product.product_name ?? "",
    vendor: p.product.vendor ?? "",
    category:
      p.product.category && (CATEGORIES as readonly string[]).includes(p.product.category)
        ? p.product.category
        : CATEGORIES[0],
    price: p.product.price === null ? "" : String(p.product.price),
    sku: p.product.sku ?? "",
    finish: p.product.finish ?? "",
    description: p.product.description ?? "",
  };
}

export function ImportFromUrlDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const extract = useServerFn(extractProductFromUrl);
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [form, setForm] = useState<EditableImport | null>(null);

  const reset = () => {
    setUrl("");
    setPreview(null);
    setForm(null);
    setExtracting(false);
  };

  const handleExtract = async () => {
    if (!url.trim()) return;
    setExtracting(true);
    setPreview(null);
    setForm(null);
    try {
      const result = await extract({ data: { url: url.trim() } });
      setPreview(result);
      setForm(toEditable(result));
      if (result.warning) toast.warning(result.warning);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setExtracting(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!preview || !form) return;
      const images = preview.imagePath ? [preview.imagePath] : [];
      const { error } = await supabase.from("master_catalog").insert({
        brand: form.brand || null,
        product_name: form.product_name,
        category: form.category,
        vendor: form.vendor || null,
        price: form.price === "" ? null : Number(form.price),
        image_url: preview.imagePath,
        images,
        product_link: preview.productUrl,
        sku: form.sku || null,
        finish: form.finish || null,
        description: form.description || null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Product added to catalog");
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const set = (key: keyof EditableImport) => (value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from URL</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Product URL</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://supplier.com/product/…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleExtract();
                  }
                }}
              />
              <Button
                variant="hero"
                disabled={extracting || !url.trim()}
                onClick={handleExtract}
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {extracting ? "Reading…" : "Extract"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a supplier product link. We'll read the page and fill in the details for you to review.
            </p>
          </div>

          {preview && form && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                {preview.imagePath ? (
                  <SignedImage
                    path={preview.imagePath}
                    alt="Product photo"
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : preview.imageSourceUrl ? (
                  <img
                    src={preview.imageSourceUrl}
                    alt="Product photo"
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    No photo
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {preview.imagePath
                    ? "Product photo saved to your library."
                    : "No photo was saved — you can add one after saving the product."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => set("brand")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Product name</Label>
                <Input
                  value={form.product_name}
                  onChange={(e) => set("product_name")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Input value={form.vendor} onChange={(e) => set("vendor")(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => set("category")(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => set("price")(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={(e) => set("sku")(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Finish</Label>
                  <Input value={form.finish} onChange={(e) => set("finish")(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description / Notes</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        {preview && form && (
          <DialogFooter>
            <Button
              variant="hero"
              disabled={saveMut.isPending || !form.product_name}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? "Saving…" : "Save Product"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
