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

async function loadPhoto(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("product-photos").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  return urlToDataUrl(data.signedUrl);
}

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export async function generateSelectionsPdf(args: ExportArgs) {
  const { projectName, customerName, address, version, lastModified, options } = args;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
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
      const rowH = 92;
      ensureSpace(rowH + 8);
      const top = y;
      const imgSize = 76;

      const photo = await loadPhoto(c?.image_url);
      if (photo) {
        try {
          doc.addImage(photo.data, "JPEG", margin, top, imgSize, imgSize);
        } catch {
          doc.addImage(photo.data, "PNG", margin, top, imgSize, imgSize);
        }
      } else {
        doc.setFillColor(238, 238, 238);
        doc.rect(margin, top, imgSize, imgSize, "F");
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text("No photo", margin + imgSize / 2, top + imgSize / 2, { align: "center" });
      }

      const tx = margin + imgSize + 16;
      const tw = contentW - imgSize - 16;
      let ty = top + 12;

      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.text(c?.product_name ?? "Unknown product", tx, ty);
      ty += 15;

      if (c?.vendor) {
        doc.setFontSize(10);
        doc.setTextColor(...gray);
        doc.text(`Vendor: ${c.vendor}`, tx, ty);
        ty += 14;
      }

      if (c?.product_url) {
        doc.setFontSize(10);
        doc.setTextColor(...orange);
        doc.textWithLink("Manufacturer PDF / Product Link", tx, ty, { url: c.product_url });
        ty += 14;
      }

      if (o.customer_notes) {
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        const notes = doc.splitTextToSize(`Customer notes: ${o.customer_notes}`, tw);
        doc.text(notes, tx, ty);
        ty += notes.length * 11;
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

  const safe = projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`selections-${safe}-v${version}.pdf`);
}
