import type { Brand } from "@/lib/types/database";

export function generateBrandMd(brand: Brand): string {
  const sections: string[] = [];

  sections.push(`# Brand: ${brand.brand_name}`);

  if (brand.industry) {
    sections.push(`\n## Industry\n${brand.industry}`);
  }

  if (brand.product_categories?.length) {
    sections.push(`\n## Products`);
    sections.push(`- Categories: ${brand.product_categories.join(", ")}`);
    if (brand.avg_product_price) {
      sections.push(
        `- Average price: ${brand.price_currency || "INR"} ${brand.avg_product_price}`
      );
    }
  }

  if (brand.shipping_zones?.length) {
    sections.push(`\n## Target Market`);
    sections.push(`- Shipping zones: ${brand.shipping_zones.join(", ")}`);
  }

  if (brand.default_campaign_goal) {
    sections.push(`- Primary goal: ${brand.default_campaign_goal}`);
  }

  if (brand.budget_per_creator_min || brand.budget_per_creator_max) {
    const currency = brand.price_currency || "INR";
    const min = brand.budget_per_creator_min || 0;
    const max = brand.budget_per_creator_max || "flexible";
    sections.push(`\n## Budget\n- Per creator: ${currency} ${min} – ${max}`);
  }

  if (brand.content_format_pref) {
    sections.push(`\n## Content Preferences\n- Preferred format: ${brand.content_format_pref}`);
  }

  if (brand.competitor_brands?.length) {
    sections.push(`\n## Competitors\n${brand.competitor_brands.join(", ")}`);
  }

  if (brand.past_collaborations?.length) {
    sections.push(
      `\n## Past Collaborations\n${brand.past_collaborations.join(", ")}`
    );
  }

  // Brand Identity (from website scraping / settings)
  if (brand.brand_description || brand.brand_values?.length || brand.target_audience || brand.brand_voice_preference) {
    sections.push(`\n## Brand Identity`);
    if (brand.brand_description) sections.push(`- Description: ${brand.brand_description}`);
    if (brand.brand_values?.length) sections.push(`- Core values: ${brand.brand_values.join(", ")}`);
    if (brand.target_audience) sections.push(`- Target audience: ${brand.target_audience}`);
    if (brand.brand_voice_preference) sections.push(`- Brand voice: ${brand.brand_voice_preference}`);
    if (brand.min_audience_age) sections.push(`- Minimum audience age: ${brand.min_audience_age}+`);
    if (brand.instagram_handle) sections.push(`- Instagram: @${brand.instagram_handle}`);
  }

  if (brand.email_sender_name) {
    sections.push(`\n## Email Settings\n- Sender name: ${brand.email_sender_name}`);
  }

  return sections.join("\n");
}
