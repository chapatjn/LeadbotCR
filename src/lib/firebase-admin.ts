import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { requireEnv } from './env';

let cachedApp: App | null = null;

function getFirebaseApp(): App {
  if (cachedApp) return cachedApp;

  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0]!;
    return cachedApp;
  }

  const raw = requireEnv('FIREBASE_SERVICE_ACCOUNT');

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT no contiene un JSON válido. Debe ser el JSON completo del service account ' +
        'de Firebase pegado en una sola línea (sin saltos de línea reales entre las llaves — los "\\n" dentro ' +
        'de "private_key" deben quedar como texto literal, no como saltos de línea de verdad). Si lo copiaste ' +
        'desde el archivo descargado de Firebase, usa una herramienta para colapsarlo a una sola línea antes de pegarlo.'
    );
  }

  cachedApp = initializeApp({
    credential: cert(serviceAccount as any),
  });

  return cachedApp;
}

export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export const LEADS_COLLECTION = 'leads';
