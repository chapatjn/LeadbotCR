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
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno GOOGLE_PLACES_API_KEY.');
  }
  return apiKey;
}

export async function searchPlaces(category: string, city: string): Promise<PlaceSearchResult[]> {
  const apiKey = requireApiKey();
  const query = `${category} en ${city}, Costa Rica`;

  const url = new URL(TEXT_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('region', 'cr');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Google Places Text Search respondió ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`);
  }

  const results = (data.results ?? []) as any[];

  return results
    .filter((r) => r.place_id && r.name)
    .map((r) => ({
      placeId: r.place_id as string,
      name: r.name as string,
      address: (r.formatted_address as string) ?? '',
    }));
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
