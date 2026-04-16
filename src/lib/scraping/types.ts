import { z } from "zod";

/** Structured output from website scraping / AI extraction */
export const BrandExtractionSchema = z.object({
  brand_name: z.string().optional(),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  product_categories: z.array(z.string()).optional(),
  brand_values: z.array(z.string()).optional(),
  industry: z.string().optional(),
  target_audience: z.string().optional(),
  tone: z.string().optional(),
  price_range: z.string().optional(),
  instagram_handle: z.string().optional(),
});

export type BrandExtraction = z.infer<typeof BrandExtractionSchema>;
