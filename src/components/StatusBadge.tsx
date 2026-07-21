import { CircleCheck, Clock, SkipForward, XCircle } from 'lucide-react';
import type { LeadStatus } from '@/lib/types';

const STATUS_STYLES: Record<LeadStatus, string> = {
  pending_review: 'bg-amber-100 text-amber-800 border-amber-300',
  sent: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  dismissed: 'bg-zinc-100 text-zinc-500 border-zinc-300',
  not_qualified: 'bg-zinc-100 text-zinc-500 border-zinc-300',
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  pending_review: 'Pendiente de revisión',
  sent: 'Enviado',
  dismissed: 'Descartado',
  not_qualified: 'No calificado',
};

const STATUS_ICONS: Record<LeadStatus, typeof CircleCheck> = {
  pending_review: Clock,
  sent: CircleCheck,
  dismissed: XCircle,
  not_qualified: SkipForward,
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const Icon = STATUS_ICONS[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} />
      {STATUS_LABELS[status]}
    </span>
  );
}
