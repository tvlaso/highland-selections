import { useState } from "react";
import { SignedImage } from "@/components/SignedImage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Displays one or more product photos: a main image with a thumbnail strip.
 * Clicking the main image opens a lightbox that can be paged through.
 */
export function ImageGallery({
  images,
  alt,
  className = "",
}: {
  images: (string | null | undefined)[];
  alt: string;
  className?: string;
}) {
  const paths = images.filter((p): p is string => !!p);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const current = paths[active] ?? paths[0] ?? null;
  const go = (dir: number) =>
    setActive((i) => (paths.length ? (i + dir + paths.length) % paths.length : 0));

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => current && setOpen(true)}
        className={`${className} ${current ? "cursor-zoom-in" : "cursor-default"} block overflow-hidden p-0`}
        aria-label={current ? `Enlarge ${alt}` : alt}
      >
        <SignedImage path={current} alt={alt} className="h-full w-full object-cover" />
      </button>

      {paths.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {paths.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setActive(i)}
              className={`h-8 w-8 overflow-hidden rounded border ${
                i === active ? "border-accent ring-1 ring-accent" : "border-border"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <SignedImage path={p} alt={`${alt} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2">
          <div className="relative">
            <SignedImage
              path={current}
              alt={alt}
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
            {paths.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow hover:bg-background"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow hover:bg-background"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">
                  {active + 1} / {paths.length}
                </span>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}