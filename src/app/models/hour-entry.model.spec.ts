import {
  billingPeriodKey,
  billingValorKey,
  buildHoursFingerprint,
  multiplyHoursByRate,
  toCentavos,
  fromCentavos
} from './hour-entry.model';

describe('billing model helpers', () => {
  it('creates composite valor keys', () => {
    expect(billingValorKey('LEM LABS', 'Horas comunes')).toBe('LEM LABS:::Horas comunes');
  });

  it('creates month keys from 0-based month index', () => {
    expect(billingPeriodKey(2026, 10)).toBe('2026-11');
  });

  it('keeps money math stable for common ARS cases', () => {
    expect(multiplyHoursByRate(24, 13000)).toBe(312000);
    expect(toCentavos(15500)).toBe(1550000);
    expect(fromCentavos(1550000)).toBe(15500);
  });

  it('fingerprints ignore entry order within a day', () => {
    const a = buildHoursFingerprint({
      '2026-08-01': [
        { establecimiento: 'A', tipoHora: 'X', cantidad: 1 },
        { establecimiento: 'B', tipoHora: 'Y', cantidad: 2 }
      ]
    });
    const b = buildHoursFingerprint({
      '2026-08-01': [
        { establecimiento: 'B', tipoHora: 'Y', cantidad: 2 },
        { establecimiento: 'A', tipoHora: 'X', cantidad: 1 }
      ]
    });
    expect(a).toBe(b);
  });
});
