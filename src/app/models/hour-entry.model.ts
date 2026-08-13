export interface HourEntry {
  establecimiento: string;
  tipoHora: string;
  cantidad: number;
}

export interface HoursEntries {
  [date: string]: HourEntry[];
}

export interface BillingItem {
  establecimiento: string;
  tipoHora: string;
  totalHoras: number;
  valorPorHora: number;
  subtotal: number;
}

/** Compensación fija no horaria (viáticos, bono, etc.). */
export interface BillingAdicional {
  id: string;
  concepto: string;
  monto: number;
  /** null/undefined = sin establecimiento asociado */
  establecimiento?: string | null;
  nota?: string;
}

export interface BillingResult {
  items: BillingItem[];
  adicionales: BillingAdicional[];
  subtotalHoras: number;
  subtotalAdicionales: number;
  totalGeneral: number;
}

export interface BillingLine {
  establecimiento: string;
  tipoHora: string;
}

/** Snapshot inmutable de un mes facturado. */
export interface BillingSnapshot {
  periodKey: string;
  year: number;
  /** Mes 0-based (igual que Date#getMonth / getHoursForMonth). */
  month: number;
  confirmedAt: string;
  items: BillingItem[];
  adicionales: BillingAdicional[];
  subtotalHoras: number;
  subtotalAdicionales: number;
  totalGeneral: number;
  /** Fingerprint de las horas del mes al confirmar (detecta desactualización). */
  hoursFingerprint: string;
  /** Fingerprint de adicionales del mes al confirmar. */
  adicionalesFingerprint: string;
  /** Tarifas usadas en el cálculo, clave establecimiento:::tipoHora. */
  valoresUsados: { [key: string]: number };
}

export interface BillingSnapshots {
  [periodKey: string]: BillingSnapshot;
}

/** Drafts editables de adicionales por período (YYYY-MM). */
export interface BillingAdicionalesByPeriod {
  [periodKey: string]: BillingAdicional[];
}

export const BILLING_VALOR_KEY_SEPARATOR = ':::';

export const DEFAULT_ADICIONAL_CONCEPTOS = [
  'Viáticos',
  'Bono',
  'Reintegro',
  'Traslado',
  'Compensación especial'
];

export function billingValorKey(establecimiento: string, tipoHora: string): string {
  return `${establecimiento}${BILLING_VALOR_KEY_SEPARATOR}${tipoHora}`;
}

export function parseBillingValorKey(key: string): BillingLine | null {
  const separatorIndex = key.indexOf(BILLING_VALOR_KEY_SEPARATOR);
  if (separatorIndex <= 0) return null;
  return {
    establecimiento: key.slice(0, separatorIndex),
    tipoHora: key.slice(separatorIndex + BILLING_VALOR_KEY_SEPARATOR.length)
  };
}

/** Clave estable de período mensual sin depender de timezone del device. */
export function billingPeriodKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** Convierte un monto ARS a centavos enteros. */
export function toCentavos(amount: number): number {
  return Math.round(Number(amount) * 100);
}

/** Convierte centavos enteros a ARS. */
export function fromCentavos(centavos: number): number {
  return centavos / 100;
}

/**
 * Multiplica horas × tarifa usando centavos para evitar drift de float.
 * hours puede ser decimal (ej. 1.5).
 */
export function multiplyHoursByRate(hours: number, rate: number): number {
  const safeHours = Number(hours) || 0;
  const rateCentavos = toCentavos(rate);
  return fromCentavos(Math.round(safeHours * rateCentavos));
}

export function sumAdicionales(adicionales: BillingAdicional[]): number {
  return fromCentavos(
    (adicionales || []).reduce((sum, item) => sum + toCentavos(item.monto || 0), 0)
  );
}

/** Fingerprint determinista de las horas de un mes para detectar cambios. */
export function buildHoursFingerprint(hoursEntries: HoursEntries): string {
  const dates = Object.keys(hoursEntries).sort();
  return dates.map(date => {
    const entries = [...(hoursEntries[date] || [])]
      .map(e => `${e.establecimiento}\t${e.tipoHora}\t${e.cantidad}`)
      .sort();
    return `${date}=${entries.join('|')}`;
  }).join('\n');
}

/** Fingerprint determinista de adicionales del mes. */
export function buildAdicionalesFingerprint(adicionales: BillingAdicional[]): string {
  return [...(adicionales || [])]
    .map(a => [
      a.id,
      (a.concepto || '').trim(),
      toCentavos(a.monto || 0),
      (a.establecimiento || '').trim(),
      (a.nota || '').trim()
    ].join('\t'))
    .sort()
    .join('\n');
}

export function createAdicionalId(): string {
  return `adicional_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeAdicional(raw: Partial<BillingAdicional>): BillingAdicional | null {
  const concepto = (raw.concepto || '').trim();
  const monto = fromCentavos(toCentavos(Number(raw.monto) || 0));
  if (!concepto || monto <= 0) return null;

  return {
    id: raw.id || createAdicionalId(),
    concepto,
    monto,
    establecimiento: raw.establecimiento ? String(raw.establecimiento).trim() : null,
    nota: raw.nota ? String(raw.nota).trim() : undefined
  };
}
