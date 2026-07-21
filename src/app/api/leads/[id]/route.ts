import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The only manual, non-sending status transition a reviewer can make:
// dismiss a pending_review lead they don't want to pursue. Actual sending
// lives in /api/send-email — this route never sends anything.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const status = body?.status;

    if (status !== 'dismissed') {
      return NextResponse.json(
        { error: 'status inválido. Solo se puede descartar (dismissed) un lead desde este endpoint.' },
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

// Permanently removes a lead document — distinct from "dismiss" (PATCH
// above), which just changes status and keeps the lead around. This is a
// hard delete with no undo, so the client is expected to confirm with the
// user before calling it.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const ref = db.collection(LEADS_COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
    }

    await ref.delete();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error al eliminar el lead.' }, { status: 500 });
  }
}
