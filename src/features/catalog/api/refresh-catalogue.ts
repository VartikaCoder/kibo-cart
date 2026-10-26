'use server';

import { updateTag } from 'next/cache';
import { CATALOGUE_TAG } from './get-catalogue';

/** Expires the cached catalogue so the next render fetches live data again (research R3). */
export async function refreshCatalogue(): Promise<void> {
  updateTag(CATALOGUE_TAG);
}
