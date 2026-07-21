'use client';

import { Mail } from 'lucide-react';
import { Tooltip } from './Tooltip';

export function EmailCell({ email }: { email: string | null | undefined }) {
  if (!email) {
    return (
      <Tooltip content="No encontramos un correo de contacto visible: ni en la ficha de Google, ni en el sitio web del negocio (si tiene). Sin esto, el correo generado no se puede enviar.">
        <span className="cursor-help text-sm text-zinc-300">—</span>
      </Tooltip>
    );
  }

  return (
    <a
      href={`mailto:${email}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-sm text-zinc-700 hover:text-cr-blue transition-colors"
    >
      <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" strokeWidth={2} />
      <span className="truncate max-w-[10rem]">{email}</span>
    </a>
  );
}
