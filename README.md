# LeadBot CR

Encuentra negocios costarricenses con poca presencia web y envíales una propuesta de desarrollo web personalizada, generada con IA.

## Stack

- Next.js 14 (App Router, TypeScript)
- Firebase Firestore (Admin SDK, solo en servidor)
- Tailwind CSS
- Google Places API + PageSpeed Insights API
- Claude (Anthropic) para generar los correos
- Resend para enviarlos
- Target de despliegue: Vercel

## Cómo funciona

1. **`/`** — Escáner: elige categoría de negocio, ubicación (una ciudad específica o
   "Todo Costa Rica") y cuántos resultados traer (5/10/20/50), y dispara el pipeline.
2. **`POST /api/scan`** — busca negocios en Google Places (paginando con
   `next_page_token` si se piden más de 20), evalúa cada uno, y genera el correo con
   Claude para todo lead calificado (puntaje medio o alto). **No envía nada
   automáticamente** — todo lead calificado se guarda en Firestore como
   `pending_review`, sin importar el tier. Responde con un stream NDJSON de eventos de
   progreso que la UI consume en tiempo real (sin polling).
3. **`/leads`** — cola de revisión: lista todos los leads guardados, con filtros por
   estado. Cada lead `pending_review` con un correo de contacto detectado tiene un
   botón "Enviar correo" que abre el modal de detalle para revisar el copy antes de
   confirmar el envío real vía `POST /api/send-email`. También se puede descartar
   (`dismissed`) sin enviar.

## Motor de puntaje (0-100)

| Señal | Puntos |
|---|---|
| No hay sitio web en Google Places | +50 |
| Sitio existe pero PageSpeed móvil < 50 | +30 |
| Sitio existe con señales de diseño desactualizado (sin meta viewport, sin HTTPS, o copyright > 2 años de antigüedad) | +20 |

Si no hay sitio web, se omiten las verificaciones de PageSpeed y diseño (no hay nada
que revisar), y el lead queda marcado con un flag manual.

- **Alto (70-100)** y **Medio (40-69):** ambos se tratan igual para efectos de envío
  — se genera el correo y el lead queda como `pending_review`, esperando aprobación
  manual en `/leads`. El tier solo se usa como señal de prioridad (el badge de
  puntaje y la estadística "Puntaje alto"), **no** determina si se envía
  automáticamente — no hay envío automático en ningún tier.
- **Bajo (0-39):** se omite, se guarda como `not_qualified`, sin generar correo.

> **Nota sobre el puntaje:** tal como está especificado, la rama "sin sitio web" se
> queda en 50 puntos (las otras dos verificaciones se omiten explícitamente), y la
> rama "con sitio web" suma como máximo 30+20=50. El máximo real es 50, así que
> ningún lead alcanza matemáticamente el rango "Alto" (70-100) salvo que ajustes la
> fórmula — esto ya no afecta el envío (que ahora es 100% manual para cualquier
> tier), pero sigue siendo relevante para el badge de puntaje y las estadísticas. Ver
> `src/lib/scoring.ts` para el detalle.

## Sobre los correos electrónicos de los negocios

Google Places (Text Search / Place Details) **no** expone direcciones de correo bajo
ningún campo — nunca las vas a recibir de ahí. Para que el flujo de envío no quede
muerto para negocios que sí tienen sitio web, cuando se revisan las señales de diseño
también se rastrea el HTML de la página en busca de un enlace `mailto:` o un patrón
de correo visible, y ese correo (si aparece) se usa como destinatario. Negocios sin
sitio web, o con sitio pero sin correo visible en el HTML, quedarán sin correo — el
sistema lo maneja sin fallar: se registra el lead igual (`pending_review`), solo que
en `/leads` no aparece el botón de enviar (se muestra "Sin correo" en su lugar).

## Variables de entorno

Copia `.env.local.example` a `.env.local` y completa:

- `GOOGLE_PLACES_API_KEY` — habilita "Places API" en Google Cloud Console.
- `PAGESPEED_API_KEY` — normalmente la misma key que la anterior (mismo proyecto de
  Google Cloud), pero se declara aparte por si quieres separarla. Habilita "PageSpeed
  Insights API".
- `ANTHROPIC_API_KEY` — key de Anthropic.
- `ANTHROPIC_MODEL` — opcional, por defecto `claude-sonnet-4-6` (ver nota abajo).
- `RESEND_API_KEY` — key de Resend.
- `FIREBASE_SERVICE_ACCOUNT` — el JSON completo del service account de Firebase,
  como string de una sola línea.
- `FROM_EMAIL` — remitente verificado en Resend.

> **Nota sobre el modelo de Claude:** el spec de producto pide explícitamente
> `claude-sonnet-4-6`. Verifica ese id de modelo contra la lista vigente de modelos
> de Anthropic antes de desplegar a producción — los ids de modelo se retiran
> periódicamente y este identificador puede necesitar actualizarse. Está
> centralizado en `src/lib/claude.ts` (y sobreescribible vía `ANTHROPIC_MODEL`) para
> que cambiarlo sea un solo lugar.

## Firestore

Colección `leads`. Cada documento sigue la forma de `Lead` en `src/lib/types.ts`:
datos del negocio (`name`, `address`, `city`, `category`, `phone`, `website`,
`email`), resultados de las verificaciones (`hasWebsite`, `pagespeedMobileScore`,
`designSignals`), el puntaje (`score`, `tier`, `weaknesses`), el correo generado
(`emailSubject`, `emailBody`), y el estado del pipeline (`status`, `scannedAt`,
`sentAt`, `createdAt`, `updatedAt`).

No se requiere ninguna configuración de índices compuestos: solo se ordena por
`createdAt`, así que el índice automático de Firestore es suficiente.

## Ejecutar en local

```bash
npm install
cp .env.local.example .env.local   # y completa las keys
npm run dev
```

## Despliegue en Vercel

- El escaneo (`/api/scan`) puede tardar varios minutos con 20 negocios, porque
  PageSpeed Insights es lento (varios segundos por sitio) y se corre secuencialmente
  para poder emitir progreso en tiempo real. La ruta pide `maxDuration = 300`
  segundos, pero **el plan Hobby de Vercel limita las funciones a ~10-60s sin importar
  esta configuración** — en Hobby, escanea con menos resultados o considera mover el
  pipeline a un worker en segundo plano. En Pro o superior, 300s es respetado.
- Todas las integraciones externas (Places, PageSpeed, Claude, Resend, Firestore)
  corren solo en rutas de servidor (`runtime = 'nodejs'`), nunca en el cliente.
