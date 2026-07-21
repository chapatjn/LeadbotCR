import type { DesignSignals, Tier, Weakness } from './types';

export interface ScoreInput {
  hasWebsite: boolean;
  pagespeedScore: number | null;
  designOutdated: boolean;
}

export interface ScoreResult {
  score: number;
  tier: Tier;
  weaknesses: Weakness[];
}

/**
 * Scoring engine, implemented literally to the product spec:
 *   - No website listed                 -> +50 (and PageSpeed/design checks
 *                                          are skipped entirely, per spec)
 *   - Website exists but PageSpeed
 *     mobile score < 50                 -> +30
 *   - Website exists with outdated
 *     design signals (missing viewport,
 *     no HTTPS, or old copyright year)  -> +20
 *
 * Tiers: high 70-100 (auto-send), medium 40-69 (review queue), low 0-39
 * (skipped).
 *
 * NOTE: because the "no website" branch explicitly skips the other two
 * checks, and a "has website" lead can score at most 30+20=50, the maximum
 * achievable score under these exact rules is 50 — meaning every lead lands
 * in "medium" at best and the "high / auto-send" tier can never actually be
 * reached. This is a mathematical consequence of the spec as written, not a
 * bug in this implementation. If you want the high tier to be reachable,
 * the most common fix is to award the design-outdated points to no-website
 * leads too (a business with no site at all trivially has no "modern"
 * design), which would put them at 70. See the README for how to flip that
 * with a one-line change if desired.
 */
export function scoreLead(input: ScoreInput): ScoreResult {
  const { hasWebsite, pagespeedScore, designOutdated } = input;

  let score = 0;
  const weaknesses: Weakness[] = [];

  if (!hasWebsite) {
    score += 50;
    weaknesses.push({ code: 'no_website', label: 'no tiene sitio web' });
  } else {
    if (pagespeedScore !== null && pagespeedScore < 50) {
      score += 30;
      weaknesses.push({ code: 'slow_mobile', label: 'su sitio carga lento en móviles' });
    }
    if (designOutdated) {
      score += 20;
      weaknesses.push({ code: 'outdated_design', label: 'su diseño parece desactualizado' });
    }
  }

  const tier: Tier = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return { score, tier, weaknesses };
}

export function summarizeDesignOutdated(signals: DesignSignals | null): boolean {
  if (!signals) return false;
  return signals.missingViewport || signals.noHttps || signals.oldCopyright;
}
