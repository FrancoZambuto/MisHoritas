import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HoursService } from './hours.service';
import { StorageService, StorageKeys } from './storage.service';
import {
  HoursEntries,
  BillingItem,
  BillingResult,
  BillingLine,
  BillingSnapshot,
  BillingSnapshots,
  BillingAdicional,
  BillingAdicionalesByPeriod,
  billingValorKey,
  billingPeriodKey,
  multiplyHoursByRate,
  buildHoursFingerprint,
  buildAdicionalesFingerprint,
  sumAdicionales,
  normalizeAdicional,
  fromCentavos,
  toCentavos,
  DEFAULT_ADICIONAL_CONCEPTOS
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private valoresSubject = new BehaviorSubject<{ [key: string]: number }>({});
  public valores$: Observable<{ [key: string]: number }> = this.valoresSubject.asObservable();

  private snapshotsSubject = new BehaviorSubject<BillingSnapshots>({});
  public snapshots$: Observable<BillingSnapshots> = this.snapshotsSubject.asObservable();

  private adicionalesSubject = new BehaviorSubject<BillingAdicionalesByPeriod>({});
  public adicionales$: Observable<BillingAdicionalesByPeriod> = this.adicionalesSubject.asObservable();

  constructor(
    private hoursService: HoursService,
    private storageService: StorageService
  ) {}

  async loadValores(): Promise<{ [key: string]: number }> {
    const valores = await this.storageService.get<{ [key: string]: number }>(
      StorageKeys.VALORES_POR_HORA
    );
    const current = this.normalizeValoresMap(valores ?? {});
    this.valoresSubject.next(current);
    return current;
  }

  async saveValores(valoresPorHora: { [key: string]: number }): Promise<void> {
    const normalized = this.normalizeValoresMap(valoresPorHora);
    await this.storageService.set(StorageKeys.VALORES_POR_HORA, normalized);
    this.valoresSubject.next(normalized);
  }

  getValores(): { [key: string]: number } {
    return this.valoresSubject.getValue();
  }

  async loadSnapshots(): Promise<BillingSnapshots> {
    const snapshots = await this.storageService.get<BillingSnapshots>(
      StorageKeys.BILLING_SNAPSHOTS
    );
    const current = this.migrateSnapshots(snapshots ?? {});
    this.snapshotsSubject.next(current);

    if (JSON.stringify(snapshots ?? {}) !== JSON.stringify(current)) {
      await this.storageService.set(StorageKeys.BILLING_SNAPSHOTS, current);
    }

    return current;
  }

  getSnapshots(): BillingSnapshots {
    return this.snapshotsSubject.getValue();
  }

  getSnapshot(year: number, monthIndex: number): BillingSnapshot | null {
    const key = billingPeriodKey(year, monthIndex);
    return this.snapshotsSubject.getValue()[key] ?? null;
  }

  async loadAdicionales(): Promise<BillingAdicionalesByPeriod> {
    const stored = await this.storageService.get<BillingAdicionalesByPeriod>(
      StorageKeys.BILLING_ADICIONALES
    );
    const current = this.migrateAdicionalesByPeriod(stored ?? {});
    this.adicionalesSubject.next(current);
    return current;
  }

  getAdicionalesForPeriod(year: number, monthIndex: number): BillingAdicional[] {
    const key = billingPeriodKey(year, monthIndex);
    return [...(this.adicionalesSubject.getValue()[key] || [])];
  }

  async saveAdicionalesForPeriod(
    year: number,
    monthIndex: number,
    adicionales: BillingAdicional[]
  ): Promise<void> {
    const key = billingPeriodKey(year, monthIndex);
    const normalized = adicionales
      .map(item => normalizeAdicional(item))
      .filter((item): item is BillingAdicional => !!item);

    const all = {
      ...this.adicionalesSubject.getValue(),
      [key]: normalized
    };
    await this.storageService.set(StorageKeys.BILLING_ADICIONALES, all);
    this.adicionalesSubject.next(all);
  }

  /**
   * Si el período tiene snapshot y el draft está vacío, lo siembra desde el histórico.
   */
  async ensureAdicionalesDraftFromSnapshot(year: number, monthIndex: number): Promise<BillingAdicional[]> {
    const key = billingPeriodKey(year, monthIndex);
    const currentDraft = this.adicionalesSubject.getValue()[key];
    if (currentDraft && currentDraft.length > 0) {
      return [...currentDraft];
    }

    const snapshot = this.getSnapshot(year, monthIndex);
    if (snapshot?.adicionales?.length) {
      await this.saveAdicionalesForPeriod(year, monthIndex, snapshot.adicionales.map(a => ({ ...a })));
      return this.getAdicionalesForPeriod(year, monthIndex);
    }

    return currentDraft ? [...currentDraft] : [];
  }

  getSuggestedAdicionalConceptos(): string[] {
    const fromHistory = new Set<string>(DEFAULT_ADICIONAL_CONCEPTOS);
    Object.values(this.adicionalesSubject.getValue()).forEach(list => {
      list.forEach(item => {
        if (item.concepto?.trim()) fromHistory.add(item.concepto.trim());
      });
    });
    Object.values(this.snapshotsSubject.getValue()).forEach(snap => {
      (snap.adicionales || []).forEach(item => {
        if (item.concepto?.trim()) fromHistory.add(item.concepto.trim());
      });
    });
    return Array.from(fromHistory).sort((a, b) => a.localeCompare(b, 'es'));
  }

  isSnapshotOutdated(
    snapshot: BillingSnapshot,
    hoursEntries: HoursEntries,
    adicionales: BillingAdicional[] = []
  ): boolean {
    const hoursChanged = snapshot.hoursFingerprint !== buildHoursFingerprint(hoursEntries);
    const adicionalesChanged =
      (snapshot.adicionalesFingerprint || '') !== buildAdicionalesFingerprint(adicionales);
    return hoursChanged || adicionalesChanged;
  }

  resolveValor(
    valoresPorHora: { [key: string]: number },
    establecimiento: string,
    tipoHora: string
  ): number {
    const compositeKey = billingValorKey(establecimiento, tipoHora);
    if (valoresPorHora[compositeKey] != null) {
      return valoresPorHora[compositeKey];
    }
    if (valoresPorHora[tipoHora] != null) {
      return valoresPorHora[tipoHora];
    }
    return 0;
  }

  suggestValoresForLines(
    lines: BillingLine[],
    latestValores: { [key: string]: number } = this.getValores()
  ): { [key: string]: number } {
    const suggested: { [key: string]: number } = {};
    lines.forEach(line => {
      const key = billingValorKey(line.establecimiento, line.tipoHora);
      suggested[key] = this.resolveValor(latestValores, line.establecimiento, line.tipoHora);
    });
    return suggested;
  }

  calculateBilling(
    hoursEntries: HoursEntries,
    valoresPorHora: { [key: string]: number },
    adicionales: BillingAdicional[] = []
  ): BillingResult {
    const horasPorLinea: {
      [key: string]: { establecimiento: string; tipoHora: string; totalHoras: number }
    } = {};

    Object.values(hoursEntries).forEach(entries => {
      entries.forEach(entry => {
        const key = billingValorKey(entry.establecimiento, entry.tipoHora);
        if (!horasPorLinea[key]) {
          horasPorLinea[key] = {
            establecimiento: entry.establecimiento,
            tipoHora: entry.tipoHora,
            totalHoras: 0
          };
        }
        horasPorLinea[key].totalHoras += entry.cantidad;
      });
    });

    const items: BillingItem[] = Object.values(horasPorLinea).map(line => {
      const valorPorHora = this.resolveValor(valoresPorHora, line.establecimiento, line.tipoHora);
      const totalHoras = line.totalHoras;
      const subtotal = multiplyHoursByRate(totalHoras, valorPorHora);
      return {
        establecimiento: line.establecimiento,
        tipoHora: line.tipoHora,
        totalHoras,
        valorPorHora: fromCentavos(toCentavos(valorPorHora)),
        subtotal
      };
    });

    items.sort((a, b) => {
      const byEst = a.establecimiento.localeCompare(b.establecimiento, 'es');
      if (byEst !== 0) return byEst;
      return a.tipoHora.localeCompare(b.tipoHora, 'es');
    });

    const normalizedAdicionales = adicionales
      .map(item => normalizeAdicional(item))
      .filter((item): item is BillingAdicional => !!item);

    const subtotalHoras = fromCentavos(
      items.reduce((sum, item) => sum + toCentavos(item.subtotal), 0)
    );
    const subtotalAdicionales = sumAdicionales(normalizedAdicionales);
    const totalGeneral = fromCentavos(
      toCentavos(subtotalHoras) + toCentavos(subtotalAdicionales)
    );

    return {
      items,
      adicionales: normalizedAdicionales,
      subtotalHoras,
      subtotalAdicionales,
      totalGeneral
    };
  }

  calculateMonthlyBilling(
    year: number,
    month: number,
    valoresPorHora: { [key: string]: number },
    adicionales: BillingAdicional[] = []
  ): BillingResult {
    const monthlyHours = this.hoursService.getHoursForMonth(year, month);
    return this.calculateBilling(monthlyHours, valoresPorHora, adicionales);
  }

  async confirmMonthBilling(
    year: number,
    monthIndex: number,
    hoursEntries: HoursEntries,
    valoresPorHora: { [key: string]: number },
    adicionales: BillingAdicional[] = []
  ): Promise<BillingSnapshot> {
    const result = this.calculateBilling(hoursEntries, valoresPorHora, adicionales);
    const periodKey = billingPeriodKey(year, monthIndex);

    const valoresUsados: { [key: string]: number } = {};
    result.items.forEach(item => {
      const key = billingValorKey(item.establecimiento, item.tipoHora);
      valoresUsados[key] = item.valorPorHora;
    });

    const snapshotAdicionales = result.adicionales.map(item => ({ ...item }));

    const snapshot: BillingSnapshot = {
      periodKey,
      year,
      month: monthIndex,
      confirmedAt: new Date().toISOString(),
      items: result.items.map(item => ({ ...item })),
      adicionales: snapshotAdicionales,
      subtotalHoras: result.subtotalHoras,
      subtotalAdicionales: result.subtotalAdicionales,
      totalGeneral: result.totalGeneral,
      hoursFingerprint: buildHoursFingerprint(hoursEntries),
      adicionalesFingerprint: buildAdicionalesFingerprint(snapshotAdicionales),
      valoresUsados
    };

    const all = { ...this.snapshotsSubject.getValue(), [periodKey]: snapshot };
    await this.storageService.set(StorageKeys.BILLING_SNAPSHOTS, all);
    this.snapshotsSubject.next(all);

    await this.saveAdicionalesForPeriod(year, monthIndex, snapshotAdicionales);

    const latest = { ...this.getValores(), ...valoresUsados };
    await this.saveValores(latest);

    return snapshot;
  }

  snapshotToResult(snapshot: BillingSnapshot): BillingResult {
    const adicionales = (snapshot.adicionales || []).map(item => ({ ...item }));
    const subtotalHoras = snapshot.subtotalHoras != null
      ? snapshot.subtotalHoras
      : fromCentavos(snapshot.items.reduce((sum, item) => sum + toCentavos(item.subtotal), 0));
    const subtotalAdicionales = snapshot.subtotalAdicionales != null
      ? snapshot.subtotalAdicionales
      : sumAdicionales(adicionales);

    return {
      items: snapshot.items.map(item => ({ ...item })),
      adicionales,
      subtotalHoras,
      subtotalAdicionales,
      totalGeneral: snapshot.totalGeneral
    };
  }

  getHoursSummaryByLine(hoursEntries: HoursEntries): { [key: string]: number } {
    const summary: { [key: string]: number } = {};

    Object.values(hoursEntries).forEach(entries => {
      entries.forEach(entry => {
        const key = billingValorKey(entry.establecimiento, entry.tipoHora);
        if (!summary[key]) {
          summary[key] = 0;
        }
        summary[key] += entry.cantidad;
      });
    });

    return summary;
  }

  buildBillingLines(
    establecimientos: string[],
    tiposPorEstablecimiento: { [establecimiento: string]: string[] },
    hoursEntries: HoursEntries
  ): BillingLine[] {
    const linesMap = new Map<string, BillingLine>();

    establecimientos.forEach(establecimiento => {
      const tipos = tiposPorEstablecimiento[establecimiento] || [];
      tipos.forEach(tipoHora => {
        const key = billingValorKey(establecimiento, tipoHora);
        linesMap.set(key, { establecimiento, tipoHora });
      });
    });

    Object.values(hoursEntries).forEach(entries => {
      entries.forEach(entry => {
        const key = billingValorKey(entry.establecimiento, entry.tipoHora);
        if (!linesMap.has(key)) {
          linesMap.set(key, {
            establecimiento: entry.establecimiento,
            tipoHora: entry.tipoHora
          });
        }
      });
    });

    return Array.from(linesMap.values()).sort((a, b) => {
      const byEst = a.establecimiento.localeCompare(b.establecimiento, 'es');
      if (byEst !== 0) return byEst;
      return a.tipoHora.localeCompare(b.tipoHora, 'es');
    });
  }

  linesFromSnapshot(snapshot: BillingSnapshot): BillingLine[] {
    return snapshot.items.map(item => ({
      establecimiento: item.establecimiento,
      tipoHora: item.tipoHora
    }));
  }

  private normalizeValoresMap(valores: { [key: string]: number }): { [key: string]: number } {
    const normalized: { [key: string]: number } = {};
    Object.keys(valores || {}).forEach(key => {
      const raw = valores[key];
      const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (Number.isFinite(parsed)) {
        normalized[key] = fromCentavos(toCentavos(parsed));
      }
    });
    return normalized;
  }

  private migrateAdicionalesByPeriod(data: BillingAdicionalesByPeriod): BillingAdicionalesByPeriod {
    const migrated: BillingAdicionalesByPeriod = {};
    Object.keys(data || {}).forEach(key => {
      migrated[key] = (data[key] || [])
        .map(item => normalizeAdicional(item))
        .filter((item): item is BillingAdicional => !!item);
    });
    return migrated;
  }

  private migrateSnapshots(snapshots: BillingSnapshots): BillingSnapshots {
    const migrated: BillingSnapshots = {};

    Object.keys(snapshots || {}).forEach(key => {
      const snap = snapshots[key];
      if (!snap || !snap.periodKey) return;

      const items = (snap.items || []).map(item => ({
        establecimiento: item.establecimiento,
        tipoHora: item.tipoHora,
        totalHoras: Number(item.totalHoras) || 0,
        valorPorHora: fromCentavos(toCentavos(Number(item.valorPorHora) || 0)),
        subtotal: fromCentavos(toCentavos(Number(item.subtotal) || 0))
      }));

      const adicionales = (snap.adicionales || [])
        .map(item => normalizeAdicional(item))
        .filter((item): item is BillingAdicional => !!item);

      const valoresUsados: { [key: string]: number } = { ...(snap.valoresUsados || {}) };
      items.forEach(item => {
        const lineKey = billingValorKey(item.establecimiento, item.tipoHora);
        if (valoresUsados[lineKey] == null) {
          valoresUsados[lineKey] = item.valorPorHora;
        }
      });

      const subtotalHoras = snap.subtotalHoras != null
        ? fromCentavos(toCentavos(Number(snap.subtotalHoras)))
        : fromCentavos(items.reduce((s, i) => s + toCentavos(i.subtotal), 0));
      const subtotalAdicionales = snap.subtotalAdicionales != null
        ? fromCentavos(toCentavos(Number(snap.subtotalAdicionales)))
        : sumAdicionales(adicionales);
      const totalGeneral = snap.totalGeneral != null
        ? fromCentavos(toCentavos(Number(snap.totalGeneral)))
        : fromCentavos(toCentavos(subtotalHoras) + toCentavos(subtotalAdicionales));

      migrated[key] = {
        periodKey: snap.periodKey,
        year: snap.year,
        month: snap.month,
        confirmedAt: snap.confirmedAt || new Date(0).toISOString(),
        items,
        adicionales,
        subtotalHoras,
        subtotalAdicionales,
        totalGeneral,
        hoursFingerprint: snap.hoursFingerprint || '',
        adicionalesFingerprint: snap.adicionalesFingerprint || buildAdicionalesFingerprint(adicionales),
        valoresUsados: this.normalizeValoresMap(valoresUsados)
      };
    });

    return migrated;
  }
}
