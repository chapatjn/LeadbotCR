import { getReasonChips } from '@/lib/reasons';
import type { LeadWithId } from '@/lib/types';

export function WhyChips({ lead }: { lead: LeadWithId }) {
  const reasons = getReasonChips(lead);

  if (reasons.length === 0) {
    return <span className="text-xs text-zinc-400">Sin debilidades detectadas</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => {
        const Icon = reason.icon;
        return (
          <span
            key={reason.key}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
          >
            <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
            {reason.label}
          </span>
        );
      })}
    </div>
  );
}
