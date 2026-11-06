import { describe, it, expect } from "vitest";
import { calculate, DEFAULT_RATES as r, DEFAULT_SELECTIONS, detailsSchema, type Selections } from "./model";
const d = detailsSchema.parse({});
const calc = (areas: Selections["areas"], values = {}) =>
  calculate(
    { ...DEFAULT_SELECTIONS, areas, values: { ...DEFAULT_SELECTIONS.values, ...values } },
    r,
    d,
  );
describe("Bathroom consultation pricing", () => {
  for (const [key, value] of Object.entries({
    showerDemo: 1815.5,
    vanityDemo: 512.11,
    toiletDemo: 200,
    mirrorDemo: 200,
    floorDemo: 10,
    standardPlumbing: 2956.38,
    handheldPlumbing: 3749.11,
    showerTile: 6053.42,
    niche: 600,
    grabBar: 500,
    bench: 600,
    standardGlass: 3124.13,
    cornerGlass: 3543.98,
    vanityBase: 3142.79,
    extraSink: 600,
    vanityExtraFoot: 500,
    mirrorLabor: 300,
    lightingLabor: 300,
    tileFloor: 40,
    tileMinimum: 900,
    lvpFloor: 13,
    lvpMinimum: 650,
  }))
    it(`${key} initial rate`, () => expect(r[key as keyof typeof r]).toBe(value));
  it("standard shower grouped price", () =>
    expect(calc(["Shower"]).groups).toEqual([
      { name: "Demolition", amount: 1815.5 },
      { name: "Shower Remodel", amount: 12133.93 },
    ]));
  it("handheld, corner glass and accessories", () =>
    expect(
      calc(["Shower"], {
        plumbing: "Handheld / diverter",
        glass: "Corner",
        niches: 2,
        grabBars: 1,
        benches: 1,
      }).groups[1].amount,
    ).toBe(15646.51));
  it("prorated vanity extension and additional sink", () =>
    expect(calc(["Vanity"], { vanityWidth: 66, sinks: 2 }).groups[1].amount).toBe(3992.79));
  it("vanity demolition per unit", () =>
    expect(calc(["Vanity"], { vanityQty: 2 }).groups[0].amount).toBe(1024.22));
  it("tile minimum and separate demolition", () =>
    expect(calc(["Flooring"], { floorSqft: 10 }).groups).toEqual([
      { name: "Demolition", amount: 100 },
      { name: "Flooring", amount: 900 },
    ]));
  it("LVP minimum", () =>
    expect(calc(["Flooring"], { floorSqft: 10, floorType: "LVP" }).groups[1].amount).toBe(650));
  it("tile area rate", () =>
    expect(calc(["Flooring"], { floorSqft: 100 }).groups[1].amount).toBe(4000));
  it("LVP area rate", () =>
    expect(calc(["Flooring"], { floorSqft: 100, floorType: "LVP" }).groups[1].amount).toBe(1300));
  it("mirror labor plus material per unit", () =>
    expect(calc(["Mirrors"], { mirrorQty: 2, mirrorMaterial: 75 }).groups[1].amount).toBe(750));
  it("lighting labor plus material", () =>
    expect(calc(["Vanity lighting"], { lightQty: 2, lightMaterial: 50 }).subtotal).toBe(700));
  it("omits non-selected scope", () => expect(calc([]).total).toBe(0));
  it("custom work flagged not silently priced", () =>
    expect(calc(["Flooring"], { floorSqft: 30, heated: true }).flags).toContain(
      "Heated flooring requires separate pricing.",
    ));
  it("tax and adjustments", () =>
    expect(
      calculate(
        { ...DEFAULT_SELECTIONS, areas: [] },
        r,
        detailsSchema.parse({ materialAllowance: 100, adjustment: 50, taxRate: 10 }),
      ).total,
    ).toBe(165));
});
