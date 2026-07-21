// Sentinel value for the "All Costa Rica" location option — never a real
// city name, so it's safe to check for with a simple equality test.
export const ALL_COSTA_RICA = '__all_costa_rica__';
export const ALL_COSTA_RICA_LABEL = 'Todo Costa Rica';

export const CR_CITIES = [
  'San José',
  'Alajuela',
  'Heredia',
  'Cartago',
  'Liberia',
  'Puntarenas',
  'Limón',
  'Pérez Zeledón',
  'Nicoya',
  'Ciudad Quesada',
] as const;

export const CR_CATEGORIES = [
  'Restaurante',
  'Hotel',
  'Salón de Belleza',
  'Clínica Dental',
  'Gimnasio',
  'Ferretería',
  'Farmacia',
  'Supermercado',
  'Abogado',
  'Contador',
] as const;

export const RESULT_COUNT_OPTIONS = [5, 10, 20, 50] as const;
export const DEFAULT_RESULT_COUNT = 20;
// Server-side ceiling regardless of what a client sends — Google Places
// Text Search caps out at 3 pages (~60 results) per query anyway.
export const MAX_ALLOWED_RESULTS = 50;
