'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Eye,
  MapPin,
  Search,
  Send,
} from 'lucide-react';
import type { LeadStatus, LeadWithId } from '@/lib/types';
import { buildMapsUrl } from '@/lib/maps';
import { CategoryBadge } from './CategoryBadge';
import { LeadDetailModal } from './LeadDetailModal';
import { MapsLink } from './MapsLink';
import { PhoneCell } from './PhoneCell';
import { ScoreBadge } from './ScoreBadge';
import { StatsBar } from './StatsBar';
import { StatusBadge } from './StatusBadge';
import { WhyChips } from './WhyChips';

const FILTERS: { key: 'all' | LeadStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending_review', label: 'Pendientes de revisión' },
  { key: 'sent', label: 'Enviados' },
  { key: 'no_email', label: 'Sin correo' },
  { key: 'send_failed', label: 'Falló el envío' },
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
      const res = await fetch(`/api/leads/${lead.id}/send`, { method: 'POST' });
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
        body: JSON.stringify({ status: 'not_qualified' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Error al descartar.');

      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'not_qualified' } : l)));
    } catch (err: any) {
      setErrorById((prev) => ({ ...prev, [lead.id]: err?.message ?? 'Error al descartar.' }));
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
                    <SortableTh label="Negocio" field="name" sortField={sortField} sortDir={sortDir} onSort={setSort} />
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">Ubicación</th>
                    <th className="px-4 py-3 font-medium">Teléfono</th>
                    <th className="px-4 py-3 font-medium">Por qué lo contactamos</th>
                    <SortableTh label="Puntaje" field="score" sortField={sortField} sortDir={sortDir} onSort={setSort} />
                    <SortableTh label="Estado" field="status" sortField={sortField} sortDir={sortDir} onSort={setSort} />
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
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
                      <td className="px-4 py-3 max-w-xs">
                        <WhyChips lead={lead} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={lead.score} tier={lead.tier} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={lead.status} />
                          {lead.status === 'pending_review' && lead.email && (
                            <button
                              type="button"
                              disabled={busyId === lead.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSend(lead);
                              }}
                              className="rounded-md bg-cr-blue px-2 py-1 text-[11px] font-semibold text-white hover:bg-cr-blue/90 disabled:opacity-40 transition-colors"
                            >
                              {busyId === lead.id ? '...' : 'Enviar'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            label="Ver correo"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeadId(lead.id);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                          </IconButton>
                          {lead.status === 'pending_review' && lead.email && (
                            <IconButton
                              label="Enviar ahora"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSend(lead);
                              }}
                            >
                              <Send className="h-3.5 w-3.5" strokeWidth={2} />
                            </IconButton>
                          )}
                          <a
                            href={buildMapsUrl({ name: lead.name, city: lead.city, placeId: lead.placeId })}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir en Maps"
                            aria-label="Abrir en Maps"
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg p-1.5 text-black/40 hover:bg-black/5 hover:text-black/70 transition-colors"
                          >
                            <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                          </a>
                        </div>
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

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <MapsLink name={lead.name} city={lead.city} placeId={lead.placeId} />
                  <PhoneCell phone={lead.phone} />
                </div>

                <div className="mt-3">
                  <WhyChips lead={lead} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <StatusBadge status={lead.status} />
                  <div className="flex items-center gap-1">
                    <IconButton
                      label="Ver correo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLeadId(lead.id);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                    </IconButton>
                    {lead.status === 'pending_review' && lead.email && (
                      <IconButton
                        label="Enviar ahora"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSend(lead);
                        }}
                      >
                        <Send className="h-3.5 w-3.5" strokeWidth={2} />
                      </IconButton>
                    )}
                    <a
                      href={buildMapsUrl({ name: lead.name, city: lead.city, placeId: lead.placeId })}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir en Maps"
                      aria-label="Abrir en Maps"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg p-1.5 text-black/40 hover:bg-black/5 hover:text-black/70 transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                    </a>
                  </div>
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

function SortableTh({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = field === sortField;
  const Icon = isActive ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className="px-4 py-3 font-medium">
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
    </th>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-1.5 text-black/40 hover:bg-black/5 hover:text-black/70 transition-colors"
    >
      {children}
    </button>
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
        Elige una categoría de negocio y una ciudad para empezar tu primer escaneo.
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
