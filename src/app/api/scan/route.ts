import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { searchPlaces, getPlaceDetails } from '@/lib/places';
import { getMobilePagespeedScore } from '@/lib/pagespeed';
import { checkDesignSignals } from '@/lib/design-check';
import { scoreLead } from '@/lib/scoring';
import { generateColdEmail } from '@/lib/claude';
import { sendColdEmail } from '@/lib/resend';
import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';
import { MAX_SCAN_RESULTS } from '@/lib/constants';
import type { Lead, LeadStatus, ScanEvent, ScanSummary } from '@/lib/types';

// This route can take a while: up to MAX_SCAN_RESULTS businesses, each
// potentially requiring a PageSpeed Insights run (several seconds) plus a
// Claude call. It streams NDJSON progress events as it goes so the UI can
// show real-time status instead of blocking on one long request.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Ask platforms that support configurable function duration (e.g. Vercel
// Pro+) for extra time. Vercel's Hobby tier caps functions at ~10-60s
// regardless of this value — if you're on Hobby, keep scans small
// (few results) or move this route to a queue/background worker.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let category: string;
  let city: string;

  try {
    const body = await req.json();
    category = (body?.category ?? '').toString().trim();
    city = (body?.city ?? '').toString().trim();
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la solicitud inválido.' }), { status: 400 });
  }

  if (!category || !city) {
    return new Response(JSON.stringify({ error: 'category y city son requeridos.' }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScanEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      const summary: ScanSummary = { total: 0, sent: 0, pendingReview: 0, notQualified: 0, errors: 0 };

      try {
        send({ type: 'status', message: `Buscando "${category}" en ${city}, Costa Rica...` });

        const places = await searchPlaces(category, city);
        const limited = places.slice(0, MAX_SCAN_RESULTS);
        summary.total = limited.length;

        if (limited.length === 0) {
          send({ type: 'status', message: 'No se encontraron negocios para esa búsqueda.' });
          send({ type: 'done', summary });
          controller.close();
          return;
        }

        send({ type: 'status', message: `Se encontraron ${limited.length} negocios. Analizando uno por uno...` });

        const db = getDb();

        for (let i = 0; i < limited.length; i++) {
          const place = limited[i];

          send({
            type: 'progress',
            index: i + 1,
            total: limited.length,
            message: `(${i + 1}/${limited.length}) Analizando "${place.name}"...`,
          });

          try {
            const details = await getPlaceDetails(place.placeId);
            const hasWebsite = !!details.website;

            let pagespeedScore: number | null = null;
            let designSignals: Lead['designSignals'] = null;
            let designOutdated = false;
            let extractedEmail: string | null = null;

            if (hasWebsite && details.website) {
              send({ type: 'status', message: `Revisando velocidad móvil de "${place.name}"...` });
              pagespeedScore = await getMobilePagespeedScore(details.website);

              send({ type: 'status', message: `Revisando señales de diseño de "${place.name}"...` });
              const designResult = await checkDesignSignals(details.website);
              designSignals = designResult.signals;
              designOutdated = designResult.outdated;
              extractedEmail = designResult.extractedEmail;
            }

            const { score, tier, weaknesses } = scoreLead({ hasWebsite, pagespeedScore, designOutdated });

            let status: LeadStatus;
            let emailSubject: string | null = null;
            let emailBody: string | null = null;
            let sentAt: string | null = null;

            if (tier === 'low') {
              status = 'not_qualified';
              summary.notQualified++;
            } else {
              send({ type: 'status', message: `Generando correo personalizado para "${place.name}"...` });
              const generated = await generateColdEmail({
                businessName: place.name,
                city,
                category,
                weaknesses: weaknesses.map((w) => w.label),
              });
              emailSubject = generated.subject;
              emailBody = generated.body;

              if (tier === 'high' && extractedEmail) {
                try {
                  await sendColdEmail({ to: extractedEmail, subject: emailSubject, body: emailBody });
                  status = 'sent';
                  sentAt = new Date().toISOString();
                  summary.sent++;
                  send({ type: 'status', message: `Correo enviado a "${place.name}".` });
                } catch {
                  status = 'send_failed';
                  summary.errors++;
                  send({ type: 'status', message: `No se pudo enviar el correo a "${place.name}".` });
                }
              } else if (tier === 'high' && !extractedEmail) {
                status = 'no_email';
                summary.pendingReview++;
                send({
                  type: 'status',
                  message: `"${place.name}" calificó como prioritario, pero no se encontró un correo; queda registrado sin enviar.`,
                });
              } else {
                // medium tier: always saved for manual review, never auto-sent
                status = 'pending_review';
                summary.pendingReview++;
              }
            }

            const leadDoc: Lead = {
              placeId: place.placeId,
              name: place.name,
              address: place.address,
              city,
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
              sentAt,
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
          }
        }

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
