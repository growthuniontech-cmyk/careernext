import tech from "@/data/taxonomy/tech.json";
import marketing from "@/data/taxonomy/marketing.json";
import productDesign from "@/data/taxonomy/product-design.json";
import salesCs from "@/data/taxonomy/sales-cs.json";
import operations from "@/data/taxonomy/operations.json";
import finance from "@/data/taxonomy/finance.json";
import hr from "@/data/taxonomy/hr.json";
import contentOther from "@/data/taxonomy/content-other.json";

export type TaxonomyRole = {
  slug: string;
  title: string;
  category: string;
  description: string;
  skills: string[];
  tools: string[];
  keywords: string[];
};

/** The full role taxonomy as authored seed data. The Supabase `roles` table is
 *  seeded from this via `npm run seed`; API routes read from the DB and fall
 *  back to this in-memory copy only if the table is empty. */
export const TAXONOMY: TaxonomyRole[] = [
  ...tech,
  ...marketing,
  ...productDesign,
  ...salesCs,
  ...operations,
  ...finance,
  ...hr,
  ...contentOther,
];
