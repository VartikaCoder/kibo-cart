/**
 * A stand-in App Router for component tests. `next/navigation` is framework code, not ours: outside a
 * mounted App Router `useRouter()` throws, so tests that render navigating components mock it with:
 *
 *   jest.mock('next/navigation', () => jest.requireActual('@/test/next-navigation').nextNavigationMock);
 *
 * and assert on `router.push` / `router.replace` / `router.refresh` — i.e. where the user is sent.
 */
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
};

export const nextNavigationMock = {
  useRouter: () => router,
};
