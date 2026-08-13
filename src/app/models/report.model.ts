import { BillingSnapshot } from './hour-entry.model';

export type ReportPeriodId =
  | 'current_month'
  | 'previous_month'
  | 'current_year'
  | 'previous_year'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_12_months';

export interface ReportPeriodOption {
  id: ReportPeriodId;
  label: string;
}

export interface ReportPeriodRange {
  id: ReportPeriodId;
  label: string;
  /** Inclusive start as YYYY-MM */
  startPeriodKey: string;
  /** Inclusive end as YYYY-MM */
  endPeriodKey: string;
  /** Equivalent previous range for comparison (if available). */
  previousStartPeriodKey?: string;
  previousEndPeriodKey?: string;
  isMultiMonth: boolean;
  yearLabel?: number;
}

export interface ReportNamedAmount {
  name: string;
  revenue: number;
  hours: number;
  percentage: number;
  averageRate: number;
}

export interface ReportMonthPoint {
  periodKey: string;
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  revenue: number;
  hours: number;
}

export interface ReportRatePoint {
  periodKey: string;
  label: string;
  rate: number;
}

export interface ReportComparison {
  previousRevenue: number;
  deltaAmount: number;
  deltaPercentage: number | null;
  label: string;
}

export interface ReportSummary {
  totalRevenue: number;
  hourlyRevenue: number;
  adicionalesRevenue: number;
  totalHours: number;
  /** Promedio basado solo en ingresos por horas. */
  averageHourlyRate: number;
  /** Ingreso total (horas + adicionales) / horas. */
  totalIncomePerHour: number;
  establishmentsCount: number;
  snapshotsCount: number;
  comparison: ReportComparison | null;
  bestMonth: ReportMonthPoint | null;
  bestEstablishmentByRate: ReportNamedAmount | null;
  monthlyAverageRevenue: number | null;
  yearLabel: number | null;
}

export interface FinancialReport {
  period: ReportPeriodRange;
  summary: ReportSummary;
  monthlyEvolution: ReportMonthPoint[];
  byEstablishment: ReportNamedAmount[];
  byHourType: ReportNamedAmount[];
  byAdicional: ReportNamedAmount[];
  efficiencyByEstablishment: ReportNamedAmount[];
  snapshots: BillingSnapshot[];
  hasConfirmedData: boolean;
}
