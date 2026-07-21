'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, CircleCheck, Search, Send, Trash2 } from 'lucide-react';
import type { LeadStatus, LeadWithId } from '@/lib/types';
import { CategoryBadge } from './CategoryBadge';
import { EmailCell } from './EmailCell';
import { LeadDetailModal } from './LeadDetailModal';
import { MapsLink } from './MapsLink';
import { PhoneCell } from './PhoneCell';
import { ScoreBadge } from './ScoreBadge';
import { StatsBar } from './StatsBar';
import { Tooltip } from './Tooltip';
import { WhyChips } from './WhyChips';

const COLUMN_TOOLTIPS = {
  name: 'Nombre del negocio según Google. Haz clic en cualquier parte de la fila para ver el correo generado y más detalles.',
  category: 'Tipo de negocio, según la categoría con la que se hizo el escaneo.',
  location: 'Ciudad del negocio. El ícono de pin abre su ubicación en Google Maps en una pestaña nueva.',
  phone: 'Teléfono según la ficha de Google del negocio, si está disponible. Es un enlace directo para llamar.',
  email: 'Correo de contacto encontrado en el sitio web del negocio. No es el correo que generamos para el outreach — ese se ve dentro del detalle de cada lead.',
  why: 'Las debilidades específicas en su presencia web que hicieron que este negocio calificara como lead. Pasa el mouse sobre cada una para más detalle.',
  score: 'Puntaje de 0 a 100: suma puntos por cada debilidad web detectada. Entre más alto, más urgente es la necesidad de un sitio mejor.',
  action: 'Qué puedes hacer con este lead ahora mismo: enviar el correo generado, o ver si ya se envió, se descartó, o no calificó.',
};

const FILTERS: { key: 'all' | LeadStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending_review', label: 'Pendientes de revisión' },
  { key: 'sent', label: 'Enviados' },
  { key: 'dismissed', label: 'Descartados' },
  { key: 'not_qualified', label: 'No calificados' },
];

type SortField = 'score' | 'name' | 'status';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortField; label: string; defaultDir: SortDir }[] = [
  { key: 'score', label: 'Puntaje', defaultDir: 'desc' },
  { key: 'name', label: 'Nombre', defaultDir: 'asc' },
  { key: 'status', label: 'Estado', defaultDir: 'asc' },
];

export function LeadsReviewClient({ initialLeads }: { initialLeads: LeadWithId[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<'all' | LeadStatus>('all');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? leads : leads.filter((l) => l.status === filter)),
    [leads, filter]
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'score') cmp = a.score - b.score;
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  function setSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(SORT_OPTIONS.find((o) => o.key === field)!.defaultDir);
    }
  }

  async function handleSend(lead: LeadWithId) {
    setBusyId(lead.id);
    setErrorById((prev) => ({ ...prev, [lead.id]: '' }));
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Error al enviar.');

      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: 'sent', sentAt: data.sentAt } : l))
      );
    } catch (err: any) {
      setErrorById((prev) => ({ ...prev, [lead.id]: err?.message ?? 'Error al enviar.' }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(lead: LeadWithId) {
    setBusyId(lead.id);
    setErrorById((prev) => ({ ...prev, [lead.id]: '' }));
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Error al descartar.');

      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'dismissed' } : l)));
    } catch (err: any) {
      setErrorById((prev) => ({ ...prev, [lead.id]: err?.message ?? 'Error al descartar.' }));
    } finally {
      setBusyId(null);
    }
  }

  // Permanent delete — distinct from "dismiss" above, which just changes
  // status and keeps the lead visible under the "Descartados" filter. This
  // removes the document entirely, so it's confirmed first.
  async function handleDelete(lead: LeadWithId) {
    const confirmed = window.confirm(
      `¿Eliminar "${lead.name}" permanentemente? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setBusyId(lead.id);
    setErrorById((prev) => ({ ...prev, [lead.id]: '' }));
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Error al eliminar.');

      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      if (selectedLeadId === lead.id) setSelectedLeadId(null);
    } catch (err: any) {
      setErrorById((prev) => ({ ...prev, [lead.id]: err?.message ?? 'Error al eliminar.' }));
    } finally {
      setBusyId(null);
    }
  }

  if (leads.length === 0) {
    return (
      <div className="space-y-6">
        <StatsBar leads={leads} />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatsBar leads={leads} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                filter === f.key
                  ? 'bg-cr-blue text-white border-cr-blue'
                  : 'bg-white text-black/60 border-black/15 hover:border-black/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-black/40">Ordenar por</span>
          <select
            className="rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-xs font-medium"
            value={sortField}
            onChange={(e) => setSort(e.target.value as SortField)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="rounded-lg border border-black/15 bg-white p-1.5 text-black/50 hover:border-black/30 hover:text-black/80 transition-colors"
            aria-label="Invertir orden"
            title="Invertir orden"
          >
            {sortDir === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      <p className="text-xs text-black/40">Mostrando {sorted.length} leads</p>

      {sorted.length === 0 ? (
        <p className="text-sm text-black/50 py-8 text-center">No hay leads en esta categoría todavía.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 bg-zinc-50 text-left text-xs text-black/50 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
                    <SortableTh
                      label="Negocio"
                      field="name"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={setSort}
                      tooltip={COLUMN_TOOLTIPS.name}
                    />
                    <ThWithTooltip label="Categoría" tooltip={COLUMN_TOOLTIPS.category} />
                    <ThWithTooltip label="Ubicación" tooltip={COLUMN_TOOLTIPS.location} />
                    <ThWithTooltip label="Teléfono" tooltip={COLUMN_TOOLTIPS.phone} />
                    <ThWithTooltip label="Correo encontrado" tooltip={COLUMN_TOOLTIPS.email} />
                    <ThWithTooltip label="Por qué lo contactamos" tooltip={COLUMN_TOOLTIPS.why} />
                    <SortableTh
                      label="Puntaje"
                      field="score"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={setSort}
                      tooltip={COLUMN_TOOLTIPS.score}
                    />
                    <ThWithTooltip label="Acción" tooltip={COLUMN_TOOLTIPS.action} />
                    <th className="px-4 py-3 font-medium text-right">
                      <span className="sr-only">Eliminar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((lead, idx) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`cursor-pointer border-t border-black/5 transition-colors hover:bg-violet-50/60 ${
                        idx % 2 === 1 ? 'bg-zinc-50/60' : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeadId(lead.id);
                          }}
                          className="text-left font-semibold text-black hover:text-cr-blue transition-colors"
                        >
                          {lead.name}
                        </button>
                        {errorById[lead.id] && <p className="mt-0.5 text-xs text-red-600">{errorById[lead.id]}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={lead.category} />
                      </td>
                      <td className="px-4 py-3">
                        <MapsLink name={lead.name} city={lead.city} placeId={lead.placeId} />
                      </td>
                      <td className="px-4 py-3">
                        <PhoneCell phone={lead.phone} />
                      </td>
                      <td className="px-4 py-3">
                        <EmailCell email={lead.email} />
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <WhyChips lead={lead} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={lead.score} tier={lead.tier} />
                      </td>
                      <td className="px-4 py-3">
                        <ActionCell
                          lead={lead}
                          busy={busyId === lead.id}
                          onOpenModal={() => setSelectedLeadId(lead.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Tooltip content="Eliminar este lead permanentemente">
                          <button
                            type="button"
                            disabled={busyId === lead.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(lead);
                            }}
                            aria-label={`Eliminar ${lead.name}`}
                            className="rounded-lg p-1.5 text-black/30 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {sorted.map((lead) => (
              <li
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className="cursor-pointer rounded-xl border border-black/10 bg-white p-4 shadow-sm active:bg-violet-50/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{lead.name}</p>
                    <div className="mt-1.5">
                      <CategoryBadge category={lead.category} />
                    </div>
                  </div>
                  <ScoreBadge score={lead.score} tier={lead.tier} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <ActionCell
                    lead={lead}
                    busy={busyId === lead.id}
                    onOpenModal={() => setSelectedLeadId(lead.id)}
                  />
                </div>
                {errorById[lead.id] && <p className="mt-2 text-xs text-red-600">{errorById[lead.id]}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLeadId(null)}
        onSend={handleSend}
        onDismiss={handleDismiss}
        busy={busyId === selectedLead?.id}
        error={selectedLead ? errorById[selectedLead.id] : undefined}
      />
    </div>
  );
}

function ActionCell({
  lead,
  busy,
  onOpenModal,
}: {
  lead: LeadWithId;
  busy: boolean;
  onOpenModal: () => void;
}) {
  if (lead.status === 'sent') {
    return (
      <Tooltip content="El correo generado ya se envió a este contacto. Haz clic en la fila para ver cuándo.">
        <span className="inline-flex cursor-help items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
          Enviado
        </span>
      </Tooltip>
    );
  }

  if (lead.status === 'dismissed') {
    return (
      <Tooltip content="Alguien revisó este lead y decidió no enviarle correo. No se puede reactivar desde aquí.">
        <span className="cursor-help text-xs font-medium text-zinc-400">Descartado</span>
      </Tooltip>
    );
  }

  if (lead.status === 'not_qualified') {
    return (
      <Tooltip content="Su puntaje fue demasiado bajo (0-39): no se detectaron suficientes debilidades web, así que no se generó correo para este negocio.">
        <span className="cursor-help text-xs text-zinc-300">—</span>
      </Tooltip>
    );
  }

  // pending_review
  if (!lead.email) {
    return (
      <Tooltip content="Se generó un correo para este lead, pero no encontramos ninguna dirección de contacto (ni en Google, ni en su sitio web), así que no se puede enviar.">
        <span className="cursor-help text-xs font-medium text-zinc-400">Sin correo</span>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onOpenModal();
      }}
      title="Abre el detalle del lead para revisar el correo antes de confirmarlo"
      className="inline-flex items-center gap-1.5 rounded-lg bg-cr-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-cr-blue/90 disabled:opacity-40 transition-colors"
    >
      <Send className="h-3.5 w-3.5" strokeWidth={2} />
      Enviar correo
    </button>
  );
}

function SortableTh({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  tooltip,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  tooltip?: string;
}) {
  const isActive = field === sortField;
  const Icon = isActive ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  const button = (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 hover:text-black/80 transition-colors ${
        isActive ? 'text-black/80' : ''
      }`}
    >
      {label}
      <Icon className="h-3 w-3" strokeWidth={2} />
    </button>
  );

  return <th className="px-4 py-3 font-medium">{tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button}</th>;
}

function ThWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <th className="px-4 py-3 font-medium">
      <Tooltip content={tooltip}>
        <span className="cursor-help border-b border-dotted border-black/20">{label}</span>
      </Tooltip>
    </th>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-black/15 bg-white py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 text-violet-500">
        <Search className="h-6 w-6" strokeWidth={2} />
      </div>
      <p className="mt-4 text-sm font-medium text-black/70">Todavía no hay leads escaneados.</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-black/45">
        Ejecuta un escaneo para encontrar negocios.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-cr-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cr-blue/90 transition-colors"
      >
        Ir al escáner
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </div>
  );
}
