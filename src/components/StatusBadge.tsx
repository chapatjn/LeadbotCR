import { CircleCheck, Clock, MailX, OctagonX, SkipForward } from 'lucide-react';
import type { LeadStatus } from '@/lib/types';

const STATUS_STYLES: Record<LeadStatus, string> = {
  sent: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  send_failed: 'bg-red-100 text-red-800 border-red-300',
  no_email: 'bg-zinc-100 text-zinc-600 border-zinc-300',
  pending_review: 'bg-amber-100 text-amber-800 border-amber-300',
  not_qualified: 'bg-zinc-100 text-zinc-500 border-zinc-300',
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  sent: 'Enviado',
  send_failed: 'Falló el envío',
  no_email: 'Sin correo',
  pending_review: 'Pendiente de revisión',
  not_qualified: 'No calificado',
};

const STATUS_ICONS: Record<LeadStatus, typeof CircleCheck> = {
  sent: CircleCheck,
  send_failed: OctagonX,
  no_email: MailX,
  pending_review: Clock,
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
