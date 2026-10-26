import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  // Node env only for now (domain, lib, schemas, catalogue fetch via MSW). A jsdom project is added with the first component test.
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup-node.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // The real guard throws outside the `react-server` export condition, which Jest doesn't use.
    '^server-only$': '<rootDir>/node_modules/server-only/empty.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/app/**',
    '!src/**/index.ts',
    '!src/**/types.ts', // type-only modules; no runtime code to cover
    // Needs the Next runtime ('use cache', cacheLife); exercised by the build and E2E, not Jest.
    '!src/features/catalog/api/get-catalogue.ts',
  ],
  coverageThreshold: {
    global: { lines: 80, branches: 80, functions: 80, statements: 80 },
  },
};

// MSW 2 depends on ESM-only packages; let SWC compile them. next/jest offers no hook for this short of
// `transpilePackages` in next.config, which would also change the app build, so patch the resolved config.
const ESM_ONLY_PACKAGES = ['rettime', 'until-async', '@open-draft/deferred-promise'];

export default async function jestConfig() {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    transformIgnorePatterns: resolved.transformIgnorePatterns.map((pattern) =>
      pattern.replace('(?!(geist|', `(?!(${ESM_ONLY_PACKAGES.join('|')}|geist|`),
    ),
  };
}
