// Money helpers. Prices are always integer cents (USD). Never use floats for money.

export type PriceMode = 'fixed' | 'from' | 'ask';
export const PRICE_MODES: readonly PriceMode[] = ['fixed', 'from', 'ask'];

export const MAX_PRICE_CENTS = 99_999_999; // $999,999.99

export interface FormattedPrice {
  mode: PriceMode;
  /** "Desde" for the `from` mode, empty otherwise. */
  prefix: string;
  /** "$159", "$159.50" or "Consultar". */
  text: string;
}

/**
 * Parses what a person types in a price box ("159", "$159.5", "1,250.00")
 * into integer cents using string math only. Returns null when invalid.
 */
export function parsePriceInput(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '').replace(/[\s,]/g, '');
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const dollars = Number.parseInt(match[1], 10);
  const cents = match[2] ? Number.parseInt(match[2].padEnd(2, '0'), 10) : 0;
  const total = dollars * 100 + cents;
  return total <= MAX_PRICE_CENTS ? total : null;
}

export function isValidCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_PRICE_CENTS;
}

/** 15900 -> "$159", 15950 -> "$159.50", 125000 -> "$1,250". */
export function formatCents(cents: number): string {
  if (!isValidCents(cents)) throw new RangeError(`Invalid cents amount: ${cents}`);
  const dollars = Math.trunc(cents / 100);
  const rest = cents % 100;
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest === 0 ? `$${grouped}` : `$${grouped}.${String(rest).padStart(2, '0')}`;
}

/** Plain "159.50" style string for inputs and CSV. */
export function centsToInput(cents: number): string {
  return formatCents(cents).replace(/[$,]/g, '');
}

export function formatPrice(mode: PriceMode, cents: number): FormattedPrice {
  if (mode === 'ask') return { mode, prefix: '', text: 'Consultar' };
  return { mode, prefix: mode === 'from' ? 'Desde' : '', text: formatCents(cents) };
}

/** 30 -> "30 min", 60 -> "1 h", 90 -> "1 h 30 min", 0 -> "". */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || !Number.isInteger(minutes) || minutes <= 0) return '';
  const h = Math.trunc(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Applies a percentage change expressed in basis points (250 = +2.5 %)
 * with integer math, rounding half up. Optionally rounds to whole dollars.
 */
export function adjustCents(cents: number, basisPoints: number, roundToDollar = false): number {
  if (!isValidCents(cents) || !Number.isInteger(basisPoints)) throw new RangeError('Invalid adjustment');
  const factor = 10_000 + basisPoints;
  if (factor < 0) throw new RangeError('Adjustment below -100 %');
  let result = Math.floor((cents * factor + 5_000) / 10_000);
  if (roundToDollar) result = Math.floor((result + 50) / 100) * 100;
  return Math.min(result, MAX_PRICE_CENTS);
}
