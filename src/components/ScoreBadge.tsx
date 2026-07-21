import { TrendingUp, Minus, TrendingDown } from 'lucide-react';
import type { Tier } from '@/lib/types';
import { Tooltip } from './Tooltip';

const TIER_STYLES: Record<Tier, string> = {
  high: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-zinc-100 text-zinc-600 border-zinc-300',
};

const TIER_LABELS: Record<Tier, string> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const TIER_ICONS: Record<Tier, typeof TrendingUp> = {
  high: TrendingUp,
  medium: Minus,
  low: TrendingDown,
};

const TIER_EXPLANATIONS: Record<Tier, string> = {
  high: 'Puntaje 70-100: la señal más fuerte posible según nuestras reglas. Buen candidato para contactar.',
  medium: 'Puntaje 40-69: se detectaron algunas debilidades reales en su presencia web. Vale la pena revisar el correo generado.',
  low: 'Puntaje 0-39: su presencia web ya parece bastante sólida, así que no se generó correo para este negocio.',
};

export function ScoreBadge({ score, tier }: { score: number; tier: Tier }) {
  const Icon = TIER_ICONS[tier];

  return (
    <Tooltip
      content={`El puntaje va de 0 a 100 y suma puntos por cada debilidad web detectada (sin sitio, carga lenta, diseño desactualizado). ${TIER_EXPLANATIONS[tier]}`}
    >
      <span
        className={`inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIER_STYLES[tier]}`}
      >
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} />
        {score} · {TIER_LABELS[tier]}
      </span>
    </Tooltip>
  );
}
