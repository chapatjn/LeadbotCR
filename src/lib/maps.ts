export function buildMapsUrl(params: { name: string; city: string; placeId?: string | null }): string {
  if (params.placeId) {
    const url = new URL('https://www.google.com/maps/place/');
    url.searchParams.set('q', `place_id:${params.placeId}`);
    return url.toString();
  }

  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${params.name} ${params.city} Costa Rica`);
  return url.toString();
}
