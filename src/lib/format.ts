export function formatScannedAt(iso: string | null | undefined): string {
  if (!iso) return 'Fecha desconocida';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha desconocida';

  const datePart = date.toLocaleDateString('es-CR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timePart = date.toLocaleTimeString('es-CR', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart} a las ${timePart}`;
}

export function phoneHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}
