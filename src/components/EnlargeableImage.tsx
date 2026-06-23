import { useState } from "react";
import { SignedImage } from "@/components/SignedImage";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function EnlargeableImage({
  path,
  alt,
  className = "",
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => path && setOpen(true)}
        className={`${className} ${path ? "cursor-zoom-in" : "cursor-default"} block overflow-hidden p-0`}
        aria-label={path ? `Enlarge ${alt}` : alt}
      >
        <SignedImage path={path} alt={alt} className="h-full w-full object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2">
          <SignedImage
            path={path}
            alt={alt}
            className="max-h-[80vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
