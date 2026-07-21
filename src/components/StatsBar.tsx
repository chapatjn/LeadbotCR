import { Building2, CircleCheck, Clock, Globe, TrendingUp, type LucideIcon } from 'lucide-react';
import type { LeadWithId } from '@/lib/types';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
}

function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div>
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-black/50">{label}</p>
      </div>
    </div>
  );
}

export function StatsBar({ leads }: { leads: LeadWithId[] }) {
  const total = leads.length;
  const high = leads.filter((l) => l.tier === 'high').length;
  const sent = leads.filter((l) => l.status === 'sent').length;
  const noWebsite = leads.filter((l) => !l.hasWebsite).length;
  const pendingReview = leads.filter((l) => l.status === 'pending_review').length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Total escaneado" value={total} icon={Building2} accent="bg-zinc-100 text-zinc-600" />
      <StatCard label="Puntaje alto" value={high} icon={TrendingUp} accent="bg-emerald-100 text-emerald-700" />
      <StatCard label="Correos enviados" value={sent} icon={CircleCheck} accent="bg-blue-100 text-blue-700" />
      <StatCard label="Sin sitio web" value={noWebsite} icon={Globe} accent="bg-orange-100 text-orange-700" />
      <StatCard label="Pendientes de revisión" value={pendingReview} icon={Clock} accent="bg-amber-100 text-amber-700" />
    </div>
  );
}
