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
    return data;
  }

  // Token never became valid in time — treat as "no more pages" rather than failing the whole scan.
  return { status: 'ZERO_RESULTS', results: [] };
}

/**
 * city === null means an all-Costa-Rica search (no city filter). Paginates
 * through Places Text Search (via next_page_token) until maxResults is
 * reached or Google runs out of pages (capped at 3 pages / ~60 results).
 */
export async function searchPlaces(
  category: string,
  city: string | null,
  maxResults: number
): Promise<PlaceSearchResult[]> {
  const apiKey = requireApiKey();
  const query = city ? `${category} en ${city}, Costa Rica` : `${category} in Costa Rica`;

  const collected: PlaceSearchResult[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  do {
    let data: any;

    if (pageToken) {
      data = await fetchPageWithToken(pageToken, apiKey);
    } else {
      const url = new URL(TEXT_SEARCH_URL);
      url.searchParams.set('query', query);
      url.searchParams.set('region', 'cr');
      url.searchParams.set('key', apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Google Places Text Search respondió ${res.status}`);
      data = await res.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`);
      }
    }

    collected.push(...mapResults(data.results ?? []));
    pageToken = data.next_page_token;
    pageCount++;
  } while (pageToken && collected.length < maxResults && pageCount < 3);

  return collected.slice(0, maxResults);
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = requireApiKey();

  const url = new URL(PLACE_DETAILS_URL);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'website,formatted_phone_number,international_phone_number');
  url.searchParams.set('key', apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return { website: null, phone: null };

    const data = await res.json();
    if (data.status !== 'OK') return { website: null, phone: null };

    const result = data.result ?? {};
    return {
      website: result.website ?? null,
      phone: result.formatted_phone_number ?? result.international_phone_number ?? null,
    };
  } catch {
    return { website: null, phone: null };
  }
}
