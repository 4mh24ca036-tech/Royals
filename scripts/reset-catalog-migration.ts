/**
 * Resets the catalog_images migration flag so the fixed migration re-runs
 * on next server start. Run ONCE with the server stopped.
 */
import { getDb, persistDb } from '../server/db.js';

const db = await getDb();
db.run("DELETE FROM app_migrations WHERE id = 'catalog_images_v2_20260807'");
persistDb();
console.log('Reset catalog_images_v2_20260807 migration flag. Restart the server to re-run.');
process.exit(0);
