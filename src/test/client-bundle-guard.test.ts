import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Keeps Zod out of the browser's initial JavaScript (docs/performance-notes.md: it was 98 KB, ~25% of the
 * initial load for `/`). Every 'use client' module is imported with `zod` made to throw. A *static* import
 * anywhere in a client module's graph fails here. The saved-cart schema is loaded with a dynamic `import()`
 * only when a saved cart is read, which this deliberately allows.
 */

const SRC = join(__dirname, '..');

function clientModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : clientModules(path);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return /^\s*['"]use client['"]/.test(readFileSync(path, 'utf8')) ? [path] : [];
  });
}

const modules = clientModules(SRC).map((path) => relative(SRC, path));

describe('client bundle guard', () => {
  it('finds the client components it is guarding', () => {
    expect(modules).toEqual(
      expect.arrayContaining([
        'features/cart/components/cart-hydrator.tsx',
        'features/catalog/components/catalogue-filters.tsx',
      ]),
    );
  });

  it.each(modules)('%s does not statically import zod', (path) => {
    jest.isolateModules(() => {
      for (const entry of ['zod', 'zod/mini', 'zod/v4', 'zod/v4/mini']) {
        jest.doMock(entry, () => {
          throw new Error(`${entry} imported statically from a client module (see docs/performance-notes.md)`);
        });
      }
      expect(() => jest.requireActual(join(SRC, path))).not.toThrow();
    });
  });
});
