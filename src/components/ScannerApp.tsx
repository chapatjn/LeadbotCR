'use client';

import { useRef, useState } from 'react';
import {
  ALL_COSTA_RICA,
  ALL_COSTA_RICA_LABEL,
  CR_CATEGORIES,
  CR_CITIES,
  DEFAULT_RESULT_COUNT,
  RESULT_COUNT_OPTIONS,
} from '@/lib/constants';
import type { LeadWithId, ScanEvent, ScanSummary } from '@/lib/types';
import { ScoreBadge } from './ScoreBadge';
import { StatusBadge } from './StatusBadge';
import { ShaderBackground } from './ui/hero-shader';

interface LogLine {
  id: number;
  message: string;
  kind: 'status' | 'error' | 'fatal';
}

export function ScannerApp() {
  const [category, setCategory] = useState<string>(CR_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [city, setCity] = useState<string>(CR_CITIES[0]);
  const [resultsCount, setResultsCount] = useState<number>(DEFAULT_RESULT_COUNT);
  const [onlyNoWebsite, setOnlyNoWebsite] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [leads, setLeads] = useState<LeadWithId[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [progress, setProgress] = useState<{ index: number; total: number } | null>(null);
  const logIdRef = useRef(0);

  const effectiveCategory = useCustomCategory ? customCategory.trim() : category;

  function pushLog(message: string, kind: LogLine['kind'] = 'status') {
    logIdRef.current += 1;
    setLogs((prev) => [...prev, { id: logIdRef.current, message, kind }]);
  }

  async function handleScan() {
    if (!effectiveCategory || !city) return;

    setIsScanning(true);
    setLogs([]);
    setLeads([]);
    setSummary(null);
    setProgress(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: effectiveCategory, city, maxResults: resultsCount, onlyNoWebsite }),
      });

      if (!res.body) {
        pushLog('El navegador no soporta streaming de respuesta.', 'fatal');
        setIsScanning(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        pushLog(data?.error ?? `Error del servidor (${res.status}).`, 'fatal');
        setIsScanning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: ScanEvent;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          handleEvent(event);
        }
      }

      if (buffer.trim()) {
        try {
          handleEvent(JSON.parse(buffer));
        } catch {
          // ignore trailing partial line
        }
      }
    } catch (err: any) {
      pushLog(err?.message ?? 'Error de red durante el escaneo.', 'fatal');
    } finally {
      setIsScanning(false);
    }
  }

  function handleEvent(event: ScanEvent) {
    switch (event.type) {
      case 'status':
        pushLog(event.message, 'status');
        break;
      case 'progress':
        setProgress({ index: event.index, total: event.total });
        pushLog(event.message, 'status');
        break;
      case 'lead':
        setLeads((prev) => [...prev, event.data]);
        break;
      case 'error':
        pushLog(event.message, 'error');
        break;
      case 'fatal':
        pushLog(event.message, 'fatal');
        break;
      case 'done':
        setSummary(event.summary);
        pushLog(
          `Escaneo completo: ${event.summary.total} encontrados de ${event.summary.requested} solicitados.`,
          'status'
        );
        break;
    }
  }

  return (
    <div className="space-y-8">
      <ShaderBackground className="rounded-[2rem] shadow-2xl shadow-violet-950/20">
        <div className="relative z-10 flex min-h-[660px] flex-col p-6 sm:p-8 lg:p-10">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-black/15 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/75 backdrop-blur-md">
              Prospección inteligente · Costa Rica
            </span>
            <span className="hidden items-center gap-2 text-xs text-white/60 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              Sistema disponible
            </span>
          </div>

          <div className="mt-auto grid items-end gap-8 lg:grid-cols-[1.15fr_.85fr]">
            <div className="max-w-xl pb-1 text-white">
              <div className="mb-5 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/85 backdrop-blur-md">
                ✦ Encuentra oportunidades reales
              </div>
              <h1 className="text-4xl font-medium leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                Negocios locales.
                <br />
                <span className="font-serif italic text-white/75">Mejores prospectos.</span>
              </h1>
              <p className="mt-5 max-w-lg text-sm font-light leading-relaxed text-white/65 sm:text-base">
                Analiza la presencia digital de negocios en Costa Rica y genera propuestas personalizadas para los prospectos con mayor potencial.
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-black/30 p-5 text-white shadow-2xl backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Iniciar búsqueda</p>
                  <p className="mt-1 text-xs text-white/50">Configura tu próximo escaneo</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/55">
                  AI Scan
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">Categoría de negocio</label>
            {!useCustomCategory ? (
              <select
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none transition focus:border-white/35 focus:bg-white/15"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isScanning}
              >
                {CR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-white/35 focus:bg-white/15"
                placeholder="Ej. Estudio de yoga"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                disabled={isScanning}
              />
            )}
            <button
              type="button"
              className="mt-2 text-[11px] text-violet-200/80 transition hover:text-white"
              onClick={() => setUseCustomCategory((v) => !v)}
              disabled={isScanning}
            >
              {useCustomCategory ? 'Elegir de la lista' : 'Escribir otra categoría'}
            </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">Ubicación</label>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none transition focus:border-white/35 focus:bg-white/15"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={isScanning}
                    >
                      <option value={ALL_COSTA_RICA}>{ALL_COSTA_RICA_LABEL}</option>
                      <option value="" disabled>
                        ──────────
                      </option>
                      {CR_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">Resultados</label>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none transition focus:border-white/35 focus:bg-white/15"
                      value={resultsCount}
                      onChange={(e) => setResultsCount(Number(e.target.value))}
                      disabled={isScanning}
                    >
                      {RESULT_COUNT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n} negocios
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs text-white/80">
                  <input
                    type="checkbox"
                    checked={onlyNoWebsite}
                    onChange={(e) => setOnlyNoWebsite(e.target.checked)}
                    disabled={isScanning}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/30 bg-white/10 accent-violet-500"
                  />
                  <span>
                    Solo negocios sin sitio web
                    <span className="mt-0.5 block text-[11px] font-light text-white/50">
                      Ignora los que ya tienen sitio y busca más páginas de resultados si hace falta para completar
                      la cantidad pedida.
                    </span>
                  </span>
                </label>
              </div>

        <button
          type="button"
          onClick={handleScan}
          disabled={isScanning || !effectiveCategory}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isScanning && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
          )}
          {isScanning ? 'Escaneando...' : `Buscar ${resultsCount} leads`}
          {!isScanning && <span aria-hidden="true">↗</span>}
        </button>
            </div>
          </div>
        </div>
      </ShaderBackground>

      {(isScanning || logs.length > 0) && (
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Progreso</h2>
            {progress && (
              <span className="text-xs text-black/50">
                {progress.index} / {progress.total}
              </span>
            )}
          </div>
          {progress && (
            <div className="mb-4 h-1.5 w-full rounded-full bg-black/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-cr-blue transition-all"
                style={{ width: `${Math.round((progress.index / Math.max(progress.total, 1)) * 100)}%` }}
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto space-y-1 text-sm font-mono">
            {logs.map((log) => (
              <div
                key={log.id}
                className={
                  log.kind === 'fatal'
                    ? 'text-red-700'
                    : log.kind === 'error'
                      ? 'text-amber-700'
                      : 'text-black/70'
                }
              >
                {log.message}
              </div>
            ))}
          </div>
        </section>
      )}

      {summary && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Solicitados" value={summary.requested} />
          <SummaryStat label="Encontrados" value={summary.total} />
          <SummaryStat label="Para revisar" value={summary.pendingReview} />
          <SummaryStat label="No calificados" value={summary.notQualified} />
        </section>
      )}

      {leads.length > 0 && (
        <section className="rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
          <h2 className="px-6 pt-5 text-sm font-semibold">Resultados de este escaneo</h2>
          <ul className="divide-y divide-black/5 mt-3">
            {leads.map((lead) => (
              <li key={lead.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-black/50">{lead.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={lead.score} tier={lead.tier} />
                    <StatusBadge status={lead.status} />
                  </div>
                </div>
                {lead.weaknesses.length > 0 && (
                  <p className="mt-2 text-xs text-black/60">
                    Debilidades: {lead.weaknesses.map((w) => w.label).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-black/50 mt-0.5">{label}</p>
    </div>
  );
}
