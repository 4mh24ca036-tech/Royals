// Shared SQLite (sql.js) query helpers used by all route modules.

export function queryAll(db: any, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(db: any, sql: string, params: any[] = []): any | null {
  const rows = queryAll(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}
