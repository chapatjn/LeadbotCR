import type { DesignSignals } from './types';

export interface DesignCheckResult {
  signals: DesignSignals;
  outdated: boolean;
  extractedEmail: string | null;
  fetchError: boolean;
}

/**
 * Fetches a business's homepage HTML and looks for outdated-design signals:
 *  - missing <meta name="viewport"> (not mobile-responsive)
 *  - not served over HTTPS
 *  - a copyright year more than 2 years old
 *
 * Also opportunistically extracts a contact email from the HTML (mailto:
 * link or a bare email pattern), since Google Places never returns one.
 */
export async function checkDesignSignals(websiteUrl: string): Promise<DesignCheckResult> {
  const noHttps = !websiteUrl.toLowerCase().startsWith('https://');

  let missingViewport = true;
  let oldCopyright = false;
  let copyrightYear: number | null = null;
  let extractedEmail: string | null = null;
  let fetchError = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LeadBotCR/1.0; +https://leadbotcr.example)',
      },
    });
    clearTimeout(timeout);

    const html = await res.text();

    missingViewport = !/<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);

    const copyrightMatch = html.match(/(?:©|&copy;|copyright)\s*(\d{4})/i);
    if (copyrightMatch) {
      copyrightYear = parseInt(copyrightMatch[1], 10);
      const currentYear = new Date().getFullYear();
      oldCopyright = currentYear - copyrightYear > 2;
    }

    const mailtoMatch = html.match(/mailto:([^"'?\s>]+)/i);
    if (mailtoMatch) {
      extractedEmail = mailtoMatch[1];
    } else {
      const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) extractedEmail = emailMatch[0];
    }
  } catch {
    fetchError = true;
    // If we couldn't even fetch the page, treat viewport as missing (worst
    // case) but don't guess at copyright; noHttps was already determined
    // from the URL scheme alone.
  }

  const outdated = missingViewport || noHttps || oldCopyright;

  return {
    signals: { missingViewport, noHttps, oldCopyright, copyrightYear },
    outdated,
    extractedEmail,
    fetchError,
  };
}
