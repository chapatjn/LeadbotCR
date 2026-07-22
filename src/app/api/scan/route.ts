import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getPlaceDetails,
  searchPlaces,
  searchPlacesWithoutWebsite,
  type PlaceDetails,
  type PlaceSearchResult,
} from '@/lib/places';
import { getMobilePagespeedScore } from '@/lib/pagespeed';
import { checkDesignSignals } from '@/lib/design-check';
import { scoreLead } from '@/lib/scoring';
import { generateColdEmail } from '@/lib/claude';
import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';
import {
  ALL_COSTA_RICA,
  CR_CITIES,
  DEFAULT_RESULT_COUNT,
  MAX_ALLOWED_RESULTS,
  RESULT_COUNT_OPTIONS,
} from '@/lib/constants';
import type { Lead, LeadStatus, ScanEvent, ScanSummary } from '@/lib/types';

// This route can take a while: up to MAX_ALLOWED_RESULTS businesses, each
// potentially requiring a PageSpeed Insights run (real-world sites commonly
// take 30-60+ seconds for a full mobile Lighthouse audit) plus a Claude
// call. Businesses are processed with bounded concurrency (see CONCURRENCY
// below) so the whole scan doesn't take (count × per-business time) — it
// streams NDJSON progress events as each business finishes so the UI can
// show real-time status instead of blocking on one long request.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Ask platforms that support configurable function duration (e.g. Vercel
// Pro+ with Fluid Compute) for extra time. Deep scans now search several
// query variants per business category (see places.ts) on top of the
// PageSpeed/Claude work per business, so they can legitimately run long.
// Vercel's Hobby tier caps functions well below this regardless of this
// value — if you're on Hobby, keep scans small (few results) or move this
// route to a queue/background worker.
export const maxDuration = 800;

// How many businesses to process at once. PageSpeed audits are the
// bottleneck (30-60s+ each for real sites) — without concurrency, a
// maxResults=50 scan where most businesses have real websites could take
// 25-50 minutes, which is unusable and risks exceeding maxDuration even on
// Vercel Pro. Even with this, an unlucky scan (many slow real sites) can
// still take a few minutes — that's the nature of running a real Lighthouse
// audit per business rather than a background job queue.
const CONCURRENCY = 8;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Firestore writes occasionally hiccup on a transient network/API error.
// Losing a lead at that point is expensive — it already cost a PageSpeed
// audit and a Claude-generated email — so retry a few times with backoff
// before giving up on it.
async function saveLeadWithRetry(
  db: FirebaseFirestore.Firestore,
  leadDoc: Lead,
  attempts = 3
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const ref = await db.collection(LEADS_COLLECTION).add(leadDoc);
      return ref.id;
    } catch (err) {
      lastErr = err;
      if (attempt < attempts - 1) await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let nextIndex = 0;
  const poolSize = Math.min(concurrency, items.length);
  const workers = Array.from({ length: poolSize }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      await worker(items[current], current);
    }
  });
  await Promise.all(workers);
}

interface WorkItem {
  place: PlaceSearchResult;
  // Pre-fetched only when using "only businesses without a website" mode,
  // since that mode already needs Place Details to filter — no point
  // fetching them again in processBusiness.
  details?: PlaceDetails;
}

export async function POST(req: NextRequest) {
  let category: string;
  let cityInput: string;
  let maxResults: number;
  let onlyNoWebsite: boolean;

  try {
    const body = await req.json();
    category = (body?.category ?? '').toString().trim();
    cityInput = (body?.city ?? '').toString().trim();
    onlyNoWebsite = body?.onlyNoWebsite === true;

    const requestedResults = body?.maxResults === undefined ? DEFAULT_RESULT_COUNT : Number(body.maxResults);
    if (!RESULT_COUNT_OPTIONS.some((option) => option === requestedResults)) {
      return new Response(
        JSON.stringify({ error: `Cantidad inválida. Usa una de estas opciones: ${RESULT_COUNT_OPTIONS.join(', ')}.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    maxResults = requestedResults;
    maxResults = Math.min(maxResults, MAX_ALLOWED_RESULTS);
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la solicitud inválido.' }), { status: 400 });
  }

  if (!category || !cityInput) {
    return new Response(JSON.stringify({ error: 'category y city son requeridos.' }), { status: 400 });
  }

  if (category.length > 80) {
    return new Response(JSON.stringify({ error: 'La categoría no puede superar 80 caracteres.' }), { status: 400 });
  }

  if (cityInput !== ALL_COSTA_RICA && !CR_CITIES.some((city) => city === cityInput)) {
    return new Response(JSON.stringify({ error: 'La ubicación seleccionada no es válida.' }), { status: 400 });
  }

  const isAllCostaRica = cityInput === ALL_COSTA_RICA;
  const searchCity = isAllCostaRica ? null : cityInput;
  const displayCity = isAllCostaRica ? 'Costa Rica' : cityInput;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScanEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      const summary: ScanSummary = {
        requested: maxResults,
        total: 0,
        pendingReview: 0,
        notQualified: 0,
        errors: 0,
      };

      try {
        const locationText = isAllCostaRica ? 'todo Costa Rica' : `${displayCity}, Costa Rica`;
        send({
          type: 'status',
          message: onlyNoWebsite
            ? `Buscando hasta ${maxResults} negocios de "${category}" en ${locationText} — solo sin sitio web...`
            : `Buscando hasta ${maxResults} negocios de "${category}" en ${locationText}...`,
        });

        let workItems: WorkItem[];

        if (onlyNoWebsite) {
          const found = await searchPlacesWithoutWebsite(
            category,
            searchCity,
            maxResults,
            (checked, accepted, variantLabel, lookupErrors) => {
              send({
                type: 'status',
                message:
                  `Revisando negocios (${variantLabel})... ${checked} revisados, ` +
                  `${accepted} sin sitio web confirmados` +
                  `${lookupErrors ? `, ${lookupErrors} verificaciones fallidas` : ''}.`,
              });
            }
          );
          workItems = found.map((f) => ({ place: f.place, details: f.details }));
        } else {
          const places = await searchPlaces(category, searchCity, maxResults, (variantLabel, foundSoFar) => {
            send({
              type: 'status',
              message: `Buscando (${variantLabel})... ${foundSoFar} negocios únicos encontrados hasta ahora.`,
            });
          });
          workItems = places.map((place) => ({ place }));
        }

        summary.total = workItems.length;

        if (workItems.length < maxResults) {
          send({
            type: 'status',
            message: `Google Places devolvió ${workItems.length} de los ${maxResults} negocios solicitados para esta búsqueda.`,
          });
        }

        if (workItems.length === 0) {
          send({
            type: 'status',
            message: onlyNoWebsite
              ? 'No se encontraron negocios sin sitio web para esa búsqueda.'
              : 'No se encontraron negocios para esa búsqueda.',
          });
          send({ type: 'done', summary });
          controller.close();
          return;
        }

        send({
          type: 'status',
          message: `Se encontraron ${workItems.length} negocios. Analizando (hasta ${CONCURRENCY} a la vez)...`,
        });

        const db = getDb();
        let completed = 0;

        // Businesses whose analysis finished fine but whose Firestore write
        // failed even after saveLeadWithRetry's in-place retries. Queued up
        // for one more, harder-retried attempt after the whole pool
        // finishes, so a fully-analyzed lead (PageSpeed audit + generated
        // email already paid for) isn't silently lost to a transient save
        // error — see the "no siempre lo guarda" fix below.
        const failedSaves: { place: PlaceSearchResult; leadDoc: Lead }[] = [];

        const processBusiness = async ({ place, details: prefetchedDetails }: WorkItem) => {
          send({ type: 'status', message: `Analizando "${place.name}"...` });

          try {
            const details = prefetchedDetails ?? (await getPlaceDetails(place.placeId));
            const hasWebsite = !!details.website;

            let pagespeedScore: number | null = null;
            let designSignals: Lead['designSignals'] = null;
            let designOutdated = false;
            let extractedEmail: string | null = null;

            if (hasWebsite && details.website) {
              send({ type: 'status', message: `Revisando velocidad y diseño de "${place.name}"...` });
              // Independent checks against the same site — run concurrently
              // rather than one after another to cut per-business latency.
              const [scoreResult, designResult] = await Promise.all([
                getMobilePagespeedScore(details.website),
                checkDesignSignals(details.website),
              ]);
              pagespeedScore = scoreResult;
              designSignals = designResult.signals;
              designOutdated = designResult.outdated;
              extractedEmail = designResult.extractedEmail;
            }

            const { score, tier, weaknesses } = scoreLead({ hasWebsite, pagespeedScore, designOutdated });

            let status: LeadStatus;
            let emailSubject: string | null = null;
            let emailBody: string | null = null;

            if (tier === 'low') {
              status = 'not_qualified';
              summary.notQualified++;
            } else {
              send({ type: 'status', message: `Generando correo personalizado para "${place.name}"...` });
              const generated = await generateColdEmail({
                businessName: place.name,
                city: displayCity,
                category,
                weaknesses: weaknesses.map((w) => w.label),
              });
              emailSubject = generated.subject;
              emailBody = generated.body;

              // No auto-send, regardless of tier — every qualified lead
              // waits in the review queue for a human to approve it.
              status = 'pending_review';
              summary.pendingReview++;
            }

            const leadDoc: Lead = {
              placeId: place.placeId,
              name: place.name,
              address: place.address,
              city: displayCity,
              category,
              phone: details.phone,
              website: details.website,
              email: extractedEmail,
              hasWebsite,
              pagespeedMobileScore: pagespeedScore,
              designSignals,
              score,
              tier,
              weaknesses,
              emailSubject,
              emailBody,
              status,
              scannedAt: new Date().toISOString(),
              sentAt: null,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            };

            // Save is isolated in its own try/catch, deliberately separate
            // from the send() below: send() can throw for unrelated reasons
            // (e.g. the client disconnected and the stream controller is
            // closed) and must not be mistaken for a failed save, or a
            // lead that actually saved fine would get queued for a second,
            // duplicate write in the final flush.
            let savedId: string | null = null;
            try {
              savedId = await saveLeadWithRetry(db, leadDoc);
            } catch (saveErr) {
              // Analysis succeeded but the write didn't, even after retries
              // — queue it for a final attempt once the whole scan
              // finishes instead of throwing the result away.
              console.error(`[scan] No se pudo guardar "${place.name}" (se reintentará al final):`, saveErr);
              failedSaves.push({ place, leadDoc });
            }

            if (savedId) {
              send({
                type: 'lead',
                data: { id: savedId, ...leadDoc, createdAt: undefined, updatedAt: undefined } as any,
              });
            }
          } catch (perBusinessErr: any) {
            summary.errors++;
            // Also logged server-side (visible in the terminal running the
            // dev server, or in Vercel's function logs) since the client
            // only gets the message string, not the full stack trace.
            console.error(`[scan] Error al procesar "${place.name}":`, perBusinessErr);
            send({
              type: 'error',
              message: `Error al procesar "${place.name}": ${perBusinessErr?.message ?? 'error desconocido'}`,
            });
          } finally {
            // Businesses finish out of order under concurrency, so progress
            // is reported by completion count rather than start order.
            completed++;
            send({
              type: 'progress',
              index: completed,
              total: workItems.length,
              message: `(${completed}/${workItems.length}) completados`,
            });
          }
        };

        await runPool(workItems, CONCURRENCY, processBusiness);

        // Guarantee every fully-analyzed lead ends up in the leads tracker
        // before the scan is reported as done: give each business that
        // failed to save the first time a harder-retried final chance.
        if (failedSaves.length > 0) {
          send({
            type: 'status',
            message: `Reintentando guardar ${failedSaves.length} lead(s) que no se guardaron durante el análisis...`,
          });

          for (const { place, leadDoc } of failedSaves) {
            let savedId: string | null = null;
            try {
              savedId = await saveLeadWithRetry(db, leadDoc, 5);
            } catch (finalErr: any) {
              summary.errors++;
              console.error(`[scan] "${place.name}" no se pudo guardar tras el reintento final:`, finalErr);
              send({
                type: 'error',
                message: `No se pudo guardar "${place.name}" en la base de datos tras varios intentos.`,
              });
            }

            if (savedId) {
              send({
                type: 'lead',
                data: { id: savedId, ...leadDoc, createdAt: undefined, updatedAt: undefined } as any,
              });
            }
          }
        }

        send({ type: 'done', summary });
      } catch (err: any) {
        console.error('[scan] Error fatal durante el escaneo:', err);
        send({ type: 'fatal', message: err?.message ?? 'Error inesperado durante el escaneo.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
