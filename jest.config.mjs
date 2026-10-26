import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const shared = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // The real guard throws outside the `react-server` export condition, which Jest doesn't use.
    '^server-only$': '<rootDir>/node_modules/server-only/empty.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
};

// MSW 2 depends on ESM-only packages; let SWC compile them. next/jest offers no hook for this short of
// `transpilePackages` in next.config, which would also change the app build, so patch the resolved config.
const ESM_ONLY_PACKAGES = ['rettime', 'until-async', '@open-draft/deferred-promise'];

export default async function jestConfig() {
  const resolved = await createJestConfig(shared)();
  const base = {
    ...resolved,
    transformIgnorePatterns: resolved.transformIgnorePatterns.map((pattern) =>
      pattern.replace('(?!(geist|', `(?!(${ESM_ONLY_PACKAGES.join('|')}|geist|`),
    ),
  };

  return {
    // Two environments, chosen by file name: `*.test.ts` runs in node (domain, lib, schemas, catalogue
    // fetch via MSW); `*.test.tsx` (components) and `*.dom.test.ts` (non-React code that needs browser
    // APIs such as localStorage and storage events) run in jsdom.
    projects: [
      {
        ...base,
        displayName: 'node',
        testEnvironment: 'node',
        testMatch: ['<rootDir>/src/**/*.test.ts'],
        testPathIgnorePatterns: [...base.testPathIgnorePatterns, '\\.dom\\.test\\.ts$'],
        setupFilesAfterEnv: ['<rootDir>/src/test/setup-node.ts'],
      },
      {
        ...base,
        displayName: 'dom',
        testEnvironment: 'jsdom',
        testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/**/*.dom.test.ts'],
        setupFilesAfterEnv: ['<rootDir>/src/test/setup-dom.ts'],
        clearMocks: true,
      },
    ],
    coverageProvider: 'v8',
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/**/*.test.{ts,tsx}',
      '!src/test/**',
      '!src/app/**',
      '!src/**/index.ts',
      '!src/features/*/client.ts', // re-export-only public surface, like index.ts
      '!src/**/types.ts', // type-only modules; no runtime code to cover
      // Need the Next runtime ('use cache', cacheLife, updateTag); exercised by the build and E2E, not Jest.
      '!src/features/catalog/api/get-catalogue.ts',
      '!src/features/catalog/api/refresh-catalogue.ts',
    ],
    coverageThreshold: {
      global: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  };
}
