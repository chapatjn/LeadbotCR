import {
  Building2,
  Coffee,
  Croissant,
  Dumbbell,
  type LucideIcon,
  PawPrint,
  Pill,
  Scale,
  Scissors,
  Shirt,
  Sparkles,
  Stethoscope,
  UtensilsCrossed,
  Wrench,
  BedDouble,
  CarFront,
} from 'lucide-react';

// Normalized (lowercased, accent-stripped) category label -> icon. Matched
// against a business's category via substring so free-typed categories
// (e.g. "Restaurante Familiar") still resolve sensibly.
const CATEGORY_ICON_ENTRIES: [string, LucideIcon][] = [
  ['restaurante', UtensilsCrossed],
  ['hotel', BedDouble],
  ['salon de belleza', Scissors],
  ['salon', Scissors],
  ['clinica dental', Stethoscope],
  ['dental', Stethoscope],
  ['gimnasio', Dumbbell],
  ['ferreteria', Wrench],
  ['taller mecanico', CarFront],
  ['taller', CarFront],
  ['veterinaria', PawPrint],
  ['farmacia', Pill],
  ['tienda de ropa', Shirt],
  ['ropa', Shirt],
  ['bufete', Scale],
  ['abogado', Scale],
  ['cafeteria', Coffee],
  ['panaderia', Croissant],
  ['spa', Sparkles],
];

const DIACRITICS_PATTERN = new RegExp('[̀-ͯ]', 'g');

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .trim();
}

export function getCategoryIcon(category: string): LucideIcon {
  const normalized = normalize(category);
  const match = CATEGORY_ICON_ENTRIES.find(([key]) => normalized.includes(key));
  return match ? match[1] : Building2;
}
