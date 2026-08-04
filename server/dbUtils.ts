import { Database } from 'sql.js';

export function queryAll(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    return results;
  } finally {
    stmt.free();
  }
}

/**
 * Parses a JSON-encoded column, reporting the offending column and row instead of
 * failing with a bare `Unexpected token` error.
 */
export function parseJsonColumn<T>(raw: unknown, column: string, rowId: unknown, fallback?: T): T {
  if (raw === null || raw === undefined || raw === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Column ${column} is empty for row ${String(rowId)}`);
  }
  try {
    return JSON.parse(String(raw)) as T;
  } catch (err) {
    throw new Error(
      `Corrupt JSON in column ${column} for row ${String(rowId)}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
