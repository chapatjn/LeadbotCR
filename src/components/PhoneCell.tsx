'use client';

import { Phone } from 'lucide-react';
import { phoneHref } from '@/lib/format';
import { Tooltip } from './Tooltip';

export function PhoneCell({ phone }: { phone: string | null | undefined }) {
  if (!phone) {
    return (
      <Tooltip content="Google no tiene un número de teléfono registrado para este negocio.">
        <span className="cursor-help text-sm text-zinc-300">—</span>
      </Tooltip>
    );
  }

  const href = phoneHref(phone);

  if (!href) {
    return <span className="text-sm text-zinc-600">{phone}</span>;
  }

  return (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-sm text-zinc-700 hover:text-cr-blue transition-colors"
    >
      <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" strokeWidth={2} />
      {phone}
    </a>
  );
}
