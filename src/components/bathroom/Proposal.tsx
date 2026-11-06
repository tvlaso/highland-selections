import { SignedImage } from "@/components/SignedImage";
import { calculate, scopeLines, money, type Snapshot } from "@/lib/bathroom/model";
import { Logo } from "@/components/Logo";
export function Proposal({ snapshot: s, version }: { snapshot: Snapshot; version?: number }) {
  const c = calculate(s.selections, s.rates, s.details);
  return (
    <article className="space-y-6 bg-card p-5 text-foreground sm:p-8">
      <header className="space-y-3 border-b border-border pb-5">
        <Logo className="h-12 w-auto" />
        <h2 className="text-xl font-bold">Bathroom Design & Proposal</h2>
        <p className="text-sm text-muted-foreground">
          HR-B{String(s.number).padStart(5, "0")}
          {version ? ` · Version ${version}` : ""}
          {s.title ? ` · ${s.title}` : ""}
        </p>
      </header>
      <section>
        <h3 className="mb-2 font-semibold">Project Overview</h3>
        <p className="whitespace-pre-wrap text-sm">
          {s.details.overview ||
            `Bathroom remodel including ${s.selections.areas.join(", ").toLowerCase()}.`}
        </p>
      </section>
      {Object.entries(s.images)
        .filter(
          ([area, image]) =>
            s.selections.areas.includes(area as "Shower" | "Vanity") && image.approved,
        )
        .map(([area, image]) => (
          <section key={area}>
            <h3 className="mb-2 font-semibold">{area} Design Preview</h3>
            <SignedImage
              bucket="bathroom-designs"
              path={image.path}
              alt={`Approved ${area.toLowerCase()} design`}
              className="aspect-[3/2] w-full rounded-lg object-contain"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Illustrative design; final installation may vary.
            </p>
          </section>
        ))}
      <section>
        <h3 className="mb-2 font-semibold">Scope of Work</h3>
        <ul className="space-y-3 text-sm">
          {scopeLines(s.selections).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Pricing</h3>
        <dl className="space-y-2 text-sm">
          {c.groups.map((g) => (
            <div className="flex justify-between gap-4" key={g.name}>
              <dt>{g.name}</dt>
              <dd>{money(g.amount)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-3">
            <dt>Subtotal</dt>
            <dd>{money(c.subtotal)}</dd>
          </div>
          {s.details.taxRate > 0 && (
            <div className="flex justify-between">
              <dt>Applicable tax ({s.details.taxRate}%)</dt>
              <dd>{money(c.tax)}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <dt>Total</dt>
            <dd>{money(c.total)}</dd>
          </div>
        </dl>
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Project Details</h3>
        {[
          ["Estimated duration", s.details.duration],
          ["Allowances", s.details.allowances],
          ["Exclusions", s.details.exclusions],
          ["Notes", s.details.notes],
        ].map(([label, value]) =>
          value ? (
            <p key={label} className="whitespace-pre-wrap text-sm">
              <strong>{label}: </strong>
              {value}
            </p>
          ) : null,
        )}
        {s.details.materialAllowance > 0 && (
          <p className="text-sm">
            Provisional material allowance: {money(s.details.materialAllowance)}
          </p>
        )}
        {c.flags.length > 0 && (
          <div className="text-sm">
            <h4 className="mb-2 font-semibold">Separate Pricing Required</h4>
            <ul className="list-inside list-disc space-y-1">
              {c.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </article>
  );
}
