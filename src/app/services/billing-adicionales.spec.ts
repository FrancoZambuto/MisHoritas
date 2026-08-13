import { BillingService } from './billing.service';
import { HoursService } from './hours.service';
import { ReportsService } from './reports.service';
import { StorageService, StorageKeys } from './storage.service';
import {
  billingValorKey,
  BillingSnapshots,
  createAdicionalId
} from '../models';
import { buildBillingPdfDocumentData } from './billing-pdf.model';

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

describe('Billing adicionales + PDF data', () => {
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
    await billingService.loadAdicionales();
  });

  it('Scenario A — hours + viáticos total', async () => {
    const key = billingValorKey('PEPE', 'Común');
    const snap = await billingService.confirmMonthBilling(
      2026, 7,
      { '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [key]: 10000 },
      [{ id: createAdicionalId(), concepto: 'Viáticos', monto: 20000, establecimiento: 'PEPE' }]
    );

    expect(snap.subtotalHoras).toBe(100000);
    expect(snap.subtotalAdicionales).toBe(20000);
    expect(snap.totalGeneral).toBe(120000);
  });

  it('Scenario B — multiple adicionales', async () => {
    const snap = await billingService.confirmMonthBilling(
      2026, 7,
      { '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [billingValorKey('PEPE', 'Común')]: 10000 },
      [
        { id: createAdicionalId(), concepto: 'Viáticos', monto: 20000 },
        { id: createAdicionalId(), concepto: 'Bono', monto: 15000 }
      ]
    );
    expect(snap.totalGeneral).toBe(135000);
  });

  it('Scenario C — historical integrity for adicionales', async () => {
    await billingService.confirmMonthBilling(
      2026, 7,
      { '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 1 }] },
      { [billingValorKey('PEPE', 'Común')]: 1000 },
      [{ id: createAdicionalId(), concepto: 'Viáticos', monto: 20000 }]
    );

    await billingService.confirmMonthBilling(
      2026, 8,
      { '2026-09-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 1 }] },
      { [billingValorKey('PEPE', 'Común')]: 1000 },
      [{ id: createAdicionalId(), concepto: 'Viáticos', monto: 30000 }]
    );

    expect(billingService.getSnapshot(2026, 7)!.adicionales[0].monto).toBe(20000);
    expect(billingService.getSnapshot(2026, 8)!.adicionales[0].monto).toBe(30000);
  });

  it('Scenario D — adicional attributed to establishment in reports', async () => {
    await billingService.confirmMonthBilling(
      2026, 0,
      { '2026-01-01': [{ establecimiento: 'Laboratorio', tipoHora: 'Común', cantidad: 10 }] },
      { [billingValorKey('Laboratorio', 'Común')]: 10000 },
      [{ id: createAdicionalId(), concepto: 'Viáticos', monto: 20000, establecimiento: 'Laboratorio' }]
    );

    const report = await reportsService.buildReport('current_year', new Date(2026, 0, 15));
    const lab = report.byEstablishment.find(e => e.name === 'Laboratorio');
    expect(lab?.revenue).toBe(120000);
  });

  it('Scenario E — unassociated adicional does not inflate other establishments', async () => {
    await billingService.confirmMonthBilling(
      2026, 0,
      { '2026-01-01': [{ establecimiento: 'Hospital', tipoHora: 'Común', cantidad: 10 }] },
      { [billingValorKey('Hospital', 'Común')]: 10000 },
      [{ id: createAdicionalId(), concepto: 'Bono', monto: 25000, establecimiento: null }]
    );

    const report = await reportsService.buildReport('current_year', new Date(2026, 0, 15));
    expect(report.summary.totalRevenue).toBe(125000);
    expect(report.byEstablishment.find(e => e.name === 'Hospital')?.revenue).toBe(100000);
    expect(report.byEstablishment.find(e => e.name === 'Sin establecimiento')?.revenue).toBe(25000);
  });

  it('Scenario F — effective hourly rate ignores adicionales', async () => {
    await billingService.confirmMonthBilling(
      2026, 0,
      { '2026-01-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 10 }] },
      { [billingValorKey('PEPE', 'Común')]: 10000 },
      [{ id: createAdicionalId(), concepto: 'Viáticos', monto: 50000 }]
    );

    const report = await reportsService.buildReport('current_year', new Date(2026, 0, 15));
    expect(report.summary.averageHourlyRate).toBe(10000);
    expect(report.summary.totalIncomePerHour).toBe(15000);
    expect(report.summary.hourlyRevenue).toBe(100000);
    expect(report.summary.adicionalesRevenue).toBe(50000);
  });

  it('marks snapshot outdated when adicionales change', async () => {
    const snap = await billingService.confirmMonthBilling(
      2026, 7,
      { '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 2 }] },
      { [billingValorKey('PEPE', 'Común')]: 5000 },
      [{ id: 'a1', concepto: 'Viáticos', monto: 10000 }]
    );

    expect(billingService.isSnapshotOutdated(
      snap,
      { '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 2 }] },
      [{ id: 'a1', concepto: 'Viáticos', monto: 10000 }]
    )).toBeFalse();

    expect(billingService.isSnapshotOutdated(
      snap,
      { '2026-08-01': [{ establecimiento: 'PEPE', tipoHora: 'Común', cantidad: 2 }] },
      [{ id: 'a1', concepto: 'Viáticos', monto: 15000 }]
    )).toBeTrue();
  });

  it('PDF document data uses historical snapshot values', async () => {
    const snap = await billingService.confirmMonthBilling(
      2026, 7,
      {
        '2026-08-01': [
          { establecimiento: 'Laboratorio PEPE', tipoHora: 'Común', cantidad: 10 },
          { establecimiento: 'Hospital', tipoHora: 'Noche', cantidad: 5 }
        ]
      },
      {
        [billingValorKey('Laboratorio PEPE', 'Común')]: 13000,
        [billingValorKey('Hospital', 'Noche')]: 20000
      },
      [
        { id: 'a1', concepto: 'Viáticos', monto: 25000, establecimiento: 'Laboratorio PEPE' },
        { id: 'a2', concepto: 'Bono', monto: 10000, establecimiento: null }
      ]
    );

    const doc = buildBillingPdfDocumentData(snap, 'Juan Pérez', (v) => `$${v}`);
    expect(doc.periodKey).toBe('2026-08');
    expect(doc.totalGeneral).toBe(snap.totalGeneral);
    expect(doc.subtotalAdicionales).toBe(35000);
    expect(doc.establishmentBlocks.length).toBe(2);
    expect(doc.unassignedAdicionales.length).toBe(1);
    expect(doc.fileBaseName).toContain('facturacion-juan-perez-2026-08');

    // Historical names preserved
    expect(doc.establishmentBlocks.some(b => b.title === 'Laboratorio PEPE')).toBeTrue();
  });

  it('migrates old snapshots without adicionales', async () => {
    await storage.set(StorageKeys.BILLING_SNAPSHOTS, {
      '2026-03': {
        periodKey: '2026-03',
        year: 2026,
        month: 2,
        confirmedAt: '2026-03-01T00:00:00.000Z',
        items: [{ establecimiento: 'PEPE', tipoHora: 'Común', totalHoras: 5, valorPorHora: 10000, subtotal: 50000 }],
        totalGeneral: 50000,
        hoursFingerprint: 'x',
        valoresUsados: { [billingValorKey('PEPE', 'Común')]: 10000 }
      }
    } as unknown as BillingSnapshots);

    const loaded = await billingService.loadSnapshots();
    expect(loaded['2026-03'].adicionales).toEqual([]);
    expect(loaded['2026-03'].subtotalAdicionales).toBe(0);
    expect(loaded['2026-03'].subtotalHoras).toBe(50000);
    expect(loaded['2026-03'].totalGeneral).toBe(50000);
  });
});
