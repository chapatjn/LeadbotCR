'use client';

import { MapPin } from 'lucide-react';
import { buildMapsUrl } from '@/lib/maps';

interface MapsLinkProps {
  name: string;
  city: string;
  placeId?: string | null;
  variant?: 'inline' | 'button';
}

export function MapsLink({ name, city, placeId, variant = 'inline' }: MapsLinkProps) {
  const href = buildMapsUrl({ name, city, placeId });

  if (variant === 'button') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-2 rounded-lg bg-cr-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-cr-blue/90 transition-colors"
      >
        <MapPin className="h-4 w-4" strokeWidth={2} />
        Ver en Google Maps
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm text-zinc-700">
      {city}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`Ver ${name} en Google Maps`}
        title="Abrir en Google Maps"
        onClick={(e) => e.stopPropagation()}
        className="text-zinc-400 hover:text-cr-blue transition-colors"
      >
        <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
      </a>
    </span>
  );
}
