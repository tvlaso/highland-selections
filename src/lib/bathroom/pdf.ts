import { jsPDF } from "jspdf";
import logo from "@/assets/highland-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { calculate, scopeLines, money, type Snapshot } from "./model";
async function photo(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1200 / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { url: canvas.toDataURL("image/jpeg", 0.75), w: canvas.width, h: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function bathroomPdf(s: Snapshot, version: number) {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const width = 612,
    margin = 44;
  let y = 44;
  const text = (value: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value, width - margin * 2) as string[];
    for (const line of lines) {
      if (y + size + 10 > 735) {
        doc.addPage();
        y = 44;
      }
      doc.text(line, margin, y);
      y += size + 5;
    }
    y += 7;
  };
  const heading = (v: string) => {
    y += 8;
    text(v, 13, true);
  };
  try {
    const response = await fetch(logo.url);
    if (response.ok) {
      const p = await photo(await response.blob());
      doc.addImage(p.url, "JPEG", margin, y, 160, (160 * p.h) / p.w);
      y += (160 * p.h) / p.w + 22;
    }
  } catch {
    text("HIGHLAND REMODELING", 18, true);
  }
  text("Bathroom Design & Proposal", 20, true);
  text(`HR-B${String(s.number).padStart(5, "0")} • Version ${version}`, 10);
  if (s.title) text(s.title, 15, true);
  heading("Project Overview");
  text(
    s.details.overview ||
      `Bathroom remodel including ${s.selections.areas.join(", ").toLowerCase()}.`,
  );
  const approved = Object.entries(s.images).filter(
    ([area, img]) => s.selections.areas.includes(area as "Shower" | "Vanity") && img.approved,
  );
  if (approved.length) {
    heading("AI Design Preview");
    for (const [area, img] of approved) {
      const { data, error } = await supabase.storage.from("bathroom-designs").download(img.path);
      if (error || !data)
        throw new Error(
          `The approved ${area.toLowerCase()} image could not be included. Try again.`,
        );
      const p = await photo(data);
      const h = ((width - margin * 2) * p.h) / p.w;
      if (y + h + 45 > 735) {
        doc.addPage();
        y = 44;
      }
      text(area, 11, true);
      doc.addImage(p.url, "JPEG", margin, y, width - margin * 2, h);
      y += h + 15;
    }
    text("Design visualizations are illustrative; final installation may vary.", 9);
  }
  heading("Scope of Work");
  for (const line of scopeLines(s.selections)) text(line);
  const c = calculate(s.selections, s.rates, s.details);
  heading("Pricing");
  for (const g of c.groups) text(`${g.name}: ${money(g.amount)}`, 11);
  text(`Subtotal: ${money(c.subtotal)}`, 11, true);
  if (s.details.taxRate) text(`Applicable tax (${s.details.taxRate}%): ${money(c.tax)}`, 11);
  text(`Total: ${money(c.total)}`, 14, true);
  heading("Project Details");
  for (const [label, value] of [
    ["Estimated duration", s.details.duration],
    ["Allowances", s.details.allowances],
    ["Exclusions", s.details.exclusions],
    ["Notes", s.details.notes],
  ] as const)
    if (value) text(`${label}: ${value}`);
  if (s.details.materialAllowance)
    text(`Provisional material allowance: ${money(s.details.materialAllowance)}`);
  if (s.details.adjustmentReason) text(`Adjustment: ${s.details.adjustmentReason}`);
  if (c.flags.length) {
    text("Items requiring separate pricing", 11, true);
    for (const flag of c.flags) text(flag);
  }
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Highland Remodeling", margin, 766);
    doc.text(`${i} / ${doc.getNumberOfPages()}`, 568, 766, { align: "right" });
  }
  return doc;
}
