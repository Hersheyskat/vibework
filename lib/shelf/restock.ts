import { seedShelfIfEmpty } from "./seed";

/**
 * Nightly restock entrypoint (Inngest cron).
 * Today: ensure the Zippy/PM shelf is seeded. Later: Batch API top-50 roles.
 */
export async function restockShelf(): Promise<{
  seeded: boolean;
  count: number;
  note: string;
}> {
  const result = await seedShelfIfEmpty();
  return {
    seeded: result.seeded,
    count: result.count,
    note: result.seeded
      ? "Seeded empty shelf with product-manager variants"
      : "Shelf already stocked; batch restock of top roles not yet wired",
  };
}
