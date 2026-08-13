import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { BillingSnapshot } from '../models';
import { UserService } from './user.service';
import { ReportsService } from './reports.service';
import { buildBillingPdfDocumentData, BillingPdfDocumentData } from './billing-pdf.model';

@Injectable({
  providedIn: 'root'
})
export class BillingPdfService {
  constructor(
    private userService: UserService,
    private reportsService: ReportsService
  ) {}

  buildDocumentData(snapshot: BillingSnapshot): BillingPdfDocumentData {
    return buildBillingPdfDocumentData(
      snapshot,
      this.userService.getNombre(),
      (value) => this.reportsService.formatCurrencyDetailed(value)
    );
  }

  async exportSnapshot(snapshot: BillingSnapshot): Promise<void> {
    const data = this.buildDocumentData(snapshot);
    const doc = this.renderPdf(data);
    const fileName = `${data.fileBaseName}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const base64 = doc.output('datauristring').split(',')[1];
      const written = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache
      });

      await Share.share({
        title: `Facturación ${data.periodLabel}`,
        text: `${data.appName} — ${data.periodLabel}`,
        url: written.uri,
        dialogTitle: 'Compartir PDF'
      });
      return;
    }

    doc.save(fileName);
  }

  private renderPdf(data: BillingPdfDocumentData): jsPDF {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.text(`${data.appName} — ${data.periodLabel}`, margin, y);
        y += 24;
        doc.setTextColor(20);
      }
    };

    const formatMoney = (value: number) => this.reportsService.formatCurrencyDetailed(value);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(data.appName, margin, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(data.userName, margin, y);
    y += 16;
    doc.text(`Período: ${data.periodLabel}`, margin, y);
    y += 14;
    doc.setTextColor(110);
    doc.text(`Generado el ${data.generatedAtLabel}`, margin, y);
    doc.setTextColor(20);
    y += 24;

    data.establishmentBlocks.forEach(block => {
      ensureSpace(60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(block.title, margin, y);
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      block.hourLines.forEach(line => {
        ensureSpace(28);
        doc.text(line.label, margin, y);
        doc.text(formatMoney(line.amount), pageWidth - margin, y, { align: 'right' });
        y += 12;
        if (line.detail) {
          doc.setTextColor(110);
          doc.text(line.detail, margin, y);
          doc.setTextColor(20);
          y += 12;
        }
        y += 4;
      });

      block.adicionalLines.forEach(line => {
        ensureSpace(28);
        doc.text(line.label, margin, y);
        doc.text(formatMoney(line.amount), pageWidth - margin, y, { align: 'right' });
        y += 12;
        if (line.detail) {
          doc.setTextColor(110);
          doc.text(line.detail, margin, y);
          doc.setTextColor(20);
          y += 12;
        }
        y += 4;
      });

      ensureSpace(24);
      doc.setFont('helvetica', 'bold');
      doc.text(`Subtotal ${block.title}`, margin, y);
      doc.text(formatMoney(block.subtotal), pageWidth - margin, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 22;
    });

    if (data.unassignedAdicionales.length > 0) {
      ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Otros adicionales', margin, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      data.unassignedAdicionales.forEach(line => {
        ensureSpace(28);
        doc.text(line.label, margin, y);
        doc.text(formatMoney(line.amount), pageWidth - margin, y, { align: 'right' });
        y += 12;
        if (line.detail) {
          doc.setTextColor(110);
          doc.text(line.detail, margin, y);
          doc.setTextColor(20);
          y += 12;
        }
        y += 4;
      });
      y += 8;
    }

    ensureSpace(70);
    doc.setDrawColor(180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;

    doc.setFontSize(11);
    doc.text('Subtotal horas', margin, y);
    doc.text(formatMoney(data.subtotalHoras), pageWidth - margin, y, { align: 'right' });
    y += 16;
    doc.text('Subtotal adicionales', margin, y);
    doc.text(formatMoney(data.subtotalAdicionales), pageWidth - margin, y, { align: 'right' });
    y += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total a facturar', margin, y);
    doc.text(formatMoney(data.totalGeneral), pageWidth - margin, y, { align: 'right' });

    // Keep contentWidth referenced for future layout tweaks without unused-var noise in some linters
    void contentWidth;

    return doc;
  }
}
