import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vitest/config';

// Server modules import sibling modules with ESM '.js' specifiers that actually
// resolve to '.ts' sources at runtime (via tsx). Map them back for Vite.
const tsFromJsSpecifiers = {
  name: 'ts-from-js-specifiers',
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (!importer || !source.startsWith('.') || !source.endsWith('.js')) {
      return null;
    }
    const candidate = path.resolve(path.dirname(importer), `${source.slice(0, -3)}.ts`);
    return fs.existsSync(candidate) ? candidate : null;
  }
};

export default defineConfig({
  plugins: [tsFromJsSpecifiers],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['server/**/*.ts', 'src/services/**/*.ts']
    }
  }
});
