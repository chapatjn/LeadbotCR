import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedApp: App | null = null;

function getFirebaseApp(): App {
  if (cachedApp) return cachedApp;

  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0]!;
    return cachedApp;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON del service account de Firebase).'
    );
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT no contiene un JSON válido. Debe ser el JSON completo del service account en una sola línea.'
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
