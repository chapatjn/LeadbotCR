import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, LEADS_COLLECTION } from '@/lib/firebase-admin';
import { sendColdEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The only place an email actually gets sent in this app: a human reviewed
// the generated copy in the detail modal and explicitly approved it. There
// is no automatic sending anywhere in the scan pipeline.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leadId = (body?.leadId ?? '').toString().trim();

    if (!leadId) {
      return NextResponse.json({ error: 'leadId es requerido.' }, { status: 400 });
    }

    const db = getDb();
    const ref = db.collection(LEADS_COLLECTION).doc(leadId);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
    }

    const lead = snap.data()!;

    if (lead.status !== 'pending_review') {
      return NextResponse.json({ error: 'Este lead ya no está pendiente de revisión.' }, { status: 400 });
    }
    if (!lead.email) {
      return NextResponse.json({ error: 'Este lead no tiene un correo de contacto registrado.' }, { status: 400 });
    }
    if (!lead.emailSubject || !lead.emailBody) {
      return NextResponse.json({ error: 'Este lead no tiene un correo generado.' }, { status: 400 });
    }

    await sendColdEmail({ to: lead.email, subject: lead.emailSubject, body: lead.emailBody });

    const sentAt = new Date().toISOString();
    await ref.update({ status: 'sent', sentAt, updatedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true, sentAt });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error al enviar el correo.' }, { status: 500 });
  }
}
