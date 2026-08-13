import { Injectable } from '@angular/core';
import { BillingService } from './billing.service';
import {
  BillingSnapshot,
  BillingSnapshots,
  billingPeriodKey,
  billingValorKey,
  fromCentavos,
  toCentavos
} from '../models';
import {
  FinancialReport,
  ReportComparison,
  ReportMonthPoint,
  ReportNamedAmount,
  ReportPeriodId,
  ReportPeriodOption,
  ReportPeriodRange,
  ReportRatePoint,
  ReportSummary
} from '../models/report.model';

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  constructor(private billingService: BillingService) {}

  getPeriodOptions(): ReportPeriodOption[] {
    return [
      { id: 'current_month', label: 'Mes actual' },
      { id: 'previous_month', label: 'Mes anterior' },
      { id: 'last_3_months', label: 'Últimos 3 meses' },
      { id: 'last_6_months', label: 'Últimos 6 meses' },
      { id: 'last_12_months', label: 'Últimos 12 meses' },
      { id: 'current_year', label: 'Año actual' },
      { id: 'previous_year', label: 'Año anterior' }
    ];
  }

  resolvePeriod(periodId: ReportPeriodId, referenceDate: Date = new Date()): ReportPeriodRange {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();

    switch (periodId) {
      case 'current_month': {
        const start = billingPeriodKey(year, month);
        const prev = this.shiftMonth(year, month, -1);
        return {
          id: periodId,
          label: `${MONTH_LABELS[month]} ${year}`,
          startPeriodKey: start,
          endPeriodKey: start,
          previousStartPeriodKey: billingPeriodKey(prev.year, prev.month),
          previousEndPeriodKey: billingPeriodKey(prev.year, prev.month),
          isMultiMonth: false
        };
      }
      case 'previous_month': {
        const prev = this.shiftMonth(year, month, -1);
        const start = billingPeriodKey(prev.year, prev.month);
        const prevPrev = this.shiftMonth(prev.year, prev.month, -1);
        return {
          id: periodId,
          label: `${MONTH_LABELS[prev.month]} ${prev.year}`,
          startPeriodKey: start,
          endPeriodKey: start,
          previousStartPeriodKey: billingPeriodKey(prevPrev.year, prevPrev.month),
          previousEndPeriodKey: billingPeriodKey(prevPrev.year, prevPrev.month),
          isMultiMonth: false
        };
      }
      case 'last_3_months':
        return this.buildTrailingMonths(periodId, 'Últimos 3 meses', year, month, 3);
      case 'last_6_months':
        return this.buildTrailingMonths(periodId, 'Últimos 6 meses', year, month, 6);
      case 'last_12_months':
        return this.buildTrailingMonths(periodId, 'Últimos 12 meses', year, month, 12);
      case 'previous_year':
        return {
          id: periodId,
          label: `Año ${year - 1}`,
          startPeriodKey: billingPeriodKey(year - 1, 0),
          endPeriodKey: billingPeriodKey(year - 1, 11),
          previousStartPeriodKey: billingPeriodKey(year - 2, 0),
          previousEndPeriodKey: billingPeriodKey(year - 2, 11),
          isMultiMonth: true,
          yearLabel: year - 1
        };
      case 'current_year':
      default:
        return {
          id: 'current_year',
          label: `Año ${year}`,
          startPeriodKey: billingPeriodKey(year, 0),
          endPeriodKey: billingPeriodKey(year, 11),
          previousStartPeriodKey: billingPeriodKey(year - 1, 0),
          previousEndPeriodKey: billingPeriodKey(year - 1, 11),
          isMultiMonth: true,
          yearLabel: year
        };
    }
  }

  async buildReport(periodId: ReportPeriodId, referenceDate: Date = new Date()): Promise<FinancialReport> {
    await this.billingService.loadSnapshots();
    const period = this.resolvePeriod(periodId, referenceDate);
    const all = this.billingService.getSnapshots();
    const snapshots = this.filterSnapshots(all, period.startPeriodKey, period.endPeriodKey);
    const previousSnapshots = period.previousStartPeriodKey && period.previousEndPeriodKey
      ? this.filterSnapshots(all, period.previousStartPeriodKey, period.previousEndPeriodKey)
      : [];

    const monthlyEvolution = this.buildMonthlyEvolution(period, snapshots);
    const byEstablishment = this.aggregateByEstablishment(snapshots);
    const byHourType = this.aggregateByHourType(snapshots);
    const byAdicional = this.aggregateByAdicional(snapshots);
    const efficiencyByEstablishment = [...byEstablishment]
      .filter(item => item.hours > 0)
      .sort((a, b) => b.averageRate - a.averageRate);

    const hourlyRevenue = this.sumHourlyRevenue(snapshots);
    const adicionalesRevenue = this.sumAdicionalesRevenue(snapshots);
    const totalRevenue = this.sumRevenue(snapshots);
    const totalHours = this.sumHours(snapshots);
    const previousRevenue = this.sumRevenue(previousSnapshots);

    const summary: ReportSummary = {
      totalRevenue,
      hourlyRevenue,
      adicionalesRevenue,
      totalHours,
      averageHourlyRate: this.safeAverageRate(hourlyRevenue, totalHours),
      totalIncomePerHour: this.safeAverageRate(totalRevenue, totalHours),
      establishmentsCount: byEstablishment.filter(e => e.name !== 'Sin establecimiento' || e.revenue > 0).length,
      snapshotsCount: snapshots.length,
      comparison: this.buildComparison(period, totalRevenue, previousRevenue, previousSnapshots.length > 0),
      bestMonth: this.findBestMonth(monthlyEvolution),
      bestEstablishmentByRate: this.findBestByRate(efficiencyByEstablishment),
      monthlyAverageRevenue: period.isMultiMonth && snapshots.length > 0
        ? fromCentavos(Math.round(toCentavos(totalRevenue) / Math.max(1, monthlyEvolution.filter(m => m.revenue > 0).length || monthlyEvolution.length)))
        : null,
      yearLabel: period.yearLabel ?? null
    };

    if ((period.id === 'current_year' || period.id === 'previous_year') && snapshots.length > 0) {
      summary.monthlyAverageRevenue = fromCentavos(Math.round(toCentavos(totalRevenue) / 12));
    }

    return {
      period,
      summary,
      monthlyEvolution,
      byEstablishment,
      byHourType,
      byAdicional,
      efficiencyByEstablishment,
      snapshots,
      hasConfirmedData: snapshots.length > 0
    };
  }

  /**
   * Evolución de tarifas históricas por establecimiento + tipo,
   * usando solo valores confirmados en snapshots.
   */
  getRateEvolution(
    establecimiento: string,
    tipoHora: string,
    snapshots: BillingSnapshots = this.billingService.getSnapshots()
  ): ReportRatePoint[] {
    const key = billingValorKey(establecimiento, tipoHora);
    return Object.values(snapshots)
      .filter(snap => {
        const fromMap = snap.valoresUsados?.[key];
        if (fromMap != null) return true;
        return snap.items.some(
          item => item.establecimiento === establecimiento && item.tipoHora === tipoHora
        );
      })
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
      .map(snap => {
        const item = snap.items.find(
          i => i.establecimiento === establecimiento && i.tipoHora === tipoHora
        );
        const rate = snap.valoresUsados?.[key] ?? item?.valorPorHora ?? 0;
        return {
          periodKey: snap.periodKey,
          label: `${MONTH_SHORT[snap.month]} ${snap.year}`,
          rate
        };
      });
  }

  getRateSeriesOptions(snapshots: BillingSnapshots = this.billingService.getSnapshots()): Array<{
    establecimiento: string;
    tipoHora: string;
    label: string;
  }> {
    const map = new Map<string, { establecimiento: string; tipoHora: string }>();
    Object.values(snapshots).forEach(snap => {
      snap.items.forEach(item => {
        const key = billingValorKey(item.establecimiento, item.tipoHora);
        if (!map.has(key)) {
          map.set(key, {
            establecimiento: item.establecimiento,
            tipoHora: item.tipoHora
          });
        }
      });
    });

    return Array.from(map.values())
      .map(item => ({
        ...item,
        label: `${item.establecimiento} · ${item.tipoHora}`
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  formatCurrencyDetailed(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(value || 0);
  }

  formatHours(value: number): string {
    const rounded = Math.round((value || 0) * 10) / 10;
    return `${rounded.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} h`;
  }

  formatPercent(value: number): string {
    return `${(value || 0).toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    })}%`;
  }

  private buildTrailingMonths(
    id: ReportPeriodId,
    label: string,
    year: number,
    month: number,
    count: number
  ): ReportPeriodRange {
    const end = { year, month };
    const start = this.shiftMonth(year, month, -(count - 1));
    const prevEnd = this.shiftMonth(start.year, start.month, -1);
    const prevStart = this.shiftMonth(prevEnd.year, prevEnd.month, -(count - 1));

    return {
      id,
      label,
      startPeriodKey: billingPeriodKey(start.year, start.month),
      endPeriodKey: billingPeriodKey(end.year, end.month),
      previousStartPeriodKey: billingPeriodKey(prevStart.year, prevStart.month),
      previousEndPeriodKey: billingPeriodKey(prevEnd.year, prevEnd.month),
      isMultiMonth: true
    };
  }

  private shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
    const total = year * 12 + month + delta;
    return {
      year: Math.floor(total / 12),
      month: ((total % 12) + 12) % 12
    };
  }

  private filterSnapshots(
    all: BillingSnapshots,
    startPeriodKey: string,
    endPeriodKey: string
  ): BillingSnapshot[] {
    return Object.values(all)
      .filter(snap => snap.periodKey >= startPeriodKey && snap.periodKey <= endPeriodKey)
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }

  private sumRevenue(snapshots: BillingSnapshot[]): number {
    return fromCentavos(
      snapshots.reduce((sum, snap) => sum + toCentavos(snap.totalGeneral || 0), 0)
    );
  }

  private sumHours(snapshots: BillingSnapshot[]): number {
    return snapshots.reduce((sum, snap) => {
      return sum + snap.items.reduce((itemSum, item) => itemSum + (item.totalHoras || 0), 0);
    }, 0);
  }

  private safeAverageRate(revenue: number, hours: number): number {
    if (!hours || hours <= 0) return 0;
    return fromCentavos(Math.round(toCentavos(revenue) / hours));
  }

  private buildComparison(
    period: ReportPeriodRange,
    currentRevenue: number,
    previousRevenue: number,
    hasPreviousData: boolean
  ): ReportComparison | null {
    if (!hasPreviousData) return null;

    const deltaAmount = fromCentavos(toCentavos(currentRevenue) - toCentavos(previousRevenue));
    const deltaPercentage = previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10
      : null;

    let label = 'vs. período anterior';
    if (period.id === 'current_month' || period.id === 'previous_month') {
      label = 'vs. mes anterior';
    } else if (period.id === 'current_year' || period.id === 'previous_year') {
      label = 'vs. año anterior';
    }

    return {
      previousRevenue,
      deltaAmount,
      deltaPercentage,
      label
    };
  }

  private buildMonthlyEvolution(
    period: ReportPeriodRange,
    snapshots: BillingSnapshot[]
  ): ReportMonthPoint[] {
    const byKey = new Map(snapshots.map(snap => [snap.periodKey, snap]));
    const keys = this.enumeratePeriodKeys(period.startPeriodKey, period.endPeriodKey);

    return keys.map(periodKey => {
      const [yearStr, monthStr] = periodKey.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr) - 1;
      const snap = byKey.get(periodKey);
      const hours = snap
        ? snap.items.reduce((sum, item) => sum + (item.totalHoras || 0), 0)
        : 0;

      return {
        periodKey,
        year,
        month,
        label: `${MONTH_LABELS[month]} ${year}`,
        shortLabel: MONTH_SHORT[month],
        revenue: snap?.totalGeneral || 0,
        hours
      };
    });
  }

  private enumeratePeriodKeys(startPeriodKey: string, endPeriodKey: string): string[] {
    const [startYear, startMonth] = startPeriodKey.split('-').map(Number);
    const [endYear, endMonth] = endPeriodKey.split('-').map(Number);
    let year = startYear;
    let month = startMonth - 1;
    const endTotal = endYear * 12 + (endMonth - 1);
    const keys: string[] = [];

    while (year * 12 + month <= endTotal) {
      keys.push(billingPeriodKey(year, month));
      const next = this.shiftMonth(year, month, 1);
      year = next.year;
      month = next.month;
    }

    return keys;
  }

  private sumHourlyRevenue(snapshots: BillingSnapshot[]): number {
    return fromCentavos(
      snapshots.reduce((sum, snap) => {
        if (snap.subtotalHoras != null) {
          return sum + toCentavos(snap.subtotalHoras);
        }
        return sum + snap.items.reduce((s, item) => s + toCentavos(item.subtotal || 0), 0);
      }, 0)
    );
  }

  private sumAdicionalesRevenue(snapshots: BillingSnapshot[]): number {
    return fromCentavos(
      snapshots.reduce((sum, snap) => {
        if (snap.subtotalAdicionales != null) {
          return sum + toCentavos(snap.subtotalAdicionales);
        }
        return sum + (snap.adicionales || []).reduce((s, item) => s + toCentavos(item.monto || 0), 0);
      }, 0)
    );
  }

  private aggregateByHourType(snapshots: BillingSnapshot[]): ReportNamedAmount[] {
    const map = new Map<string, { revenueCentavos: number; hours: number }>();

    snapshots.forEach(snap => {
      snap.items.forEach(item => {
        const name = item.tipoHora;
        const current = map.get(name) || { revenueCentavos: 0, hours: 0 };
        current.revenueCentavos += toCentavos(item.subtotal || 0);
        current.hours += item.totalHoras || 0;
        map.set(name, current);
      });
    });

    return this.mapToNamedAmounts(map);
  }

  private aggregateByAdicional(snapshots: BillingSnapshot[]): ReportNamedAmount[] {
    const map = new Map<string, { revenueCentavos: number; hours: number }>();

    snapshots.forEach(snap => {
      (snap.adicionales || []).forEach(item => {
        const name = item.concepto;
        const current = map.get(name) || { revenueCentavos: 0, hours: 0 };
        current.revenueCentavos += toCentavos(item.monto || 0);
        map.set(name, current);
      });
    });

    return this.mapToNamedAmounts(map);
  }

  private aggregateByEstablishment(snapshots: BillingSnapshot[]): ReportNamedAmount[] {
    const map = new Map<string, { revenueCentavos: number; hours: number; hourlyCentavos: number }>();

    snapshots.forEach(snap => {
      snap.items.forEach(item => {
        const name = item.establecimiento;
        const current = map.get(name) || { revenueCentavos: 0, hours: 0, hourlyCentavos: 0 };
        const sub = toCentavos(item.subtotal || 0);
        current.revenueCentavos += sub;
        current.hourlyCentavos += sub;
        current.hours += item.totalHoras || 0;
        map.set(name, current);
      });

      (snap.adicionales || []).forEach(item => {
        const name = item.establecimiento?.trim() || 'Sin establecimiento';
        const current = map.get(name) || { revenueCentavos: 0, hours: 0, hourlyCentavos: 0 };
        current.revenueCentavos += toCentavos(item.monto || 0);
        map.set(name, current);
      });
    });

    const totalCentavos = Array.from(map.values()).reduce((sum, item) => sum + item.revenueCentavos, 0);

    return Array.from(map.entries())
      .map(([name, data]) => {
        const revenue = fromCentavos(data.revenueCentavos);
        const hourlyRevenue = fromCentavos(data.hourlyCentavos);
        return {
          name,
          revenue,
          hours: data.hours,
          percentage: totalCentavos > 0
            ? Math.round((data.revenueCentavos / totalCentavos) * 1000) / 10
            : 0,
          averageRate: this.safeAverageRate(hourlyRevenue, data.hours)
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  private mapToNamedAmounts(
    map: Map<string, { revenueCentavos: number; hours: number }>
  ): ReportNamedAmount[] {
    const totalCentavos = Array.from(map.values()).reduce((sum, item) => sum + item.revenueCentavos, 0);

    return Array.from(map.entries())
      .map(([name, data]) => {
        const revenue = fromCentavos(data.revenueCentavos);
        return {
          name,
          revenue,
          hours: data.hours,
          percentage: totalCentavos > 0
            ? Math.round((data.revenueCentavos / totalCentavos) * 1000) / 10
            : 0,
          averageRate: this.safeAverageRate(revenue, data.hours)
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  private findBestMonth(points: ReportMonthPoint[]): ReportMonthPoint | null {
    const withRevenue = points.filter(point => point.revenue > 0);
    if (withRevenue.length === 0) return null;
    return withRevenue.reduce((best, point) => point.revenue > best.revenue ? point : best);
  }

  private findBestByRate(items: ReportNamedAmount[]): ReportNamedAmount | null {
    const valid = items.filter(item => item.hours > 0 && item.averageRate > 0);
    if (valid.length === 0) return null;
    return valid.reduce((best, item) => item.averageRate > best.averageRate ? item : best);
  }
}
