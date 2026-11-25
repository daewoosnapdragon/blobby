// Resets and seeds the e2e database. Run by playwright.config.ts's webServer command before the app starts.
import { resetTestDb } from '../integration/helpers/db';
import { seed, seedPlan, E2E_DATABASE_URL } from './fixtures/seed';

(async () => {
  const sql = await resetTestDb(E2E_DATABASE_URL);
  await seed(sql);
  await seedPlan(sql);
  await sql.end();
})().catch((e) => { console.error(e instanceof Error ? e.message : 'e2e db setup failed'); process.exit(1); });
