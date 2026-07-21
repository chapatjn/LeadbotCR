'use client';

import { Mail } from 'lucide-react';

export function EmailCell({ email }: { email: string | null | undefined }) {
  if (!email) {
    return <span className="text-sm text-zinc-300">—</span>;
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
