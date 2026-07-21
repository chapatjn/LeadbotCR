import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { searchPlaces, getPlaceDetails, type PlaceSearchResult } from '@/lib/places';
import { getMobilePagespeedScore } from '@/lib/pagespeed';
import { checkDesignSignals } from '@/lib/design-check';
import { scoreLead } from '@/lib/scoring';
import { generateColdEmail } from '@/lib/claude';
import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';
import { ALL_COSTA_RICA, DEFAULT_RESULT_COUNT, MAX_ALLOWED_RESULTS, RESULT_COUNT_OPTIONS } from '@/lib/constants';
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
// Pro+) for extra time. Vercel's Hobby tier caps functions at ~10-60s
// regardless of this value — if you're on Hobby, keep scans small
// (few results) or move this route to a queue/background worker.
export const maxDuration = 300;

// How many businesses to process at once. PageSpeed audits are the
// bottleneck (30-60s+ each for real sites) — without concurrency, a
// maxResults=50 scan where most businesses have real websites could take
// 25-50 minutes, which is unusable and risks exceeding maxDuration even on
// Vercel Pro. Even with this, an unlucky scan (many slow real sites) can
// still take a few minutes — that's the nature of running a real Lighthouse
// audit per business rather than a background job queue.
const CONCURRENCY = 8;

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

export async function POST(req: NextRequest) {
  let category: string;
  let cityInput: string;
  let maxResults: number;

  try {
    const body = await req.json();
    category = (body?.category ?? '').toString().trim();
    cityInput = (body?.city ?? '').toString().trim();

    const requestedResults = Number(body?.maxResults);
    maxResults = RESULT_COUNT_OPTIONS.includes(requestedResults as any)
      ? requestedResults
      : DEFAULT_RESULT_COUNT;
    maxResults = Math.min(maxResults, MAX_ALLOWED_RESULTS);
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la solicitud inválido.' }), { status: 400 });
  }

  if (!category || !cityInput) {
    return new Response(JSON.stringify({ error: 'category y city son requeridos.' }), { status: 400 });
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

      const summary: ScanSummary = { total: 0, pendingReview: 0, notQualified: 0, errors: 0 };

      try {
        send({
          type: 'status',
          message: isAllCostaRica
            ? `Buscando "${category}" en todo Costa Rica...`
            : `Buscando "${category}" en ${displayCity}, Costa Rica...`,
        });

        const places = await searchPlaces(category, searchCity, maxResults);
        summary.total = places.length;

        if (places.length === 0) {
          send({ type: 'status', message: 'No se encontraron negocios para esa búsqueda.' });
          send({ type: 'done', summary });
          controller.close();
          return;
        }

        send({ type: 'status', message: `Se encontraron ${places.length} negocios. Analizando (hasta ${CONCURRENCY} a la vez)...` });

        const db = getDb();
        let completed = 0;

        const processBusiness = async (place: PlaceSearchResult) => {
          send({ type: 'status', message: `Analizando "${place.name}"...` });

          try {
            const details = await getPlaceDetails(place.placeId);
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

            const ref = await db.collection(LEADS_COLLECTION).add(leadDoc);

            send({
              type: 'lead',
              data: { id: ref.id, ...leadDoc, createdAt: undefined, updatedAt: undefined } as any,
            });
          } catch (perBusinessErr: any) {
            summary.errors++;
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
              total: places.length,
              message: `(${completed}/${places.length}) completados`,
            });
          }
        };

        await runPool(places, CONCURRENCY, processBusiness);

        send({ type: 'done', summary });
      } catch (err: any) {
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
