import { TrendingUp, Minus, TrendingDown } from 'lucide-react';
import type { Tier } from '@/lib/types';

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

export function ScoreBadge({ score, tier }: { score: number; tier: Tier }) {
  const Icon = TIER_ICONS[tier];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIER_STYLES[tier]}`}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} />
      {score} · {TIER_LABELS[tier]}
    </span>
  );
}
