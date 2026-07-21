// Google PageSpeed Insights API integration.
// Uses PAGESPEED_API_KEY, which is typically the same Google Cloud API key
// as GOOGLE_PLACES_API_KEY, but kept as its own env var per spec so it can
// be pointed at a different project/quota independently if needed.

const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Returns the mobile performance score (0-100) for a given URL, or null if
 * the check could not be completed (invalid URL, PSI error, timeout, etc).
 * A null result is treated as "unknown" and does not contribute points to
 * the scoring engine — it is not the same as a low score.
 *
 * Real-world Lighthouse mobile audits routinely take 30-60+ seconds for
 * actual production sites (a trivial static page returns almost instantly,
 * but that's not representative). An earlier 30s timeout was silently
 * discarding the vast majority of real results — every genuinely slow site
 * (the exact thing this check exists to catch) was timing out before PSI
 * could finish, so `pagespeedScore` came back null and the "slow load"
 * scoring signal never fired. 45s covers the large majority of real sites
 * observed in testing.
 */
export async function getMobilePagespeedScore(websiteUrl: string): Promise<number | null> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno PAGESPEED_API_KEY.');
  }

  const url = new URL(PSI_URL);
  url.searchParams.set('url', websiteUrl);
  url.searchParams.set('strategy', 'mobile');
  url.searchParams.set('category', 'performance');
  url.searchParams.set('key', apiKey);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;

    if (typeof score !== 'number') return null;
    return Math.round(score * 100);
  } catch {
    return null;
  }
}
