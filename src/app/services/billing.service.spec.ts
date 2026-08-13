import {
  billingPeriodKey,
  billingValorKey,
  buildHoursFingerprint,
  multiplyHoursByRate,
  toCentavos,
  fromCentavos,
  HoursEntries,
  BillingSnapshots
} from '../models';
import { BillingService } from './billing.service';
import { HoursService } from './hours.service';
import { StorageService, StorageKeys } from './storage.service';

class MemoryStorageService {
  private data = new Map<string, unknown>();

  async init(): Promise<void> {}

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.data.has(key) ? this.data.get(key) : null) as T | null;
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }
}

describe('Billing money helpers', () => {
  it('multiplies hours × rate using centavos', () => {
    expect(multiplyHoursByRate(10, 10000)).toBe(100000);
    expect(multiplyHoursByRate(1.5, 13000)).toBe(19500);
    expect(toCentavos(13.005)).toBe(1301);
    expect(fromCentavos(1301)).toBe(13.01);
  });
});

describe('Billing period and fingerprint', () => {
  it('builds stable period keys without timezone', () => {
    expect(billingPeriodKey(2026, 7)).toBe('2026-08');
    expect(billingPeriodKey(2026, 0)).toBe('2026-01');
  });

  it('builds deterministic fingerprints', () => {
    const hours: HoursEntries = {
      '2026-08-02': [
        { establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 4 },
        { establecimiento: 'PEPE', tipoHora: 'Finde', cantidad: 2 }
      ],
      '2026-08-01': [
        { establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 6 }
      ]
    };

    const a = buildHoursFingerprint(hours);
    const b = buildHoursFingerprint({
      '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 6 }],
      '2026-08-02': [
        { establecimiento: 'PEPE', tipoHora: 'Finde', cantidad: 2 },
        { establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 4 }
      ]
    });
    expect(a).toBe(b);

    const changed = buildHoursFingerprint({
      ...hours,
      '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 7 }]
    });
    expect(changed).not.toBe(a);
  });
});

describe('BillingService historical integrity', () => {
  let storage: MemoryStorageService;
  let hoursService: HoursService;
  let billingService: BillingService;

  beforeEach(async () => {
    storage = new MemoryStorageService();
    hoursService = new HoursService(storage as unknown as StorageService);
    billingService = new BillingService(hoursService, storage as unknown as StorageService);
    await billingService.loadValores();
    await billingService.loadSnapshots();
    await hoursService.loadHours();
  });

  it('Scenario A — rate changes do not mutate previous months', async () => {
    const augustHours: HoursEntries = {
      '2026-08-10': [
        { establecimiento: 'Laboratorio PEPE', tipoHora: 'Hora común', cantidad: 10 }
      ]
    };
    const septemberHours: HoursEntries = {
      '2026-09-05': [
        { establecimiento: 'Laboratorio PEPE', tipoHora: 'Hora común', cantidad: 8 }
      ]
    };

    const augustSnap = await billingService.confirmMonthBilling(
      2026,
      7,
      augustHours,
      { [billingValorKey('Laboratorio PEPE', 'Hora común')]: 10000 }
    );

    expect(augustSnap.totalGeneral).toBe(100000);
    expect(augustSnap.items[0].valorPorHora).toBe(10000);

    const septemberSnap = await billingService.confirmMonthBilling(
      2026,
      8,
      septemberHours,
      { [billingValorKey('Laboratorio PEPE', 'Hora común')]: 12000 }
    );

    expect(septemberSnap.totalGeneral).toBe(96000);
    expect(septemberSnap.items[0].valorPorHora).toBe(12000);

    const reopenedAugust = billingService.getSnapshot(2026, 7)!;
    expect(reopenedAugust.totalGeneral).toBe(100000);
    expect(reopenedAugust.items[0].valorPorHora).toBe(10000);
    expect(billingService.getValores()[billingValorKey('Laboratorio PEPE', 'Hora común')]).toBe(12000);
  });

  it('Scenario B — rename does not break historical snapshot names', async () => {
    const hours: HoursEntries = {
      '2026-08-01': [
        { establecimiento: 'Laboratorio PEPE', tipoHora: 'Hora común', cantidad: 24 }
      ]
    };

    await billingService.confirmMonthBilling(
      2026,
      7,
      hours,
      { [billingValorKey('Laboratorio PEPE', 'Hora común')]: 13000 }
    );

    // Simula renombre en config: no tocamos el snapshot
    const snap = billingService.getSnapshot(2026, 7)!;
    expect(snap.items[0].establecimiento).toBe('Laboratorio PEPE');
    expect(snap.totalGeneral).toBe(312000);
  });

  it('Scenario C — delete config does not remove historical billing', async () => {
    const hours: HoursEntries = {
      '2026-08-01': [
        { establecimiento: 'Hospital ABC', tipoHora: 'Guardia', cantidad: 5 }
      ]
    };

    await billingService.confirmMonthBilling(
      2026,
      7,
      hours,
      { [billingValorKey('Hospital ABC', 'Guardia')]: 20000 }
    );

    // Persistencia del snapshot independiente de la config actual
    const stored = await storage.get<BillingSnapshots>(StorageKeys.BILLING_SNAPSHOTS);
    expect(stored?.['2026-08']?.items[0].establecimiento).toBe('Hospital ABC');
    expect(stored?.['2026-08']?.totalGeneral).toBe(100000);
  });

  it('Scenario D — editing hours marks snapshot outdated without silent overwrite', async () => {
    const original: HoursEntries = {
      '2026-08-01': [
        { establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }
      ]
    };
    const edited: HoursEntries = {
      '2026-08-01': [
        { establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 12 }
      ]
    };

    const snap = await billingService.confirmMonthBilling(
      2026,
      7,
      original,
      { [billingValorKey('PEPE', 'Común')]: 10000 }
    );

    expect(billingService.isSnapshotOutdated(snap, original)).toBeFalse();
    expect(billingService.isSnapshotOutdated(snap, edited)).toBeTrue();
    expect(billingService.getSnapshot(2026, 7)!.totalGeneral).toBe(100000);
  });

  it('Scenario E — latest rate suggestion without mutating older months', async () => {
    const key = billingValorKey('PEPE', 'Común');

    await billingService.confirmMonthBilling(
      2026,
      7,
      { '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [key]: 13000 }
    );

    expect(billingService.suggestValoresForLines(
      [{ establecimiento: 'PEPE', tipoHora: 'Común' }]
    )[key]).toBe(13000);

    await billingService.confirmMonthBilling(
      2026,
      8,
      { '2026-09-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 4 }] },
      { [key]: 15500 }
    );

    expect(billingService.suggestValoresForLines(
      [{ establecimiento: 'PEPE', tipoHora: 'Común' }]
    )[key]).toBe(15500);

    expect(billingService.getSnapshot(2026, 7)!.items[0].valorPorHora).toBe(13000);
    expect(billingService.getSnapshot(2026, 9 - 1)!.items[0].valorPorHora).toBe(15500);
  });
});
