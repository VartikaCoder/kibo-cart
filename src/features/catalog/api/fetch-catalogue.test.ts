import { server } from '@/test/msw/server';
import { apiProduct, productsHandlers, validProducts } from '@/test/msw/handlers';
import snapshot from './snapshot.json';
import { CatalogueUnavailableError } from './catalogue-unavailable-error';
import { type FallbackLoader, fetchCatalogue } from './fetch-catalogue';
import snapshotMeta from './snapshot.meta.json';

let warn: jest.SpyInstance;
beforeEach(() => {
  // Dev warnings are part of the contract; capture them so they're asserted, not printed.
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const failingSources = [
  ['HTTP 500', productsHandlers.serverError, { kind: 'http-error', status: 500 }],
  ['HTTP 403', productsHandlers.forbidden, { kind: 'http-error', status: 403 }],
  ['a non-JSON body', productsHandlers.malformedJson, { kind: 'invalid-json' }],
  ['JSON that is not an array', productsHandlers.notAnArray, { kind: 'not-an-array' }],
  ['an empty array', productsHandlers.empty, { kind: 'no-valid-items', received: 0 }],
  ['a network error', productsHandlers.networkError, expect.objectContaining({ kind: 'network-error' })],
] as const;

describe('fetchCatalogue — live', () => {
  it('returns live products with prices converted to cents', async () => {
    const catalogue = await fetchCatalogue();

    expect(catalogue.source).toBe('live');
    expect(catalogue.products.map((p) => [p.id, p.priceCents])).toEqual([
      [1, 10995],
      [2, 2230],
      [9, 6400],
    ]);
    expect(catalogue.products[0]).toEqual({
      id: 1,
      title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
      priceCents: 10995,
      description: 'Your perfect pack for everyday use and walks in the forest.',
      category: "men's clothing",
      imageUrl: 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_t.png',
      rating: { rate: 3.9, count: 120 },
    });
  });

  it('derives unique, sorted categories', async () => {
    const catalogue = await fetchCatalogue();
    expect(catalogue.categories).toEqual(['electronics', "men's clothing"]);
  });

  it('drops invalid items, keeps valid ones, and warns in dev', async () => {
    server.use(
      productsHandlers.success([
        validProducts[0],
        apiProduct({ id: 2, price: -1 }),
        apiProduct({ id: 3, image: 'https://evil.example/x.png' }),
        null,
        validProducts[1],
      ]),
    );

    const catalogue = await fetchCatalogue();

    expect(catalogue.source).toBe('live');
    expect(catalogue.products.map((p) => p.id)).toEqual([1, 2]);
    const dropped = warn.mock.calls.map(([message]) => message);
    expect(dropped).toEqual([
      expect.stringContaining('index 1'),
      expect.stringContaining('index 2'),
      expect.stringContaining('index 3'),
    ]);
  });

  it('keeps the first item for a duplicated id, drops later ones, and warns in dev', async () => {
    server.use(
      productsHandlers.success([
        apiProduct({ id: 1, title: 'First' }),
        apiProduct({ id: 2, title: 'Other' }),
        apiProduct({ id: 1, title: 'Second' }),
        apiProduct({ id: 1, title: 'Third' }),
      ]),
    );

    const catalogue = await fetchCatalogue();

    expect(catalogue.products.map((p) => [p.id, p.title])).toEqual([
      [1, 'First'],
      [2, 'Other'],
    ]);
    const dropped = warn.mock.calls.map(([message]) => message);
    expect(dropped).toEqual([
      expect.stringContaining('duplicate id 1 at index 2'),
      expect.stringContaining('duplicate id 1 at index 3'),
    ]);
  });

  it('treats an invalid first item as absent, so a later valid item with that id is kept', async () => {
    server.use(productsHandlers.success([apiProduct({ id: 1, price: -1 }), apiProduct({ id: 1, title: 'Valid' })]));

    const catalogue = await fetchCatalogue();

    expect(catalogue.products.map((p) => p.title)).toEqual(['Valid']);
  });

  it('keeps a <script> title as text', async () => {
    server.use(productsHandlers.success([apiProduct({ title: '<script>alert(1)</script>' })]));
    const catalogue = await fetchCatalogue();
    expect(catalogue.products[0].title).toBe('<script>alert(1)</script>');
  });
});

describe('fetchCatalogue — snapshot fallback', () => {
  it.each(failingSources)('falls back to the bundled snapshot on %s and reports why', async (_label, handler, reason) => {
    server.use(handler());

    const catalogue = await fetchCatalogue();

    expect(catalogue).toMatchObject({ source: 'snapshot', fallbackReason: reason });
    expect(catalogue.products).toHaveLength(snapshot.length);
  });

  it('falls back when every live item is invalid', async () => {
    server.use(productsHandlers.success([apiProduct({ id: 0 }), apiProduct({ title: '' })]));

    const catalogue = await fetchCatalogue();

    expect(catalogue).toMatchObject({ source: 'snapshot', fallbackReason: { kind: 'no-valid-items', received: 2 } });
  });

  it('falls back on timeout', async () => {
    server.use(productsHandlers.hang());

    const catalogue = await fetchCatalogue({ timeoutMs: 50 });

    expect(catalogue).toMatchObject({ source: 'snapshot', fallbackReason: { kind: 'timeout' } });
  });

  it('validates the fallback with the same rules as live data', async () => {
    server.use(productsHandlers.serverError());
    const fallback = async () => ({
      payload: [apiProduct({ id: 7 }), apiProduct({ id: 8, price: Number.NaN })],
      capturedAt: null,
    });

    const catalogue = await fetchCatalogue({ fallback });

    expect(catalogue.products.map((p) => p.id)).toEqual([7]);
  });

  it('reports when the bundled snapshot was captured, from its metadata file', async () => {
    server.use(productsHandlers.serverError());
    const catalogue = await fetchCatalogue();
    expect(catalogue).toMatchObject({ source: 'snapshot', capturedAt: snapshotMeta.capturedAt });
  });

  it.each([null, 'yesterday', '2026-13-45T00:00:00Z', 1793034753000])(
    'reports capturedAt as null when the fallback’s timestamp is %p',
    async (capturedAt) => {
      server.use(productsHandlers.serverError());
      const catalogue = await fetchCatalogue({ fallback: async () => ({ payload: validProducts, capturedAt }) });
      expect(catalogue).toMatchObject({ source: 'snapshot', capturedAt: null });
    },
  );

  it('uses the real snapshot, which converts every price to integer cents', async () => {
    server.use(productsHandlers.serverError());

    const catalogue = await fetchCatalogue();

    expect(catalogue.products.every((p) => Number.isInteger(p.priceCents))).toBe(true);
    expect(catalogue.products.map((p) => p.id)).toEqual(snapshot.map((p) => p.id));
  });
});

describe('fetchCatalogue — unavailable', () => {
  it('throws CatalogueUnavailableError when the fallback is disabled', async () => {
    server.use(productsHandlers.serverError());

    const error = await fetchCatalogue({ fallback: null }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CatalogueUnavailableError);
    expect(error).toMatchObject({
      liveFailure: { kind: 'http-error', status: 500 },
      fallbackFailure: { kind: 'disabled' },
    });
  });

  it('does not touch the fallback when live succeeds', async () => {
    const fallback = jest.fn(async () => ({ payload: validProducts, capturedAt: null }));
    await fetchCatalogue({ fallback });
    expect(fallback).not.toHaveBeenCalled();
  });

  it.each<[string, FallbackLoader, object]>([
    ['yields no valid items', async () => ({ payload: [apiProduct({ id: -1 })], capturedAt: null }), { kind: 'no-valid-items', received: 1 }],
    ['is not an array', async () => ({ payload: {}, capturedAt: null }), { kind: 'not-an-array' }],
    ['fails to load', async () => Promise.reject(new Error('ENOENT')), { kind: 'load-error', message: 'ENOENT' }],
  ])('throws CatalogueUnavailableError when the fallback %s', async (_label, fallback, fallbackFailure) => {
    server.use(productsHandlers.forbidden());

    const error = await fetchCatalogue({ fallback }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CatalogueUnavailableError);
    expect(error).toMatchObject({ liveFailure: { kind: 'http-error', status: 403 }, fallbackFailure });
  });
});
