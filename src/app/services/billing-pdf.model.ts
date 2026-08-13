import { BillingAdicional, BillingItem, BillingSnapshot } from '../models';

export interface BillingPdfLine {
  label: string;
  detail?: string;
  amount: number;
}

export interface BillingPdfEstablishmentBlock {
  title: string;
  hourLines: BillingPdfLine[];
  adicionalLines: BillingPdfLine[];
  subtotal: number;
}

export interface BillingPdfDocumentData {
  appName: string;
  userName: string;
  periodLabel: string;
  periodKey: string;
  generatedAtLabel: string;
  establishmentBlocks: BillingPdfEstablishmentBlock[];
  unassignedAdicionales: BillingPdfLine[];
  subtotalHoras: number;
  subtotalAdicionales: number;
  totalGeneral: number;
  fileBaseName: string;
}

export function buildBillingPdfDocumentData(
  snapshot: BillingSnapshot,
  userName: string,
  formatCurrency: (value: number) => string
): BillingPdfDocumentData {
  const monthLabels = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const periodLabel = `${monthLabels[snapshot.month] || ''} ${snapshot.year}`.trim();
  const generatedAtLabel = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date());

  const estMap = new Map<string, {
    hourLines: BillingPdfLine[];
    adicionalLines: BillingPdfLine[];
    subtotalCentavos: number;
  }>();

  const ensureEst = (name: string) => {
    if (!estMap.has(name)) {
      estMap.set(name, { hourLines: [], adicionalLines: [], subtotalCentavos: 0 });
    }
    return estMap.get(name)!;
  };

  snapshot.items.forEach((item: BillingItem) => {
    const block = ensureEst(item.establecimiento);
    block.hourLines.push({
      label: item.tipoHora,
      detail: `${item.totalHoras} h × ${formatCurrency(item.valorPorHora)}`,
      amount: item.subtotal
    });
    block.subtotalCentavos += Math.round(item.subtotal * 100);
  });

  const unassignedAdicionales: BillingPdfLine[] = [];
  (snapshot.adicionales || []).forEach((item: BillingAdicional) => {
    const line: BillingPdfLine = {
      label: item.concepto,
      detail: item.nota || undefined,
      amount: item.monto
    };
    if (item.establecimiento?.trim()) {
      const block = ensureEst(item.establecimiento.trim());
      block.adicionalLines.push(line);
      block.subtotalCentavos += Math.round(item.monto * 100);
    } else {
      unassignedAdicionales.push(line);
    }
  });

  const establishmentBlocks: BillingPdfEstablishmentBlock[] = Array.from(estMap.entries())
    .map(([title, data]) => ({
      title,
      hourLines: data.hourLines,
      adicionalLines: data.adicionalLines,
      subtotal: data.subtotalCentavos / 100
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'es'));

  const safeUser = (userName || 'usuario')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'usuario';

  return {
    appName: 'HoritasBioq',
    userName: userName || 'Usuario',
    periodLabel,
    periodKey: snapshot.periodKey,
    generatedAtLabel,
    establishmentBlocks,
    unassignedAdicionales,
    subtotalHoras: snapshot.subtotalHoras ?? snapshot.items.reduce((s, i) => s + i.subtotal, 0),
    subtotalAdicionales: snapshot.subtotalAdicionales ?? (snapshot.adicionales || []).reduce((s, i) => s + i.monto, 0),
    totalGeneral: snapshot.totalGeneral,
    fileBaseName: `facturacion-${safeUser}-${snapshot.periodKey}`
  };
}
