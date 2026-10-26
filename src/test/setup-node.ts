import { server } from './msw/server';

// Any request without a handler is a test bug, not a silent pass-through to the real API.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
