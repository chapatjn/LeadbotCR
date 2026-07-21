import { getReasonChips } from '@/lib/reasons';
import type { LeadWithId } from '@/lib/types';
import { Tooltip } from './Tooltip';

export function WhyChips({ lead }: { lead: LeadWithId }) {
  const reasons = getReasonChips(lead);

  if (reasons.length === 0) {
    return (
      <Tooltip content="No se detectó ninguna de las debilidades que buscamos (sin sitio, lento, diseño viejo, sin SSL, no apto para móviles).">
        <span className="text-xs text-zinc-400 cursor-help">Sin debilidades detectadas</span>
      </Tooltip>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => {
        const Icon = reason.icon;
        return (
          <Tooltip key={reason.key} content={reason.description}>
            <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
              <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
              {reason.label}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}
