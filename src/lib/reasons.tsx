import { CalendarClock, Gauge, Globe, ShieldAlert, Smartphone, type LucideIcon } from 'lucide-react';
import type { LeadWithId } from './types';

export interface ReasonChip {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
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
    reasons.push({
      key: 'no_website',
      label: 'Sin sitio web',
      icon: Globe,
      description:
        'Google no tiene ningún sitio web registrado para este negocio. Es la señal más fuerte de baja presencia digital (+50 puntos).',
    });
    return reasons;
  }

  if (lead.pagespeedMobileScore !== null && lead.pagespeedMobileScore !== undefined && lead.pagespeedMobileScore < 50) {
    reasons.push({
      key: 'slow_mobile',
      label: 'Carga lenta en móvil',
      icon: Gauge,
      description: `Su sitio obtuvo ${lead.pagespeedMobileScore}/100 en la prueba de velocidad móvil de Google PageSpeed (menos de 50 se considera lento). Un sitio lento hace que los visitantes se vayan antes de cargar (+30 puntos).`,
    });
  }

  if (lead.designSignals?.oldCopyright) {
    reasons.push({
      key: 'outdated_design',
      label: 'Diseño desactualizado',
      icon: CalendarClock,
      description: `El pie de página muestra un año de copyright de ${lead.designSignals.copyrightYear}, hace más de 2 años — señal de que el sitio no se ha actualizado recientemente.`,
    });
  }

  if (lead.designSignals?.noHttps) {
    reasons.push({
      key: 'no_ssl',
      label: 'Sin SSL',
      icon: ShieldAlert,
      description:
        'El sitio no usa una conexión segura HTTPS. Los navegadores marcan esto como "no seguro", lo cual reduce la confianza de los visitantes.',
    });
  }

  if (lead.designSignals?.missingViewport) {
    reasons.push({
      key: 'not_mobile_friendly',
      label: 'No apto para móviles',
      icon: Smartphone,
      description:
        'El sitio no tiene una etiqueta "meta viewport", lo que generalmente significa que no se adapta bien a pantallas de celular.',
    });
  }

  return reasons;
}
