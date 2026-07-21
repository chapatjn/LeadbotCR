import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';
import { sendColdEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual send action for the review queue: approves a medium-tier
// (pending_review) or no_email-but-now-has-an-email-added lead and actually
// sends the previously generated email via Resend.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const ref = db.collection(LEADS_COLLECTION).doc(params.id);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
    }

    const lead = snap.data()!;

    if (!lead.email) {
      return NextResponse.json({ error: 'Este lead no tiene un correo registrado.' }, { status: 400 });
    }
    if (!lead.emailSubject || !lead.emailBody) {
      return NextResponse.json({ error: 'Este lead no tiene un correo generado.' }, { status: 400 });
    }
    if (lead.status === 'sent') {
      return NextResponse.json({ error: 'Este lead ya fue enviado.' }, { status: 400 });
    }

    await sendColdEmail({ to: lead.email, subject: lead.emailSubject, body: lead.emailBody });

    const sentAt = new Date().toISOString();
    await ref.update({ status: 'sent', sentAt, updatedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true, sentAt });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error al enviar el correo.' }, { status: 500 });
  }
}
