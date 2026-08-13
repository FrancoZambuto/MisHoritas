import { BillingService } from './billing.service';
import { HoursService } from './hours.service';
import { ReportsService } from './reports.service';
import { StorageService, StorageKeys } from './storage.service';
import { billingValorKey, BillingSnapshots } from '../models';

class MemoryStorageService {
  private data = new Map<string, unknown>();
  async init(): Promise<void> {}
  async set<T>(key: string, value: T): Promise<void> { this.data.set(key, value); }
  async get<T>(key: string): Promise<T | null> {
    return (this.data.has(key) ? this.data.get(key) : null) as T | null;
  }
  async remove(key: string): Promise<void> { this.data.delete(key); }
  async clear(): Promise<void> { this.data.clear(); }
  async keys(): Promise<string[]> { return [...this.data.keys()]; }
}

describe('ReportsService', () => {
  let storage: MemoryStorageService;
  let billingService: BillingService;
  let reportsService: ReportsService;

  beforeEach(async () => {
    storage = new MemoryStorageService();
    const hoursService = new HoursService(storage as unknown as StorageService);
    billingService = new BillingService(hoursService, storage as unknown as StorageService);
    reportsService = new ReportsService(billingService);
    await billingService.loadValores();
    await billingService.loadSnapshots();
  });

  it('Scenario A — historical rate change keeps monthly totals', async () => {
    const key = billingValorKey('PEPE', 'Común');
    await billingService.confirmMonthBilling(
      2026, 7,
      { '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [key]: 10000 }
    );
    await billingService.confirmMonthBilling(
      2026, 8,
      { '2026-09-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [key]: 12000 }
    );

    const august = await reportsService.buildReport('current_month', new Date(2026, 7, 15));
    const september = await reportsService.buildReport('current_month', new Date(2026, 8, 15));
    const year = await reportsService.buildReport('current_year', new Date(2026, 8, 15));

    expect(august.summary.totalRevenue).toBe(100000);
    expect(september.summary.totalRevenue).toBe(120000);
    expect(year.summary.totalRevenue).toBe(220000);
  });

  it('Scenario B — revenue by establishment percentages', async () => {
    await billingService.confirmMonthBilling(
      2026, 0,
      {
        '2026-01-01': [
          { establecimiento: 'Hospital', tipoHora: 'Común', cantidad: 10 },
          { establecimiento: 'Laboratorio', tipoHora: 'Común', cantidad: 10 }
        ]
      },
      {
        [billingValorKey('Hospital', 'Común')]: 50000,
        [billingValorKey('Laboratorio', 'Común')]: 30000
      }
    );

    const report = await reportsService.buildReport('current_year', new Date(2026, 0, 15));
    expect(report.summary.totalRevenue).toBe(800000);
    expect(report.byEstablishment[0].name).toBe('Hospital');
    expect(report.byEstablishment[0].percentage).toBe(62.5);
    expect(report.byEstablishment[1].percentage).toBe(37.5);
  });

  it('Scenario C — effective hourly rate', async () => {
    await billingService.confirmMonthBilling(
      2026, 2,
      { '2026-03-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 100 }] },
      { [billingValorKey('PEPE', 'Común')]: 20000 }
    );

    const report = await reportsService.buildReport('current_year', new Date(2026, 2, 15));
    expect(report.summary.totalHours).toBe(100);
    expect(report.summary.totalRevenue).toBe(2000000);
    expect(report.summary.averageHourlyRate).toBe(20000);
  });

  it('Scenario D — zero hours does not produce NaN/Infinity', async () => {
    const report = await reportsService.buildReport('current_year', new Date(2026, 5, 1));
    expect(report.summary.totalRevenue).toBe(0);
    expect(report.summary.totalHours).toBe(0);
    expect(report.summary.averageHourlyRate).toBe(0);
    expect(Number.isFinite(report.summary.averageHourlyRate)).toBeTrue();
  });

  it('Scenario E — rename does not break historical reports', async () => {
    await billingService.confirmMonthBilling(
      2026, 4,
      { '2026-05-01': [{ establecimiento: 'Laboratorio PEPE', tipoHora: 'Común', cantidad: 5 }] },
      { [billingValorKey('Laboratorio PEPE', 'Común')]: 10000 }
    );

    const report = await reportsService.buildReport('current_year', new Date(2026, 4, 15));
    expect(report.byEstablishment[0].name).toBe('Laboratorio PEPE');
    expect(report.summary.totalRevenue).toBe(50000);
  });

  it('Scenario F — deleted config still appears in historical reports', async () => {
    await billingService.confirmMonthBilling(
      2026, 6,
      { '2026-07-01': [{ establecimiento: 'Clínica Vieja', tipoHora: 'Guardia', cantidad: 8 }] },
      { [billingValorKey('Clínica Vieja', 'Guardia')]: 15000 }
    );

    // No config dependency: snapshots alone drive reports
    const stored = await storage.get<BillingSnapshots>(StorageKeys.BILLING_SNAPSHOTS);
    expect(stored?.['2026-07']).toBeTruthy();

    const report = await reportsService.buildReport('current_year', new Date(2026, 6, 15));
    expect(report.byEstablishment.some(e => e.name === 'Clínica Vieja')).toBeTrue();
    expect(report.summary.totalRevenue).toBe(120000);
  });

  it('Scenario G — multiple months chronology and best month', async () => {
    await billingService.confirmMonthBilling(
      2026, 0,
      { '2026-01-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [billingValorKey('PEPE', 'Común')]: 10000 }
    );
    await billingService.confirmMonthBilling(
      2026, 1,
      { '2026-02-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [billingValorKey('PEPE', 'Común')]: 20000 }
    );
    await billingService.confirmMonthBilling(
      2026, 2,
      { '2026-03-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [billingValorKey('PEPE', 'Común')]: 15000 }
    );

    const report = await reportsService.buildReport('current_year', new Date(2026, 3, 1));
    expect(report.summary.totalRevenue).toBe(450000);
    expect(report.summary.bestMonth?.periodKey).toBe('2026-02');
    expect(report.monthlyEvolution.map(m => m.periodKey)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'
    ]);
  });

  it('does not invent revenue from current rates without snapshots', async () => {
    await billingService.saveValores({ [billingValorKey('PEPE', 'Común')]: 99999 });
    const report = await reportsService.buildReport('current_year', new Date(2026, 0, 1));
    expect(report.hasConfirmedData).toBeFalse();
    expect(report.summary.totalRevenue).toBe(0);
  });
});
