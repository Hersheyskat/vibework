/**
 * Seed ready_days from the Zippy example (3 variants × catalog roles @ medium).
 * Usage: npx tsx --env-file=.env.local scripts/seed-shelf.ts
 */
import { seedShelfIfEmpty } from "../lib/shelf/seed";

async function main() {
  const result = await seedShelfIfEmpty();
  console.log(
    result.seeded
      ? `Seeded ${result.count} ready_days rows.`
      : `Shelf already has ${result.count} rows — skipped.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
