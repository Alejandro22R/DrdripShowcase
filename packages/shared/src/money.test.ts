import { describe, expect, it } from 'vitest';
import { adjustCents, centsToInput, clinicNow, formatCents, formatDuration, formatPrice, parsePriceInput } from './index.js';

describe('parsePriceInput', () => {
  it('parses whole and decimal amounts without floats', () => {
    expect(parsePriceInput('159')).toBe(15900);
    expect(parsePriceInput('$159.5')).toBe(15950);
    expect(parsePriceInput(' 1,250.00 ')).toBe(125000);
    expect(parsePriceInput('0.07')).toBe(7);
    expect(parsePriceInput('19.99')).toBe(1999); // 19.99 * 100 is 1998.9999… with floats
    expect(parsePriceInput('0')).toBe(0);
  });

  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1.2.3', '12345678', '1e3']) {
      expect(parsePriceInput(bad)).toBeNull();
    }
  });
});

describe('formatCents / formatPrice', () => {
  it('formats cents as USD', () => {
    expect(formatCents(15900)).toBe('$159');
    expect(formatCents(15950)).toBe('$159.50');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(125000)).toBe('$1,250');
    expect(centsToInput(125050)).toBe('1250.50');
  });

  it('refuses non-integer amounts', () => {
    expect(() => formatCents(159.5)).toThrow(RangeError);
    expect(() => formatCents(-1)).toThrow(RangeError);
  });

  it('supports the three price modes', () => {
    expect(formatPrice('fixed', 15900)).toEqual({ mode: 'fixed', prefix: '', text: '$159' });
    expect(formatPrice('from', 4500)).toEqual({ mode: 'from', prefix: 'Desde', text: '$45' });
    expect(formatPrice('ask', 0)).toEqual({ mode: 'ask', prefix: '', text: 'Consultar' });
  });
});

describe('formatDuration', () => {
  it('formats minutes', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(null)).toBe('');
  });
});

describe('adjustCents', () => {
  it('applies basis points with integer rounding', () => {
    expect(adjustCents(15900, 1000)).toBe(17490);
    expect(adjustCents(15900, -1000)).toBe(14310);
    expect(adjustCents(999, 250)).toBe(1024); // 1023.975 rounds half up
    expect(adjustCents(15900, 1000, true)).toBe(17500);
    expect(adjustCents(15900, 0)).toBe(15900);
  });
});

describe('clinicNow', () => {
  it('uses UTC-4 all year', () => {
    expect(clinicNow(new Date('2026-01-15T03:30:00Z'))).toEqual({ ymd: '2026-01-14', day: 3, minutes: 23 * 60 + 30 });
    expect(clinicNow(new Date('2026-07-15T13:00:00Z'))).toEqual({ ymd: '2026-07-15', day: 3, minutes: 9 * 60 });
  });
});
