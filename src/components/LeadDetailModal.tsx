'use client';

import { useEffect } from 'react';
import {
  CircleCheck,
  Clock,
  Globe,
  Mail,
  Minus,
  X,
  XCircle,
} from 'lucide-react';
import type { LeadWithId } from '@/lib/types';
import { getCategoryIcon } from '@/lib/category-icons';
import { formatScannedAt, phoneHref } from '@/lib/format';
import { buildMapsUrl } from '@/lib/maps';
import { MapsLink } from './MapsLink';
import { PhoneCell } from './PhoneCell';
import { ScoreBadge } from './ScoreBadge';
import { StatusBadge } from './StatusBadge';
import { WhyChips } from './WhyChips';

type BreakdownState = 'pass' | 'fail' | 'na';

interface BreakdownRow {
  key: string;
  label: string;
  detail?: string;
  state: BreakdownState;
}

function buildBreakdown(lead: LeadWithId): BreakdownRow[] {
  const rows: BreakdownRow[] = [
    {
      key: 'website',
      label: 'Sitio web encontrado',
      state: lead.hasWebsite ? 'pass' : 'fail',
    },
  ];

  if (!lead.hasWebsite) {
    rows.push(
      { key: 'pagespeed', label: 'Velocidad móvil (PageSpeed)', state: 'na', detail: 'No aplica — sin sitio web' },
      { key: 'viewport', label: 'Diseño responsive', state: 'na', detail: 'No aplica — sin sitio web' },
      { key: 'https', label: 'Conexión segura (HTTPS)', state: 'na', detail: 'No aplica — sin sitio web' },
      { key: 'copyright', label: 'Copyright actualizado', state: 'na', detail: 'No aplica — sin sitio web' }
    );
    return rows;
  }

  if (lead.pagespeedMobileScore === null || lead.pagespeedMobileScore === undefined) {
    rows.push({ key: 'pagespeed', label: 'Velocidad móvil (PageSpeed)', state: 'na', detail: 'No se pudo medir' });
  } else {
    rows.push({
      key: 'pagespeed',
      label: 'Velocidad móvil (PageSpeed)',
      state: lead.pagespeedMobileScore >= 50 ? 'pass' : 'fail',
      detail: `${lead.pagespeedMobileScore}/100`,
    });
  }

  rows.push({
    key: 'viewport',
    label: 'Diseño responsive (meta viewport)',
    state: lead.designSignals?.missingViewport ? 'fail' : 'pass',
  });

  rows.push({
    key: 'https',
    label: 'Conexión segura (HTTPS)',
    state: lead.designSignals?.noHttps ? 'fail' : 'pass',
  });

  if (!lead.designSignals?.copyrightYear) {
    rows.push({ key: 'copyright', label: 'Copyright actualizado', state: 'na', detail: 'No se encontró' });
  } else {
    rows.push({
      key: 'copyright',
      label: 'Copyright actualizado',
      state: lead.designSignals.oldCopyright ? 'fail' : 'pass',
      detail: `${lead.designSignals.copyrightYear}`,
    });
  }

  return rows;
}

function BreakdownIcon({ state }: { state: BreakdownState }) {
  if (state === 'pass') return <CircleCheck className="h-4 w-4 text-emerald-600" strokeWidth={2} />;
  if (state === 'fail') return <XCircle className="h-4 w-4 text-red-500" strokeWidth={2} />;
  return <Minus className="h-4 w-4 text-zinc-300" strokeWidth={2} />;
}

interface LeadDetailModalProps {
  lead: LeadWithId | null;
  onClose: () => void;
  onSend: (lead: LeadWithId) => void;
  onDismiss: (lead: LeadWithId) => void;
  busy: boolean;
  error?: string;
}

export function LeadDetailModal({ lead, onClose, onSend, onDismiss, busy, error }: LeadDetailModalProps) {
  useEffect(() => {
    if (!lead) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lead, onClose]);

  if (!lead) return null;

  const Icon = getCategoryIcon(lead.category);
  const breakdown = buildBreakdown(lead);
  const canSend = lead.status === 'pending_review' && !!lead.email;
  const tel = phoneHref(lead.phone);
  const mapsUrl = buildMapsUrl({ name: lead.name, city: lead.city, placeId: lead.placeId });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-black/10 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-lg font-semibold leading-tight">{lead.name}</h2>
              <p className="text-sm text-black/50">
                {lead.category} · {lead.address}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-black/40 hover:bg-black/5 hover:text-black/70 transition-colors"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-cr-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-cr-blue/90 transition-colors"
            >
              Ver en Google Maps
            </a>
            <ScoreBadge score={lead.score} tier={lead.tier} />
            <StatusBadge status={lead.status} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 p-3">
              <p className="text-xs text-black/40 mb-1">Teléfono</p>
              {tel ? (
                <a href={tel} className="text-sm font-medium text-cr-blue hover:underline">
                  {lead.phone}
                </a>
              ) : (
                <p className="text-sm text-zinc-300">—</p>
              )}
            </div>
            <div className="rounded-xl border border-black/10 p-3">
              <p className="text-xs text-black/40 mb-1">Sitio web</p>
              {lead.website ? (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-cr-blue hover:underline truncate"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">{lead.website}</span>
                </a>
              ) : (
                <p className="text-sm text-zinc-300">Sin sitio web</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">
              Por qué contactamos a este negocio
            </p>
            <WhyChips lead={lead} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">Desglose del puntaje</p>
            <div className="divide-y divide-black/5 rounded-xl border border-black/10">
              {breakdown.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <BreakdownIcon state={row.state} />
                    <span className="text-sm text-black/80">{row.label}</span>
                  </div>
                  {row.detail && <span className="text-xs text-black/40">{row.detail}</span>}
                </div>
              ))}
            </div>
          </div>

          {lead.emailBody && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">Correo generado</p>
              <div className="rounded-xl border border-black/10 bg-zinc-50 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-black/10 bg-white px-4 py-2.5">
                  <Mail className="h-3.5 w-3.5 text-black/40" strokeWidth={2} />
                  <span className="text-xs text-black/40">Para:</span>
                  <span className="text-xs font-medium text-black/70">{lead.email ?? 'sin correo detectado'}</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-black/90">{lead.emailSubject}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-black/70">{lead.emailBody}</p>
                </div>
              </div>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-xs text-black/40">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            Escaneado el {formatScannedAt(lead.scannedAt)}
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {lead.status === 'sent' && lead.sentAt && (
            <p className="text-sm text-emerald-700">Enviado el {formatScannedAt(lead.sentAt)}.</p>
          )}

          {lead.status === 'dismissed' && (
            <p className="text-sm text-black/50">Este lead fue descartado. No se enviará ningún correo.</p>
          )}

          {lead.status === 'pending_review' && !lead.email && (
            <p className="text-sm text-black/50">
              No se encontró un correo de contacto para este negocio, así que no se puede enviar.
            </p>
          )}

          {lead.status === 'pending_review' && (
            <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-4">
              {canSend && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSend(lead)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? 'Enviando...' : 'Enviar ahora'}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => onDismiss(lead)}
                className="text-sm font-medium text-black/50 hover:text-black/80 disabled:opacity-40 transition-colors"
              >
                Descartar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
