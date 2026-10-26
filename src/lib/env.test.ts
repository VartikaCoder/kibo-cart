import { catalogueSourceMode } from './env';

describe('catalogueSourceMode', () => {
  it.each([
    [undefined, 'live'],
    ['', 'live'],
    ['fixture', 'fixture'],
  ])('CATALOGUE_SOURCE=%p → %p', (value, expected) => {
    expect(catalogueSourceMode({ CATALOGUE_SOURCE: value })).toBe(expected);
  });

  it.each(['fixtures', 'FIXTURE', 'live', 'fixture-large'])('throws on unsupported value %p', (value) => {
    expect(() => catalogueSourceMode({ CATALOGUE_SOURCE: value })).toThrow(/Unknown CATALOGUE_SOURCE/);
  });
});
