import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/highland-logo.png.asset.json";

export type DesignPdfProduct = {
  product_name: string;
  vendor: string | null;
  category: string | null;
};

export type DesignPdfArgs = {
  projectName: string;
  title: string;
  category: string;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  coverPath: string | null;
  photoPaths: string[];
  products: DesignPdfProduct[];
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
    return { data, ...dims };
  } catch {
    return null;
  }
}

async function loadPhoto(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("design-assets").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  return urlToDataUrl(data.signedUrl);
}

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export async function generateDesignPdf(args: DesignPdfArgs) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const generatedAt = new Date().toLocaleString();
  const navy: [number, number, number] = [23, 37, 64];
  const gray: [number, number, number] = [110, 110, 110];

  const ensureSpace = (needed: number, y: number) => {
    if (y + needed > pageH - 64) {
      doc.addPage();
      return margin;
    }
    return y;
  };

  // Header
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
  doc.text(args.title, margin, y + 6);
  y += 24;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  [
    `Project: ${args.projectName}`,
    `Category: ${args.category}`,
    `Created: ${fmt(args.createdAt)}`,
    `Last Updated: ${fmt(args.updatedAt)}`,
    `Generated: ${generatedAt}`,
  ].forEach((line) => {
    y += 14;
    doc.text(line, margin, y);
  });
  y += 10;

  if (args.notes) {
    y += 16;
    doc.setFontSize(12);
    doc.setTextColor(...navy);
    doc.text("Notes", margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(args.notes, contentW);
    lines.forEach((ln: string) => {
      y = ensureSpace(14, y);
      y += 14;
      doc.text(ln, margin, y);
    });
  }

  if (args.products.length > 0) {
    y += 20;
    y = ensureSpace(30, y);
    doc.setFontSize(12);
    doc.setTextColor(...navy);
    doc.text("Linked Products", margin, y);
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    args.products.forEach((p) => {
      y = ensureSpace(14, y);
      y += 14;
      const label = `• ${p.product_name}${p.vendor ? ` — ${p.vendor}` : ""}${p.category ? ` (${p.category})` : ""}`;
      doc.text(doc.splitTextToSize(label, contentW), margin, y);
    });
  }

  // Photos
  const paths = [args.coverPath, ...args.photoPaths.filter((p) => p !== args.coverPath)].filter(
    Boolean,
  ) as string[];
  if (paths.length > 0) {
    doc.addPage();
    y = margin;
    doc.setFontSize(14);
    doc.setTextColor(...navy);
    doc.text("Photo Gallery", margin, y);
    y += 16;
    const colW = (contentW - 12) / 2;
    const cellH = colW * 0.75;
    let col = 0;
    for (const path of paths) {
      const img = await loadPhoto(path);
      const x = margin + col * (colW + 12);
      y = ensureSpace(cellH + 12, y);
      if (img) {
        const ratio = Math.min(colW / img.w, cellH / img.h);
        const w = img.w * ratio;
        const h = img.h * ratio;
        doc.addImage(img.data, "JPEG", x, y, w, h);
      } else {
        doc.setDrawColor(220, 220, 220);
        doc.rect(x, y, colW, cellH);
      }
      col++;
      if (col === 2) {
        col = 0;
        y += cellH + 12;
      }
    }
  }

  // Footer on all pages
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(
      `Highland Remodeling   •   Project: ${args.projectName}   •   Generated: ${generatedAt}`,
      margin,
      pageH - 32,
    );
  }

  doc.save(`${args.title.replace(/[^a-z0-9]+/gi, "-")}-design.pdf`);
}
