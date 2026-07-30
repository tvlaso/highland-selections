import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/highland-logo.png.asset.json";
import { CATEGORIES } from "@/lib/constants";

export type ExportCatalogItem = {
  product_name: string;
  vendor: string | null;
  image_url: string | null;
  product_url: string | null;
  price?: number | null;
  description?: string | null;
};

export type ExportOption = {
  id: string;
  category: string;
  customer_notes: string | null;
  master_catalog: ExportCatalogItem | null;
  status?: string | null;
};

export type ExportArgs = {
  projectName: string;
  customerName: string;
  address: string | null;
  version: number;
  lastModified: string | null;
  options: ExportOption[];
};

async function urlToDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = data;
    });
    return { data, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

const rawPhotoCache = new Map<string, { data: string; w: number; h: number } | null>();

async function loadPhoto(path: string | null | undefined) {
  if (!path) return null;
  if (rawPhotoCache.has(path)) return rawPhotoCache.get(path)!;
  const { data } = await supabase.storage.from("product-photos").createSignedUrl(path, 3600);
  const result = data?.signedUrl ? await urlToDataUrl(data.signedUrl) : null;
  rawPhotoCache.set(path, result);
  return result;
}

/** Fetch all unique photos up front, in parallel (bounded), so the retry loop is cheap. */
async function preloadPhotos(paths: string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean))).filter((p) => !rawPhotoCache.has(p));
  if (unique.length === 0) return;
  const signed = await supabase.storage.from("product-photos").createSignedUrls(unique, 3600);
  const urls = new Map<string, string>();
  (signed.data ?? []).forEach((s, i) => {
    if (s?.signedUrl) urls.set(unique[i], s.signedUrl);
  });
  const CONCURRENCY = 8;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, unique.length) }, async () => {
      while (cursor < unique.length) {
        const path = unique[cursor++];
        const url = urls.get(path);
        rawPhotoCache.set(path, url ? await urlToDataUrl(url) : null);
      }
    }),
  );
}

const compressedCache = new Map<string, { data: string; w: number; h: number } | null>();

/** Re-encode an image as a downscaled JPEG to keep the PDF small. */
async function compressImage(
  src: { data: string; w: number; h: number },
  maxDim: number,
  quality: number,
): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src.data;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: canvas.toDataURL("image/jpeg", quality), w, h };
  } catch {
    return src;
  }
}

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

async function buildSelectionsPdf(
  args: ExportArgs,
  imgOpts: { maxDim: number; quality: number; includePhotos: boolean },
) {
  const { projectName, customerName, address, version, lastModified, options } = args;

  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const generatedAt = new Date().toLocaleString();

  const navy: [number, number, number] = [23, 37, 64];
  const orange: [number, number, number] = [214, 99, 38];
  const gray: [number, number, number] = [110, 110, 110];

  const footer = () => {
    const y = pageH - 56;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(
      [
        `Highland Remodeling   •   Project: ${projectName}   •   Selections Version: V${version}`,
        `Generated: ${generatedAt}`,
        "This document reflects the approved selections at the time it was generated.",
      ],
      margin,
      y + 14,
    );
  };

  // Header / branding
  const logoImg = await urlToDataUrl(logo.url);
  let y = margin;
  if (logoImg) {
    const lw = 150;
    const lh = (logoImg.h / logoImg.w) * lw;
    doc.addImage(logoImg.data, "PNG", margin, y, lw, lh);
    y += lh + 12;
  } else {
    doc.setFontSize(20);
    doc.setTextColor(...navy);
    doc.text("Highland Remodeling", margin, y + 16);
    y += 32;
  }

  doc.setFontSize(18);
  doc.setTextColor(...navy);
  doc.text("Selections List", margin, y + 6);
  y += 22;

  // Meta block
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const meta = [
    `Project: ${projectName}`,
    `Customer: ${customerName}`,
    `Address: ${address || "—"}`,
    `Export Version: V${version}`,
    `Last Modified: ${fmt(lastModified)}`,
    `Generated: ${generatedAt}`,
  ];
  meta.forEach((line) => {
    y += 14;
    doc.text(line, margin, y);
  });
  y += 18;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 72) {
      footer();
      doc.addPage();
      y = margin;
    }
  };

  const ordered = CATEGORIES.filter((cat) => options.some((o) => o.category === cat));
  for (const cat of ordered) {
    const items = options.filter((o) => o.category === cat);
    ensureSpace(40);
    doc.setFillColor(...orange);
    doc.rect(margin, y - 2, 4, 16, "F");
    doc.setFontSize(13);
    doc.setTextColor(...navy);
    doc.text(cat.toUpperCase(), margin + 12, y + 11);
    y += 26;

    for (const o of items) {
      const c = o.master_catalog;
      const imgSize = 76;
      const tx = margin + imgSize + 16;
      const tw = contentW - imgSize - 16;

      const titleLines = doc.splitTextToSize(c?.product_name ?? "Unknown product", tw);
      const vendorLines = c?.vendor ? doc.splitTextToSize(`Vendor: ${c.vendor}`, tw) : [];
      const notesLines = o.customer_notes ? doc.splitTextToSize(`Customer notes: ${o.customer_notes}`, tw) : [];

      const textBlockHeight =
        12 + // top padding
        titleLines.length * 15 + 3 +
        (c?.vendor ? vendorLines.length * 14 + 3 : 0) +
        (c?.product_url ? 14 + 3 : 0) +
        (o.customer_notes ? notesLines.length * 11 + 3 : 0) +
        6;
      const rowH = Math.max(imgSize + 12, textBlockHeight);

      ensureSpace(rowH + 8);
      const top = y;

      let photo: { data: string; w: number; h: number } | null = null;
      if (imgOpts.includePhotos && c?.image_url) {
        const key = `${c.image_url}|${imgOpts.maxDim}|${imgOpts.quality}`;
        if (compressedCache.has(key)) {
          photo = compressedCache.get(key)!;
        } else {
          const raw = await loadPhoto(c.image_url);
          photo = raw ? await compressImage(raw, imgOpts.maxDim, imgOpts.quality) : null;
          compressedCache.set(key, photo);
        }
      }
      if (photo) {
        try {
          doc.addImage(photo.data, "JPEG", margin, top, imgSize, imgSize, undefined, "FAST");
        } catch {
          doc.addImage(photo.data, "PNG", margin, top, imgSize, imgSize, undefined, "FAST");
        }
      } else {
        doc.setFillColor(238, 238, 238);
        doc.rect(margin, top, imgSize, imgSize, "F");
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text("No photo", margin + imgSize / 2, top + imgSize / 2, { align: "center" });
      }

      let ty = top + 12;

      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.text(titleLines, tx, ty);
      ty += titleLines.length * 15 + 3;

      if (c?.vendor) {
        doc.setFontSize(10);
        doc.setTextColor(...gray);
        doc.text(vendorLines, tx, ty);
        ty += vendorLines.length * 14 + 3;
      }

      if (c?.product_url) {
        doc.setFontSize(10);
        doc.setTextColor(...orange);
        doc.textWithLink("Manufacturer PDF / Product Link", tx, ty, { url: c.product_url });
        ty += 14 + 3;
      }

      if (o.customer_notes) {
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        doc.text(notesLines, tx, ty);
        ty += notesLines.length * 11 + 3;
      }

      y = Math.max(top + imgSize, ty) + 12;
      doc.setDrawColor(235, 235, 235);
      doc.line(margin, y - 6, pageW - margin, y - 6);
    }
    y += 6;
  }

  if (ordered.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(...gray);
    doc.text("No selections have been added yet.", margin, y + 10);
  }

  footer();
  return doc;
}

const MAX_BYTES = 2 * 1024 * 1024;

export async function generateSelectionsPdf(args: ExportArgs) {
  const attempts = [
    { maxDim: 480, quality: 0.72, includePhotos: true },
    { maxDim: 320, quality: 0.6, includePhotos: true },
    { maxDim: 200, quality: 0.45, includePhotos: true },
    { maxDim: 120, quality: 0.35, includePhotos: true },
    { maxDim: 120, quality: 0.35, includePhotos: false },
  ];

  let blob: Blob | null = null;
  let doc: jsPDF | null = null;
  for (const opts of attempts) {
    doc = await buildSelectionsPdf(args, opts);
    blob = doc.output("blob");
    if (blob.size <= MAX_BYTES) break;
  }

  const safe = args.projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const name = `selections-${safe}-v${args.version}.pdf`;

  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    doc?.save(name);
  }
}
