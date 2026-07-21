import { CalendarClock, Gauge, Globe, ShieldAlert, Smartphone, type LucideIcon } from 'lucide-react';
import type { LeadWithId } from './types';

export interface ReasonChip {
  key: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Derives the individual "why we reached out" reasons for a lead. This is
 * more granular than the stored `weaknesses` array (which bundles missing
 * viewport / no HTTPS / old copyright into a single "outdated_design"
 * scoring signal worth +20) — here each of those three is broken back out
 * into its own chip using the raw `designSignals` already captured during
 * the scan, since that's a nicer, more informative reading for a reviewer
 * than showing one generic "outdated design" chip.
 */
export function getReasonChips(lead: LeadWithId): ReasonChip[] {
  const reasons: ReasonChip[] = [];

  if (!lead.hasWebsite) {
    reasons.push({ key: 'no_website', label: 'Sin sitio web', icon: Globe });
    return reasons;
  }

  if (lead.pagespeedMobileScore !== null && lead.pagespeedMobileScore !== undefined && lead.pagespeedMobileScore < 50) {
    reasons.push({ key: 'slow_mobile', label: 'Carga lenta en móvil', icon: Gauge });
  }

  if (lead.designSignals?.oldCopyright) {
    reasons.push({ key: 'outdated_design', label: 'Diseño desactualizado', icon: CalendarClock });
  }

  if (lead.designSignals?.noHttps) {
    reasons.push({ key: 'no_ssl', label: 'Sin SSL', icon: ShieldAlert });
  }

  if (lead.designSignals?.missingViewport) {
    reasons.push({ key: 'not_mobile_friendly', label: 'No apto para móviles', icon: Smartphone });
  }

  return reasons;
}
