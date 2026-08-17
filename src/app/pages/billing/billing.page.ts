import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  NavController,
  AlertController,
  ToastController,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline,
  analyticsOutline,
  timeOutline,
  calculatorOutline,
  warningOutline,
  checkmarkCircleOutline,
  addOutline,
  trashOutline,
  createOutline,
  documentOutline,
  cashOutline
} from 'ionicons/icons';
import { UserService, HoursService, BillingService } from '../../services';
import { BillingPdfService } from '../../services/billing-pdf.service';
import { I18nService, TranslatePipe } from '../../services/i18n.service';
import { AdicionalModalComponent } from '../../components';
import {
  BillingResult,
  BillingLine,
  BillingSnapshot,
  BillingAdicional,
  HoursEntries,
  billingValorKey
} from '../../models';

@Component({
  selector: 'app-billing',
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class BillingPage implements OnInit {
  billingLines: BillingLine[] = [];
  private configuredLines: BillingLine[] = [];
  valoresMap: { [key: string]: number | null } = {};
  hoursEntries: HoursEntries = {};
  billingResult: BillingResult | null = null;
  hoursSummary: { [key: string]: number } = {};
  currentSnapshot: BillingSnapshot | null = null;
  isSnapshotOutdated = false;
  adicionales: BillingAdicional[] = [];
  conceptoSuggestions: string[] = [];
  exportingPdf = false;
  
  selectedMonth: number = new Date().getMonth();
  selectedYear: number = new Date().getFullYear();
  
  get months(): string[] {
    return Array.from({ length: 12 }, (_, i) => this.i18n.t(`months.${i}`));
  }
  
  years: number[] = [];

  private persistDraftTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private navController: NavController,
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController,
    private userService: UserService,
    private hoursService: HoursService,
    private billingService: BillingService,
    private billingPdfService: BillingPdfService,
    private i18n: I18nService
  ) {
    addIcons({ 
      arrowBackOutline,
      analyticsOutline,
      timeOutline,
      calculatorOutline,
      warningOutline,
      checkmarkCircleOutline,
      addOutline,
      trashOutline,
      createOutline,
      documentOutline,
      cashOutline
    });
    
    const currentYear = new Date().getFullYear();
    this.years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.userService.loadUser(),
      this.hoursService.loadHours(),
      this.billingService.loadValores(),
      this.billingService.loadSnapshots(),
      this.billingService.loadAdicionales()
    ]);
    await this.loadMonthlyData();
  }

  get establecimientos(): string[] {
    return this.userService.getEstablecimientos();
  }

  get hasConfiguredTipos(): boolean {
    return this.configuredLines.length > 0 || this.userService.getAllTiposDeHora().length > 0;
  }

  get emptyStateMessage(): string {
    if (this.hasConfiguredTipos || this.currentSnapshot || this.adicionales.length > 0) {
      return this.i18n.t('billing.no_hours_in', { month: this.months[this.selectedMonth] });
    }
    return this.i18n.t('billing.no_hour_types');
  }

  get hasConfirmedBilling(): boolean {
    return !!this.currentSnapshot;
  }

  get canCalculate(): boolean {
    return this.getTotalHoursForMonth() > 0 || this.adicionales.length > 0;
  }

  get primaryActionLabel(): string {
    if (this.hasConfirmedBilling) {
      return this.i18n.t('billing.recalculate_save');
    }
    return this.i18n.t('billing.calculate_save');
  }

  get outdatedMessage(): string {
    return this.i18n.t('billing.outdated_message');
  }

  lineKey(line: BillingLine): string {
    return billingValorKey(line.establecimiento, line.tipoHora);
  }

  private rebuildLines(): void {
    const establecimientos = this.userService.getEstablecimientos();
    const tiposPorEstablecimiento: { [establecimiento: string]: string[] } = {};
    establecimientos.forEach(est => {
      tiposPorEstablecimiento[est] = this.userService.getTiposDeHora(est);
    });

    this.configuredLines = this.billingService.buildBillingLines(
      establecimientos,
      tiposPorEstablecimiento,
      this.hoursEntries
    );

    if (this.currentSnapshot && this.getTotalHoursForMonth() === 0) {
      this.billingLines = this.billingService.linesFromSnapshot(this.currentSnapshot);
      return;
    }

    this.billingLines = this.configuredLines.filter(
      line => (this.hoursSummary[this.lineKey(line)] ?? 0) > 0
    );

    if (this.currentSnapshot) {
      const existing = new Set(this.billingLines.map(l => this.lineKey(l)));
      this.billingService.linesFromSnapshot(this.currentSnapshot).forEach(line => {
        const key = this.lineKey(line);
        if (!existing.has(key)) {
          this.billingLines.push(line);
          existing.add(key);
        }
      });
    }
  }

  private initValoresFromSuggestionOrSnapshot(): void {
    const next: { [key: string]: number | null } = {};

    if (this.currentSnapshot) {
      this.billingLines.forEach(line => {
        const key = this.lineKey(line);
        const fromSnapshot = this.currentSnapshot!.valoresUsados[key];
        if (fromSnapshot != null) {
          next[key] = fromSnapshot;
          return;
        }
        const item = this.currentSnapshot!.items.find(
          i => i.establecimiento === line.establecimiento && i.tipoHora === line.tipoHora
        );
        next[key] = item?.valorPorHora ?? null;
      });
      this.valoresMap = next;
      return;
    }

    const suggested = this.billingService.suggestValoresForLines(
      this.billingLines,
      this.billingService.getValores()
    );

    this.billingLines.forEach(line => {
      const key = this.lineKey(line);
      next[key] = suggested[key] != null ? suggested[key] : null;
    });

    this.valoresMap = next;
  }

  private getCurrentValores(): { [key: string]: number } {
    const valoresPorHora: { [key: string]: number } = {};
    this.billingLines.forEach(line => {
      const key = this.lineKey(line);
      const raw = this.valoresMap[key];
      const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
      valoresPorHora[key] = Number.isFinite(parsed) ? parsed : 0;
    });
    return valoresPorHora;
  }

  onValorChange(line: BillingLine, event: CustomEvent): void {
    const key = this.lineKey(line);
    const raw = event.detail?.value;
    if (raw === '' || raw == null) {
      this.valoresMap[key] = null;
    } else {
      const parsed = parseFloat(raw);
      this.valoresMap[key] = Number.isFinite(parsed) ? parsed : null;
    }

    if (!this.hasConfirmedBilling) {
      this.scheduleDraftPersist();
    }
  }

  private scheduleDraftPersist(): void {
    if (this.persistDraftTimer) {
      clearTimeout(this.persistDraftTimer);
    }
    this.persistDraftTimer = setTimeout(() => {
      void this.billingService.saveValores({
        ...this.billingService.getValores(),
        ...this.getCurrentValores()
      });
    }, 300);
  }

  private async loadMonthlyData(): Promise<void> {
    this.hoursEntries = this.hoursService.getHoursForMonth(this.selectedYear, this.selectedMonth);
    this.hoursSummary = this.billingService.getHoursSummaryByLine(this.hoursEntries);
    this.currentSnapshot = this.billingService.getSnapshot(this.selectedYear, this.selectedMonth);

    this.adicionales = await this.billingService.ensureAdicionalesDraftFromSnapshot(
      this.selectedYear,
      this.selectedMonth
    );
    this.conceptoSuggestions = this.billingService.getSuggestedAdicionalConceptos();

    this.isSnapshotOutdated = this.currentSnapshot
      ? this.billingService.isSnapshotOutdated(
          this.currentSnapshot,
          this.hoursEntries,
          this.adicionales
        )
      : false;

    this.rebuildLines();
    this.initValoresFromSuggestionOrSnapshot();

    if (this.currentSnapshot) {
      this.billingResult = this.billingService.snapshotToResult(this.currentSnapshot);
    } else {
      this.billingResult = null;
    }
  }

  async onPeriodChange(): Promise<void> {
    await this.loadMonthlyData();
  }

  getHoursForLine(line: BillingLine): number {
    const live = this.hoursSummary[this.lineKey(line)];
    if (live != null) return live;

    if (this.currentSnapshot) {
      const item = this.currentSnapshot.items.find(
        i => i.establecimiento === line.establecimiento && i.tipoHora === line.tipoHora
      );
      return item?.totalHoras ?? 0;
    }
    return 0;
  }

  async addAdicional(): Promise<void> {
    await this.openAdicionalEditor();
  }

  async editAdicional(adicional: BillingAdicional): Promise<void> {
    await this.openAdicionalEditor(adicional);
  }

  async removeAdicional(adicional: BillingAdicional): Promise<void> {
    const alert = await this.alertController.create({
      header: this.i18n.t('billing.delete_additional'),
      message: this.i18n.t('billing.delete_additional_confirm', { name: adicional.concepto }),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        {
          text: this.i18n.t('common.delete'),
          role: 'destructive',
          handler: () => {
            void this.persistAdicionales(
              this.adicionales.filter(item => item.id !== adicional.id)
            );
          }
        }
      ]
    });
    await alert.present();
  }

  private async openAdicionalEditor(existing?: BillingAdicional): Promise<void> {
    const modal = await this.modalController.create({
      component: AdicionalModalComponent,
      componentProps: {
        adicional: existing || null,
        establecimientos: this.establecimientos,
        conceptoSuggestions: this.conceptoSuggestions
      },
      cssClass: 'adicional-modal'
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (!data?.saved || !data.adicional) return;

    const normalized = data.adicional as BillingAdicional;
    const next = existing
      ? this.adicionales.map(item => item.id === existing.id ? normalized : item)
      : [...this.adicionales, normalized];

    await this.persistAdicionales(next);
  }

  private async persistAdicionales(next: BillingAdicional[]): Promise<void> {
    this.adicionales = next;
    await this.billingService.saveAdicionalesForPeriod(
      this.selectedYear,
      this.selectedMonth,
      next
    );
    this.conceptoSuggestions = this.billingService.getSuggestedAdicionalConceptos();

    if (this.currentSnapshot) {
      this.isSnapshotOutdated = this.billingService.isSnapshotOutdated(
        this.currentSnapshot,
        this.hoursEntries,
        this.adicionales
      );
    }
  }

  async onPrimaryAction(): Promise<void> {
    if (!this.canCalculate) return;

    if (this.hasConfirmedBilling) {
      const confirmed = await this.confirmRecalculation();
      if (!confirmed) return;
    }

    await this.persistCalculation();
  }

  private async confirmRecalculation(): Promise<boolean> {
    const message = this.isSnapshotOutdated
      ? this.i18n.t('billing.recalculate_outdated')
      : this.i18n.t('billing.recalculate_existing');

    const alert = await this.alertController.create({
      header: this.i18n.t('billing.recalculate_title'),
      message,
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.recalculate'), role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  private async persistCalculation(): Promise<void> {
    if (this.persistDraftTimer) {
      clearTimeout(this.persistDraftTimer);
      this.persistDraftTimer = null;
    }

    const valoresPorHora = this.getCurrentValores();
    const snapshot = await this.billingService.confirmMonthBilling(
      this.selectedYear,
      this.selectedMonth,
      this.hoursEntries,
      valoresPorHora,
      this.adicionales
    );

    this.currentSnapshot = snapshot;
    this.isSnapshotOutdated = false;
    this.adicionales = snapshot.adicionales.map(item => ({ ...item }));
    this.billingResult = this.billingService.snapshotToResult(snapshot);
    this.initValoresFromSuggestionOrSnapshot();
  }

  async exportPdf(): Promise<void> {
    if (!this.currentSnapshot || this.isSnapshotOutdated) {
      await this.showToast(this.i18n.t('billing.export_only_confirmed'));
      return;
    }

    this.exportingPdf = true;
    try {
      await this.billingPdfService.exportSnapshot(this.currentSnapshot);
    } catch (error) {
      console.error(error);
      await this.showToast(this.i18n.t('billing.pdf_error'));
    } finally {
      this.exportingPdf = false;
    }
  }

  goBack(): void {
    this.navController.back();
  }

  getTotalHoursForMonth(): number {
    return Object.values(this.hoursSummary).reduce((sum, hours) => sum + hours, 0);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(value);
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom'
    });
    await toast.present();
  }
}
