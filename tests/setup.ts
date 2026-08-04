import fs from 'fs';
import os from 'os';
import path from 'path';

// server/db.ts resolves its SQLite file relative to process.cwd() at import time,
// so every test file gets an isolated throwaway data directory.
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'royals-test-'));
process.chdir(tempRoot);

process.env.JWT_SECRET = 'test_jwt_secret';
