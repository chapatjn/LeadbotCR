import { NextRequest, NextResponse } from 'next/server';
import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const statusFilter = req.nextUrl.searchParams.get('status');

    const snap = await db.collection(LEADS_COLLECTION).orderBy('createdAt', 'desc').limit(200).get();

    let leads = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? null,
      };
    });

    if (statusFilter) {
      leads = leads.filter((lead: any) => lead.status === statusFilter);
    }

    return NextResponse.json({ leads });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error al obtener leads.' }, { status: 500 });
  }
}
