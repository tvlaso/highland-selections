import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateResponse } from "@lovable.dev/ai-gateway";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATEGORIES } from "@/lib/constants";

export interface ImportedProduct {
  product_name: string | null;
  brand: string | null;
  category: string | null;
  sku: string | null;
  price: number | null;
  finish: string | null;
  description: string | null;
  vendor: string | null;
}

export interface ImportPreview {
  product: ImportedProduct;
  /** Storage path in the product-photos bucket, when the image could be saved. */
  imagePath: string | null;
  /** Original remote image URL (for preview fallback only). */
  imageSourceUrl: string | null;
  productUrl: string;
  warning: string | null;
}

const FIRECRAWL_SCRAPE_URL = "https://connector-gateway.lovable.dev/firecrawl/v2/scrape";

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function extractOutputText(response: unknown): string | null {
  const output = (response as { output?: unknown[] })?.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = (item as { content?: unknown[] })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as { type?: string; text?: string };
      if (p?.type === "output_text" && typeof p.text === "string") return p.text;
    }
  }
  return null;
}

async function downloadImageToStorage(
  imageUrl: string,
): Promise<{ path: string } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
  } catch {
    return { error: "The product image could not be downloaded." };
  }
  if (!res.ok) return { error: "The product image could not be downloaded." };

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXT_BY_CONTENT_TYPE[contentType];
  if (!ext) return { error: "The product image was not a supported image file." };

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) return { error: "The product image was empty." };
  if (buffer.byteLength > 10 * 1024 * 1024)
    return { error: "The product image is larger than 10 MB." };

  const path = `catalog/${crypto.randomUUID()}.${ext}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from("product-photos")
    .upload(path, buffer, { contentType, upsert: false });
  if (error) return { error: "The product image could not be saved." };
  return { path };
}

/**
 * Imports a product from a supplier URL: scrapes the page with Firecrawl,
 * structures the details with AI, saves the product image to storage, and
 * checks for duplicates. Admin-only. Returns a preview for review — nothing
 * is written to the catalog until the admin saves it.
 */
export const extractProductFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ url: z.string().url().max(2000) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ImportPreview> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const url = data.url.trim();
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      throw new Error("Only http(s) product links are supported.");

    // Duplicate check: same product link already in the catalog.
    const { data: dupByUrl, error: dupErr } = await context.supabase
      .from("master_catalog")
      .select("product_name")
      .eq("product_link", url)
      .limit(1);
    if (dupErr) throw new Error(dupErr.message);
    if (dupByUrl && dupByUrl.length > 0)
      throw new Error(
        `This product link is already in the catalog ("${dupByUrl[0].product_name}").`,
      );

    // Scrape the supplier page.
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
    if (!lovableKey || !firecrawlKey)
      throw new Error("The import service is not configured yet.");

    let scrape: {
      success?: boolean;
      markdown?: string;
      metadata?: { ogImage?: string; title?: string };
      data?: { markdown?: string; metadata?: { ogImage?: string; title?: string } };
      error?: string;
    };
    try {
      const res = await fetch(FIRECRAWL_SCRAPE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": firecrawlKey,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 3000,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const body = await res.text();
      if (!res.ok) {
        console.error(`Firecrawl scrape failed [${res.status}]: ${body}`);
        if (res.status === 402 || (res.status === 403 && body.includes("Credit limit")))
          throw new Error("The import service is out of credits. Please try again later.");
        throw new Error(
          "This page could not be read — the site may be blocking imports. You can add the product manually instead.",
        );
      }
      scrape = JSON.parse(body);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("The page could not be reached. Check the link and try again.");
    }

    const markdown = scrape.markdown ?? scrape.data?.markdown ?? "";
    const ogImage = scrape.metadata?.ogImage ?? scrape.data?.metadata?.ogImage ?? null;
    if (!markdown || markdown.length < 50)
      throw new Error(
        "No product information could be read from this page. You can add the product manually instead.",
      );

    // Structure the product details with AI. Never invent missing values.
    const schema = {
      type: "object",
      properties: {
        product_name: { type: ["string", "null"] },
        brand: { type: ["string", "null"] },
        category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
        sku: { type: ["string", "null"] },
        price: { type: ["number", "null"] },
        finish: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        vendor: { type: ["string", "null"] },
        image_url: { type: ["string", "null"] },
      },
      required: [
        "product_name",
        "brand",
        "category",
        "sku",
        "price",
        "finish",
        "description",
        "vendor",
        "image_url",
      ],
      additionalProperties: false,
    } as const;

    const aiResponse = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions:
        "You extract product details from supplier web pages for a remodeling materials catalog. " +
        "Only use information explicitly present in the page content — never guess or invent values; use null when something is not stated. " +
        "price must be the displayed retail price in US dollars as a decimal number (for example 204.15), never in cents and without currency symbols. " +
        "category must be the single best match from the allowed list. " +
        "vendor is the supplier or retailer selling the product. " +
        "image_url is the absolute URL of the main product photo. " +
        "description is a concise 1-2 sentence summary including key dimensions or specifications when stated.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract the product details from this page (${url}):\n\n${markdown.slice(0, 12000)}`,
            },
          ],
        },
      ],
      text: {
        format: { type: "json_schema", name: "product_import", schema, strict: true },
      },
    });

    const text = extractOutputText(aiResponse);
    if (!text) throw new Error("The product details could not be extracted. Try again or add the product manually.");

    let extracted: ImportedProduct & { image_url: string | null };
    try {
      extracted = JSON.parse(text);
    } catch {
      throw new Error("The product details could not be extracted. Try again or add the product manually.");
    }

    // Duplicate check: same SKU already in the catalog.
    if (extracted.sku) {
      const { data: dupBySku } = await context.supabase
        .from("master_catalog")
        .select("product_name")
        .eq("sku", extracted.sku)
        .limit(1);
      if (dupBySku && dupBySku.length > 0)
        throw new Error(
          `A product with SKU "${extracted.sku}" is already in the catalog ("${dupBySku[0].product_name}").`,
        );
    }

    // Save the product image to storage so we don't rely on temporary URLs.
    let imagePath: string | null = null;
    let warning: string | null = null;
    // Fallbacks: AI-found image, page og:image, first image embedded in the page content.
    const markdownImage = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/.exec(markdown)?.[1] ?? null;
    const imageSourceUrl = extracted.image_url ?? ogImage ?? markdownImage;
    if (imageSourceUrl) {
      const result = await downloadImageToStorage(imageSourceUrl);
      if ("path" in result) imagePath = result.path;
      else warning = `${result.error} You can add photos manually after saving.`;
    } else {
      warning = "No product image was found. You can add photos manually after saving.";
    }

    return {
      product: {
        product_name: extracted.product_name,
        brand: extracted.brand,
        category: extracted.category,
        sku: extracted.sku,
        price: extracted.price,
        finish: extracted.finish,
        description: extracted.description,
        vendor: extracted.vendor,
      },
      imagePath,
      imageSourceUrl,
      productUrl: url,
      warning,
    };
  });
