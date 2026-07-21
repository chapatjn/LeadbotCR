import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';
import { LeadsReviewClient } from '@/components/LeadsReviewClient';
import type { LeadWithId } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function fetchInitialLeads(): Promise<{ leads: LeadWithId[]; error: string | null }> {
  try {
    const db = getDb();
    const snap = await db.collection(LEADS_COLLECTION).orderBy('createdAt', 'desc').limit(200).get();
    const leads = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? null,
      } as LeadWithId;
    });
    return { leads, error: null };
  } catch (err: any) {
    return { leads: [], error: err?.message ?? 'Error al conectar con Firestore.' };
  }
}

export default async function LeadsPage() {
  const { leads, error } = await fetchInitialLeads();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Revisión de leads</h1>
        <p className="text-sm text-black/60">
          Leads de puntaje medio quedan aquí para aprobación manual antes de enviarse. Los de puntaje alto se
          envían automáticamente durante el escaneo.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los leads: {error}
        </div>
      ) : (
        <LeadsReviewClient initialLeads={leads} />
      )}
    </div>
  );
}
