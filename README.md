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

1. **`/`** — Escáner: elige categoría de negocio y ciudad, y dispara el pipeline.
2. **`POST /api/scan`** — busca negocios en Google Places, evalúa cada uno, genera el
   correo con Claude cuando corresponde, envía por Resend si califica, y guarda todo
   en Firestore. Responde con un stream NDJSON de eventos de progreso que la UI
   consume en tiempo real (sin polling).
3. **`/leads`** — cola de revisión: lista todos los leads guardados, con filtros por
   estado. Los leads de puntaje medio (`pending_review`) se pueden aprobar y enviar
   manualmente desde ahí, o descartar.

## Motor de puntaje (0-100)

| Señal | Puntos |
|---|---|
| No hay sitio web en Google Places | +50 |
| Sitio existe pero PageSpeed móvil < 50 | +30 |
| Sitio existe con señales de diseño desactualizado (sin meta viewport, sin HTTPS, o copyright > 2 años de antigüedad) | +20 |

Si no hay sitio web, se omiten las verificaciones de PageSpeed y diseño (no hay nada
que revisar), y el lead queda marcado con un flag manual.

- **Alto (70-100):** correo generado y enviado automáticamente.
- **Medio (40-69):** correo generado, guardado como `pending_review`, **no** se envía
  hasta aprobación manual en `/leads`.
- **Bajo (0-39):** se omite, se guarda como `not_qualified`.

> **Nota sobre el puntaje:** tal como está especificado, la rama "sin sitio web" se
> queda en 50 puntos (las otras dos verificaciones se omiten explícitamente), y la
> rama "con sitio web" suma como máximo 30+20=50. Es decir, con las reglas literales
> ningún lead puede matemáticamente alcanzar el rango "Alto" (70-100) — el máximo
> real es 50, así que todo cae en "Medio" en el peor/mejor de los casos. Esto está
> implementado tal cual se pidió (ver `src/lib/scoring.ts`), pero si quieres que el
> tier "Alto" (envío automático) sea alcanzable, la forma más simple es sumar los 20
> puntos de "diseño desactualizado" también a los leads sin sitio web (un negocio sin
> sitio, por definición, no tiene un diseño "moderno"), lo cual los llevaría a 70.
> Es un cambio de una línea en `scoreLead()`.

## Sobre los correos electrónicos de los negocios

Google Places (Text Search / Place Details) **no** expone direcciones de correo bajo
ningún campo — nunca las vas a recibir de ahí. Para que el flujo de envío no quede
muerto para negocios que sí tienen sitio web, cuando se revisan las señales de diseño
también se rastrea el HTML de la página en busca de un enlace `mailto:` o un patrón
de correo visible, y ese correo (si aparece) se usa como destinatario. Negocios sin
sitio web, o con sitio pero sin correo visible en el HTML, quedarán sin correo — el
sistema lo maneja sin fallar: se registra el lead igual, solo que no se envía nada
(estado `no_email`).

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
