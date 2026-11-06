import { z } from "zod";
export const AREAS = [
  "Shower",
  "Vanity",
  "Flooring",
  "Toilet",
  "Mirrors",
  "Vanity lighting",
] as const;
export const LAYOUTS = ["Double vanity", "Three-wall shower", "Corner shower"] as const;
export const ratesSchema = z.object({
  showerDemo: z.number().nonnegative().default(1815.5),
  vanityDemo: z.number().nonnegative().default(512.11),
  toiletDemo: z.number().nonnegative().default(200),
  mirrorDemo: z.number().nonnegative().default(200),
  floorDemo: z.number().nonnegative().default(10),
  standardPlumbing: z.number().nonnegative().default(2956.38),
  handheldPlumbing: z.number().nonnegative().default(3749.11),
  showerTile: z.number().nonnegative().default(6053.42),
  niche: z.number().nonnegative().default(600),
  grabBar: z.number().nonnegative().default(500),
  bench: z.number().nonnegative().default(600),
  standardGlass: z.number().nonnegative().default(3124.13),
  cornerGlass: z.number().nonnegative().default(3543.98),
  vanityBase: z.number().nonnegative().default(3142.79),
  extraSink: z.number().nonnegative().default(600),
  vanityExtraFoot: z.number().nonnegative().default(500),
  mirrorLabor: z.number().nonnegative().default(300),
  lightingLabor: z.number().nonnegative().default(300),
  tileFloor: z.number().nonnegative().default(40),
  tileMinimum: z.number().nonnegative().default(900),
  lvpFloor: z.number().nonnegative().default(13),
  lvpMinimum: z.number().nonnegative().default(650),
});
export type Rates = z.infer<typeof ratesSchema>;
export const DEFAULT_RATES = ratesSchema.parse({});
export const RATE_LABELS: Record<keyof Rates, string> = {
  showerDemo: "Shower demolition",
  vanityDemo: "Vanity demolition / each",
  toiletDemo: "Toilet demolition / each",
  mirrorDemo: "Mirror demolition / each",
  floorDemo: "Floor demolition / sq ft",
  standardPlumbing: "Standard shower plumbing",
  handheldPlumbing: "Handheld / diverter plumbing",
  showerTile: "Standard shower tile / preparation / installation",
  niche: "Niche / each",
  grabBar: "Grab bar / each",
  bench: "Bench / each",
  standardGlass: "Standard glass",
  cornerGlass: "Corner glass",
  vanityBase: "Quartz vanity ≤ 60 inches, single sink",
  extraSink: "Additional sink",
  vanityExtraFoot: "Vanity above 60 inches / ft",
  mirrorLabor: "Mirror installation / each",
  lightingLabor: "Vanity lighting installation / each",
  tileFloor: "Tile flooring / sq ft",
  tileMinimum: "Tile flooring minimum",
  lvpFloor: "LVP flooring / sq ft",
  lvpMinimum: "LVP flooring minimum",
};
export const selectionsSchema = z.object({
  areas: z.array(z.enum(AREAS)).default([]),
  values: z
    .record(z.union([z.string().max(5000), z.number().finite().nonnegative(), z.boolean()]))
    .default({}),
});
export type Selections = z.infer<typeof selectionsSchema>;
export const detailsSchema = z.object({
  overview: z.string().max(10000).default(""),
  duration: z.string().max(2000).default(""),
  allowances: z.string().max(10000).default(""),
  exclusions: z.string().max(10000).default(""),
  notes: z.string().max(10000).default(""),
  taxRate: z.number().min(0).max(100).default(0),
  adjustment: z.number().finite().default(0),
  adjustmentReason: z.string().max(2000).default(""),
  materialAllowance: z.number().nonnegative().default(0),
  customWork: z.string().max(5000).default(""),
});
export type Details = z.infer<typeof detailsSchema>;
export const imagesSchema = z.record(z.object({ path: z.string(), approved: z.boolean() }));
export type DesignImages = z.infer<typeof imagesSchema>;
export const snapshotSchema = z.object({
  number: z.number(),
  title: z.string(),
  selections: selectionsSchema,
  details: detailsSchema,
  rates: ratesSchema,
  images: imagesSchema,
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Field = {
  key: string;
  label: string;
  type?: "number" | "select" | "boolean";
  options?: string[];
};
const n = (key: string, label: string): Field => ({ key, label, type: "number" });
const t = (key: string, label: string): Field => ({ key, label });
const s = (key: string, label: string, options: string[]): Field => ({
  key,
  label,
  type: "select",
  options,
});
export const FIELDS: Record<(typeof AREAS)[number], Field[]> = {
  Shower: [
    s("layout", "Layout", ["Three-wall shower", "Corner shower"]),
    n("showerWidth", "Width (inches)"),
    n("showerDepth", "Depth (inches)"),
    n("showerHeight", "Height (inches)"),
    s("pan", "Pan type", ["Tile", "Prefabricated", "Custom"]),
    t("showerTileStyle", "Tile style / material"),
    t("showerTileSize", "Tile size"),
    t("grout", "Grout color"),
    s("plumbing", "Fixtures", ["Standard", "Handheld / diverter"]),
    t("fixtureFinish", "Fixture finish"),
    s("glass", "Glass", ["Standard", "Corner", "None", "Custom"]),
    n("niches", "Niches"),
    n("benches", "Benches"),
    n("grabBars", "Grab bars"),
  ],
  Vanity: [
    n("vanityWidth", "Width (inches)"),
    n("vanityDepth", "Depth (inches)"),
    n("vanityQty", "Vanity quantity"),
    t("cabinetStyle", "Cabinet style"),
    t("cabinetColor", "Cabinet color"),
    n("sinks", "Sinks per vanity"),
    t("countertop", "Countertop"),
    t("backsplash", "Backsplash"),
    t("faucets", "Faucets"),
    t("hardware", "Hardware"),
  ],
  Flooring: [
    n("floorSqft", "Square footage"),
    s("floorType", "Flooring type", ["Tile", "LVP"]),
    t("floorAppearance", "Material appearance"),
    { key: "heated", label: "Heated flooring", type: "boolean" },
  ],
  Toilet: [n("toiletQty", "Toilet quantity"), t("toiletStyle", "Toilet / finish")],
  Mirrors: [
    n("mirrorQty", "Quantity"),
    t("mirrorDimensions", "Dimensions"),
    t("mirrorStyle", "Style"),
    t("mirrorColor", "Color"),
    t("mirrorFinish", "Finish"),
    n("mirrorMaterial", "Material allowance / each ($)"),
  ],
  "Vanity lighting": [
    n("lightQty", "Quantity"),
    t("lightDimensions", "Dimensions"),
    t("lightStyle", "Style"),
    t("lightColor", "Color"),
    t("lightFinish", "Finish"),
    n("lightMaterial", "Material allowance / each ($)"),
  ],
};
export const DEFAULT_SELECTIONS: Selections = {
  areas: [],
  values: {
    layout: "Three-wall shower",
    plumbing: "Standard",
    glass: "Standard",
    pan: "Tile",
    vanityQty: 1,
    sinks: 1,
    vanityWidth: 60,
    countertop: "Quartz",
    floorType: "Tile",
    toiletQty: 1,
    mirrorQty: 1,
    lightQty: 1,
  },
};
export function num(s: Selections, key: string, fallback = 0) {
  const v = s.values[key];
  return typeof v === "number" ? v : fallback;
}
export function calculate(s: Selections, r: Rates, d: Details) {
  const lines: { group: string; label: string; amount: number }[] = [];
  const has = (area: (typeof AREAS)[number]) => s.areas.includes(area);
  const add = (group: string, label: string, amount: number) =>
    lines.push({ group, label, amount: Math.round(amount * 100) / 100 });
  if (has("Shower")) {
    add("Demolition", "Shower", r.showerDemo);
    add(
      "Shower Remodel",
      "Plumbing",
      s.values.plumbing === "Handheld / diverter" ? r.handheldPlumbing : r.standardPlumbing,
    );
    add("Shower Remodel", "Tile, preparation and installation", r.showerTile);
    for (const [key, label, rate] of [
      ["niches", "Niches", r.niche],
      ["grabBars", "Grab bars", r.grabBar],
      ["benches", "Benches", r.bench],
    ] as const)
      if (num(s, key)) add("Shower Remodel", `${label} × ${num(s, key)}`, num(s, key) * rate);
    if (s.values.glass === "Standard" || s.values.glass === "Corner")
      add("Shower Remodel", "Glass", s.values.glass === "Corner" ? r.cornerGlass : r.standardGlass);
  }
  if (has("Vanity")) {
    const qty = num(s, "vanityQty", 1);
    add("Demolition", `Vanity × ${qty}`, qty * r.vanityDemo);
    add("Vanity Area", `Quartz vanity × ${qty}`, qty * r.vanityBase);
    if (num(s, "sinks", 1) > 1)
      add("Vanity Area", "Additional sinks", qty * (num(s, "sinks", 1) - 1) * r.extraSink);
    if (num(s, "vanityWidth", 60) > 60)
      add(
        "Vanity Area",
        "Width above 60 inches",
        ((qty * (num(s, "vanityWidth") - 60)) / 12) * r.vanityExtraFoot,
      );
  }
  if (has("Toilet"))
    add("Demolition", `Toilet × ${num(s, "toiletQty", 1)}`, num(s, "toiletQty", 1) * r.toiletDemo);
  if (has("Mirrors")) {
    add("Demolition", `Mirror × ${num(s, "mirrorQty", 1)}`, num(s, "mirrorQty", 1) * r.mirrorDemo);
    add(
      "Vanity Area",
      "Mirrors: installation + material",
      num(s, "mirrorQty", 1) * (r.mirrorLabor + num(s, "mirrorMaterial")),
    );
  }
  if (has("Vanity lighting"))
    add(
      "Vanity Area",
      "Lighting: installation + material",
      num(s, "lightQty", 1) * (r.lightingLabor + num(s, "lightMaterial")),
    );
  if (has("Flooring") && num(s, "floorSqft") > 0) {
    const sqft = num(s, "floorSqft");
    add("Demolition", `Flooring: ${sqft} sq ft`, sqft * r.floorDemo);
    const lvp = s.values.floorType === "LVP";
    add(
      "Flooring",
      `${lvp ? "LVP" : "Tile"}: ${sqft} sq ft (minimum applied)`,
      Math.max(sqft * (lvp ? r.lvpFloor : r.tileFloor), lvp ? r.lvpMinimum : r.tileMinimum),
    );
  }
  if (d.materialAllowance) add("Allowances", "Provisional material allowance", d.materialAllowance);
  if (d.adjustment) add("Adjustments", d.adjustmentReason || "Manual adjustment", d.adjustment);
  const groups = Array.from(new Set(lines.map((x) => x.group))).map((name) => ({
    name,
    amount:
      Math.round(lines.filter((x) => x.group === name).reduce((a, x) => a + x.amount, 0) * 100) /
      100,
  }));
  const subtotal = Math.round(groups.reduce((a, x) => a + x.amount, 0) * 100) / 100;
  const tax = Math.round(subtotal * d.taxRate) / 100;
  const flags = [
    ...(has("Toilet") ? ["Toilet supply and installation require separate pricing."] : []),
    ...(has("Flooring") && s.values.heated ? ["Heated flooring requires separate pricing."] : []),
    ...(has("Flooring") && !num(s, "floorSqft")
      ? ["Flooring square footage is required for pricing."]
      : []),
    ...(has("Shower") && (s.values.pan === "Custom" || s.values.glass === "Custom")
      ? ["Custom shower work requires separate pricing."]
      : []),
    ...(has("Vanity") &&
    s.values.countertop &&
    String(s.values.countertop).toLowerCase() !== "quartz"
      ? ["Non-quartz countertop requires separate pricing."]
      : []),
    ...(d.customWork ? [d.customWork] : []),
  ];
  return { lines, groups, subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100, flags };
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export function scopeLines(s: Selections) {
  return s.areas.map(
    (area) =>
      `${area}: ${FIELDS[area]
        .filter(
          (f) =>
            s.values[f.key] !== undefined && s.values[f.key] !== "" && s.values[f.key] !== false,
        )
        .map((f) => `${f.label}: ${s.values[f.key] === true ? "Yes" : s.values[f.key]}`)
        .join("; ")}`,
  );
}
