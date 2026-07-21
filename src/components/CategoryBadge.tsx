import { getCategoryIcon } from '@/lib/category-icons';

export function CategoryBadge({ category }: { category: string }) {
  const Icon = getCategoryIcon(category);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate">{category}</span>
    </span>
  );
}
