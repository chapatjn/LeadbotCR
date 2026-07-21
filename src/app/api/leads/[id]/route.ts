import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lets a reviewer dismiss a pending_review lead without sending it (e.g. not
// a good fit after all). Only allows narrowing to a small set of manual,
// non-sending status transitions — actually sending lives in ./send/route.ts.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const status = body?.status;

    if (status !== 'not_qualified' && status !== 'pending_review') {
      return NextResponse.json(
        { error: 'status inválido. Usa el endpoint /send para marcar un lead como enviado.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ref = db.collection(LEADS_COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
    }

    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error al actualizar el lead.' }, { status: 500 });
  }
}
