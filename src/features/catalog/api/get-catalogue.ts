import { cacheLife, cacheTag } from 'next/cache';
import type { Catalogue } from '../types';
import { fetchCatalogue } from './fetch-catalogue';

export const CATALOGUE_TAG = 'catalogue';

/**
 * Cached wrapper (research R3). A live (or fixture) result is kept for hours. A snapshot result gets a short
 * lifetime so the app picks up the live API soon after it recovers. Errors are not cached.
 */
export async function getCatalogue(): Promise<Catalogue> {
  'use cache';
  cacheTag(CATALOGUE_TAG);

  const catalogue = await fetchCatalogue();
  if (catalogue.source === 'snapshot') {
    cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  } else {
    cacheLife('hours'); // live, or the fixture (which never changes)
  }
  return catalogue;
}
