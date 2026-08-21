import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';
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
  IonSelect,
  IonSelectOption,
  NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  analyticsOutline,
  cashOutline,
  timeOutline,
  businessOutline,
  trendingUpOutline,
  trophyOutline,
  calendarOutline,
  warningOutline
} from 'ionicons/icons';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ReportsService } from '../../services/reports.service';
import { BillingService } from '../../services';
import { TranslatePipe } from '../../services/i18n.service';
import { ESTABLECIMIENTO_COLORS, PALETTE_COLORS } from '../../models';
import { ThemeService } from '../../services/theme.service';
import {
  FinancialReport,
  ReportPeriodId,
  ReportPeriodOption
} from '../../models/report.model';

Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
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
    IonSelect,
    IonSelectOption
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ReportsPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('evolutionCanvas') evolutionCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('establishmentCanvas') establishmentCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hourTypeCanvas') hourTypeCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('rateCanvas') rateCanvas?: ElementRef<HTMLCanvasElement>;

  periodOptions: ReportPeriodOption[] = [];
  selectedPeriodId: ReportPeriodId = 'current_year';
  report: FinancialReport | null = null;
  loading = true;

  rateOptions: Array<{ establecimiento: string; tipoHora: string; label: string }> = [];
  selectedRateKey = '';
  private selectedRateEstablecimiento = '';
  private selectedRateTipoHora = '';

  private evolutionChart?: Chart;
  private establishmentChart?: Chart;
  private hourTypeChart?: Chart;
  private rateChart?: Chart;
  private viewReady = false;

  get paletteColors(): string[] {
    return PALETTE_COLORS[this.themeService.getPalette()] || ESTABLECIMIENTO_COLORS;
  }

  constructor(
    private navController: NavController,
    private reportsService: ReportsService,
    private billingService: BillingService,
    private themeService: ThemeService
  ) {
    addIcons({
      arrowBackOutline,
      analyticsOutline,
      cashOutline,
      timeOutline,
      businessOutline,
      trendingUpOutline,
      trophyOutline,
      calendarOutline,
      warningOutline
    });
  }

  async ngOnInit(): Promise<void> {
    this.periodOptions = this.reportsService.getPeriodOptions();
    await this.billingService.loadSnapshots();
    this.rateOptions = this.reportsService.getRateSeriesOptions();
    if (this.rateOptions.length > 0) {
      this.selectedRateKey = this.rateKey(this.rateOptions[0]);
      this.selectedRateEstablecimiento = this.rateOptions[0].establecimiento;
      this.selectedRateTipoHora = this.rateOptions[0].tipoHora;
    }
    await this.loadReport();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  async onPeriodChange(): Promise<void> {
    await this.loadReport();
  }

  onRateSeriesChange(): void {
    const option = this.rateOptions.find(item => this.rateKey(item) === this.selectedRateKey);
    if (!option) return;
    this.selectedRateEstablecimiento = option.establecimiento;
    this.selectedRateTipoHora = option.tipoHora;
    this.renderRateChart();
  }

  goBack(): void {
    this.navController.back();
  }

  goToBilling(): void {
    this.navController.navigateForward('/billing');
  }

  formatCurrency(value: number): string {
    return this.reportsService.formatCurrency(value);
  }

  formatHours(value: number): string {
    return this.reportsService.formatHours(value);
  }

  formatPercent(value: number): string {
    return this.reportsService.formatPercent(value);
  }

  formatRate(value: number): string {
    return `${this.reportsService.formatCurrency(value)}/h`;
  }

  get comparisonText(): string | null {
    const comparison = this.report?.summary.comparison;
    if (!comparison || comparison.deltaPercentage == null) return null;
    const sign = comparison.deltaPercentage > 0 ? '+' : '';
    return `${sign}${comparison.deltaPercentage}% ${comparison.label}`;
  }

  get comparisonPositive(): boolean {
    return (this.report?.summary.comparison?.deltaPercentage ?? 0) >= 0;
  }

  get showDoughnut(): boolean {
    return (this.report?.byHourType.length ?? 0) > 0 && (this.report?.byHourType.length ?? 0) <= 6;
  }

  get establishmentChartHeight(): number {
    const count = this.report?.byEstablishment.length ?? 0;
    return Math.max(160, count * 42);
  }

  private rateKey(option: { establecimiento: string; tipoHora: string }): string {
    return `${option.establecimiento}:::${option.tipoHora}`;
  }

  private async loadReport(): Promise<void> {
    this.loading = true;
    this.report = await this.reportsService.buildReport(this.selectedPeriodId);
    this.rateOptions = this.reportsService.getRateSeriesOptions();
    if (this.rateOptions.length > 0 && !this.rateOptions.some(o => this.rateKey(o) === this.selectedRateKey)) {
      this.selectedRateKey = this.rateKey(this.rateOptions[0]);
      this.selectedRateEstablecimiento = this.rateOptions[0].establecimiento;
      this.selectedRateTipoHora = this.rateOptions[0].tipoHora;
    }
    this.loading = false;

    // Wait for DOM to paint empty/full states before charting
    setTimeout(() => this.renderCharts(), 0);
  }

  private renderCharts(): void {
    if (!this.viewReady || !this.report || this.loading) return;
    this.renderEvolutionChart();
    this.renderEstablishmentChart();
    this.renderHourTypeChart();
    this.renderRateChart();
  }

  private destroyCharts(): void {
    this.evolutionChart?.destroy();
    this.establishmentChart?.destroy();
    this.hourTypeChart?.destroy();
    this.rateChart?.destroy();
    this.evolutionChart = undefined;
    this.establishmentChart = undefined;
    this.hourTypeChart = undefined;
    this.rateChart = undefined;
  }

  private get chartPrimary(): string {
    return this.paletteColors[0];
  }

  private get chartSecondary(): string {
    return this.paletteColors[2];
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#252545',
          titleColor: '#e2e2e2',
          bodyColor: '#e2e2e2',
          borderColor: this.chartPrimary,
          borderWidth: 1
        }
      }
    };
  }

  private renderEvolutionChart(): void {
    if (!this.evolutionCanvas || !this.report?.hasConfirmedData || !this.report.period.isMultiMonth) {
      this.evolutionChart?.destroy();
      this.evolutionChart = undefined;
      return;
    }

    this.evolutionChart?.destroy();
    const labels = this.report.monthlyEvolution.map(p => p.shortLabel);
    const data = this.report.monthlyEvolution.map(p => p.revenue);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: this.chartPrimary,
          backgroundColor: this.hexToRgba(this.chartPrimary, 0.18),
          fill: true,
          tension: 0.35,
          pointBackgroundColor: this.chartPrimary,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        ...this.chartDefaults(),
        scales: {
          x: {
            ticks: { color: '#a7a7b8', maxRotation: 0 },
            grid: { color: 'rgba(167, 167, 184, 0.12)' }
          },
          y: {
            ticks: {
              color: '#a7a7b8',
              callback: (value) => this.compactCurrency(Number(value))
            },
            grid: { color: 'rgba(167, 167, 184, 0.12)' }
          }
        },
        plugins: {
          ...this.chartDefaults().plugins,
          tooltip: {
            ...this.chartDefaults().plugins.tooltip,
            callbacks: {
              label: (ctx) => this.formatCurrency(Number(ctx.parsed.y || 0))
            }
          }
        }
      }
    };

    this.evolutionChart = new Chart(this.evolutionCanvas.nativeElement, config);
  }

  private renderEstablishmentChart(): void {
    if (!this.establishmentCanvas || !this.report?.byEstablishment.length) {
      this.establishmentChart?.destroy();
      this.establishmentChart = undefined;
      return;
    }

    this.establishmentChart?.destroy();
    const items = this.report.byEstablishment.slice(0, 8);
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: items.map(i => this.truncate(i.name, 18)),
        datasets: [{
          data: items.map(i => i.revenue),
          backgroundColor: items.map((_, idx) => this.paletteColors[idx % this.paletteColors.length]),
          borderRadius: 8,
          barThickness: 18
        }]
      },
      options: {
        ...this.chartDefaults(),
        indexAxis: 'y',
        scales: {
          x: {
            ticks: {
              color: '#a7a7b8',
              callback: (value) => this.compactCurrency(Number(value))
            },
            grid: { color: 'rgba(167, 167, 184, 0.12)' }
          },
          y: {
            ticks: { color: '#e2e2e2' },
            grid: { display: false }
          }
        },
        plugins: {
          ...this.chartDefaults().plugins,
          tooltip: {
            ...this.chartDefaults().plugins.tooltip,
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                return this.report?.byEstablishment[idx]?.name || '';
              },
              label: (ctx) => this.formatCurrency(Number(ctx.parsed.x || 0))
            }
          }
        }
      }
    };

    this.establishmentChart = new Chart(this.establishmentCanvas.nativeElement, config);
  }

  private renderHourTypeChart(): void {
    if (!this.hourTypeCanvas || !this.report?.byHourType.length || !this.showDoughnut) {
      this.hourTypeChart?.destroy();
      this.hourTypeChart = undefined;
      return;
    }

    this.hourTypeChart?.destroy();
    const items = this.report.byHourType;
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: items.map(i => i.name),
        datasets: [{
          data: items.map(i => i.revenue),
          backgroundColor: items.map((_, idx) => this.paletteColors[idx % this.paletteColors.length]),
          borderWidth: 0
        }]
      },
      options: {
        ...this.chartDefaults(),
        cutout: '62%',
        plugins: {
          ...this.chartDefaults().plugins,
          tooltip: {
            ...this.chartDefaults().plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const item = items[ctx.dataIndex];
                return `${this.formatCurrency(item.revenue)} (${this.formatPercent(item.percentage)})`;
              }
            }
          }
        }
      }
    };

    this.hourTypeChart = new Chart(this.hourTypeCanvas.nativeElement, config);
  }

  private renderRateChart(): void {
    if (!this.rateCanvas || !this.selectedRateEstablecimiento || !this.selectedRateTipoHora) {
      this.rateChart?.destroy();
      this.rateChart = undefined;
      return;
    }

    const points = this.reportsService.getRateEvolution(
      this.selectedRateEstablecimiento,
      this.selectedRateTipoHora
    );

    if (points.length === 0) {
      this.rateChart?.destroy();
      this.rateChart = undefined;
      return;
    }

    this.rateChart?.destroy();
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: points.map(p => p.label),
        datasets: [{
          data: points.map(p => p.rate),
          borderColor: this.chartSecondary,
          backgroundColor: this.hexToRgba(this.chartSecondary, 0.15),
          fill: true,
          tension: 0.3,
          pointBackgroundColor: this.chartSecondary,
          pointRadius: 4
        }]
      },
      options: {
        ...this.chartDefaults(),
        scales: {
          x: {
            ticks: { color: '#a7a7b8' },
            grid: { color: 'rgba(167, 167, 184, 0.12)' }
          },
          y: {
            ticks: {
              color: '#a7a7b8',
              callback: (value) => this.compactCurrency(Number(value))
            },
            grid: { color: 'rgba(167, 167, 184, 0.12)' }
          }
        },
        plugins: {
          ...this.chartDefaults().plugins,
          tooltip: {
            ...this.chartDefaults().plugins.tooltip,
            callbacks: {
              label: (ctx) => this.formatRate(Number(ctx.parsed.y || 0))
            }
          }
        }
      }
    };

    this.rateChart = new Chart(this.rateCanvas.nativeElement, config);
  }

  private compactCurrency(value: number): string {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  }

  private truncate(value: string, max: number): string {
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1)}…`;
  }
}
