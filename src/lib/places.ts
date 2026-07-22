// Google Places API integration.
//
// Note: the Places API (Text Search / Place Details) does not return business
// email addresses under any field mask — Google simply doesn't expose that
// data. So `email` is never populated from this module. The app makes a
// best-effort attempt to recover a contact email later, by scraping the
// business's own website HTML for a `mailto:` link or an email pattern (see
// design-check.ts). Businesses with no website and no visible email on any
// page will remain email-less, which is expected and handled gracefully
// downstream (logged, not sent).

import { requireEnv } from './env';
import { CR_CITIES } from './constants';

const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
}

export interface PlaceDetails {
  website: string | null;
  phone: string | null;
}

export interface PlaceWithDetails {
  place: PlaceSearchResult;
  details: PlaceDetails;
}

function requireApiKey(): string {
  return requireEnv('GOOGLE_PLACES_API_KEY');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapResults(results: any[]): PlaceSearchResult[] {
  return results
    .filter((r) => r.place_id && r.name)
    .map((r) => ({
      placeId: r.place_id as string,
      name: r.name as string,
      address: (r.formatted_address as string) ?? '',
    }));
}

/**
 * A single Google Places Text Search query caps out at ~60 results (3
 * pages), no matter how big the area is. To search deeper we issue several
 * differently-worded queries and dedupe the results by placeId:
 *
 * - For a specific city: a few phrasing variants, since Google returns a
 *   different top-60 ranking per phrasing and real businesses missed by the
 *   first wording commonly turn up in the others.
 * - For "Todo Costa Rica" (city === null): instead of one generic
 *   nationwide query (which is Google-relevance-biased toward whichever
 *   area it considers most prominent, usually San José), search each major
 *   city individually plus a generic catch-all for anything outside them.
 *   This is the difference between a shallow, big-city-only sweep and one
 *   that actually covers the country.
 */
function buildQueryVariants(category: string, city: string | null): string[] {
  if (city) {
    return [
      `${category} en ${city}, Costa Rica`,
      `${category} cerca de ${city}, Costa Rica`,
      `mejores ${category} en ${city}, Costa Rica`,
    ];
  }

  return [...CR_CITIES.map((c) => `${category} en ${c}, Costa Rica`), `${category} in Costa Rica`];
}

async function fetchFirstPage(query: string, apiKey: string): Promise<any> {
  const url = new URL(TEXT_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('region', 'cr');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google Places Text Search respondió ${res.status}`);
  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`);
  }

  return data;
}

function assertSearchResponse(data: any, context: string) {
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(
      `Google Places error durante ${context}: ${data.status ?? 'respuesta inválida'}` +
        `${data.error_message ? ` — ${data.error_message}` : ''}`
    );
  }
}

/**
 * Text Search only returns up to 20 results per request. Getting more
 * requires re-issuing the request with a `pagetoken`, and Google's docs
 * note the token can take a few seconds to become valid — an immediate
 * retry commonly comes back INVALID_REQUEST, so we back off and retry a
 * couple of times before giving up on that page.
 */
async function fetchPageWithToken(pageToken: string, apiKey: string): Promise<any> {
  const url = new URL(TEXT_SEARCH_URL);
  url.searchParams.set('pagetoken', pageToken);
  url.searchParams.set('key', apiKey);

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(1500);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Google Places Text Search respondió ${res.status}`);
    const data = await res.json();
    if (data.status === 'INVALID_REQUEST') continue; // token not ready yet — retry
    assertSearchResponse(data, 'la paginación');
    return data;
  }

  // Token never became valid in time — treat as "no more pages" rather than failing the whole scan.
  return { status: 'ZERO_RESULTS', results: [] };
}

/**
 * city === null means an all-Costa-Rica search (no city filter). Runs
 * buildQueryVariants' list of queries one after another — each paginated
 * through Places Text Search (via next_page_token, capped at 3 pages /
 * ~60 results per query, a hard Google limit) — merging results and
 * deduping by placeId, until maxResults is reached or every variant is
 * exhausted. onProgress fires after each variant so long, deep scans can
 * show which area/phrasing is currently being searched.
 */
export async function searchPlaces(
  category: string,
  city: string | null,
  maxResults: number,
  onProgress?: (variantLabel: string, foundSoFar: number) => void
): Promise<PlaceSearchResult[]> {
  const apiKey = requireApiKey();
  const variants = buildQueryVariants(category, city);

  const seen = new Set<string>();
  const collected: PlaceSearchResult[] = [];

  for (const query of variants) {
    if (collected.length >= maxResults) break;

    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      const data = pageToken ? await fetchPageWithToken(pageToken, apiKey) : await fetchFirstPage(query, apiKey);

      for (const place of mapResults(data.results ?? [])) {
        if (!seen.has(place.placeId)) {
          seen.add(place.placeId);
          collected.push(place);
        }
      }

      pageToken = data.next_page_token;
      pageCount++;
    } while (pageToken && collected.length < maxResults && pageCount < 3);

    onProgress?.(query, collected.length);
  }

  return collected.slice(0, maxResults);
}

/**
 * Like searchPlaces, but only keeps businesses that have NO website listed
 * on Google — checking that requires a Place Details call per candidate, so
 * this fetches details for every business it encounters and filters as it
 * goes. Same multi-variant, deduped-by-placeId search as searchPlaces,
 * pulling additional pages/variants (up to the same 3-page/~60-result
 * Google cap per query) until it has `maxResults` qualifying businesses or
 * runs out of variants. Returns each accepted business along with the
 * details already fetched for it, so callers don't need to look them up
 * again.
 */
export async function searchPlacesWithoutWebsite(
  category: string,
  city: string | null,
  maxResults: number,
  onProgress?: (checked: number, accepted: number, variantLabel: string, lookupErrors: number) => void
): Promise<PlaceWithDetails[]> {
  const apiKey = requireApiKey();
  const variants = buildQueryVariants(category, city);

  const accepted: PlaceWithDetails[] = [];
  const seen = new Set<string>();
  let checked = 0;
  let lookupErrors = 0;

  for (const query of variants) {
    if (accepted.length >= maxResults) break;

    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      const data = pageToken ? await fetchPageWithToken(pageToken, apiKey) : await fetchFirstPage(query, apiKey);
      const pagePlaces = mapResults(data.results ?? []).filter((p) => !seen.has(p.placeId));
      pagePlaces.forEach((p) => seen.add(p.placeId));

      // A failed Details lookup must never be interpreted as "no website".
      // Keep processing the other candidates and only accept a business
      // when Google returned a successful Details response with no website.
      const pageDetails = await Promise.allSettled(pagePlaces.map((p) => getPlaceDetails(p.placeId)));

      for (let i = 0; i < pagePlaces.length; i++) {
        checked++;
        const detailResult = pageDetails[i];
        if (detailResult.status === 'rejected') {
          lookupErrors++;
          continue;
        }
        if (!detailResult.value.website) {
          accepted.push({ place: pagePlaces[i], details: detailResult.value });
        }
        if (accepted.length >= maxResults) break;
      }

      onProgress?.(checked, accepted.length, query, lookupErrors);

      pageToken = data.next_page_token;
      pageCount++;
    } while (pageToken && accepted.length < maxResults && pageCount < 3);
  }

  return accepted.slice(0, maxResults);
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = requireApiKey();

  const url = new URL(PLACE_DETAILS_URL);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'website,formatted_phone_number,international_phone_number');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Google Place Details respondió ${res.status} para ${placeId}`);
  }

  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(
      `Google Place Details error para ${placeId}: ${data.status ?? 'respuesta inválida'}` +
        `${data.error_message ? ` — ${data.error_message}` : ''}`
    );
  }

  const result = data.result ?? {};
  return {
    website: result.website ?? null,
    phone: result.formatted_phone_number ?? result.international_phone_number ?? null,
  };
}
