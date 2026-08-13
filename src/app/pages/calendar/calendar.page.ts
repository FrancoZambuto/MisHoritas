import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { 
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonMenu,
  IonList,
  IonItem,
  ModalController,
  MenuController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  timeOutline,
  menuOutline,
  chevronBackOutline,
  chevronForwardOutline,
  businessOutline,
  calculatorOutline,
  analyticsOutline,
  checkmarkCircle,
  addCircleOutline,
  briefcaseOutline
} from 'ionicons/icons';
import { UserService, HoursService } from '../../services';
import { DayModalComponent, AddItemModalComponent, AddItemType } from '../../components';
import {
  HoursEntries,
  HourEntry,
  PROFESSIONAL_AREAS,
  ProfessionalAreaId,
  GENERIC_BRANDING_ASSET,
  resolveHeaderAsset
} from '../../models';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEntries: boolean;
  totalHours: number;
  establecimientoColors: string[];
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonMenu,
    IonList,
    IonItem
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CalendarPage implements OnInit, OnDestroy {
  viewMode: ViewMode = 'month';
  currentDate: Date = new Date();
  calendarDays: CalendarDay[] = [];
  weekDays: string[] = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  userName: string = '';
  hoursEntries: HoursEntries = {};
  headerAsset: string = GENERIC_BRANDING_ASSET;
  
  private hoursSub?: Subscription;
  private userSub?: Subscription;

  constructor(
    private modalController: ModalController,
    private menuController: MenuController,
    private alertController: AlertController,
    private router: Router,
    private userService: UserService,
    private hoursService: HoursService
  ) {
    addIcons({ 
      timeOutline,
      menuOutline,
      chevronBackOutline,
      chevronForwardOutline,
      businessOutline,
      calculatorOutline,
      analyticsOutline,
      checkmarkCircle,
      addCircleOutline,
      briefcaseOutline
    });
  }

  async ngOnInit(): Promise<void> {
    this.userSub = this.userService.user$.subscribe(user => {
      this.userName = user.nombre;
      this.headerAsset = resolveHeaderAsset(user.areaProfesional);
    });
    
    this.hoursSub = this.hoursService.hours$.subscribe(hours => {
      this.hoursEntries = hours;
      this.generateCalendar();
    });
    
    await this.hoursService.loadHours();
  }

  ngOnDestroy(): void {
    this.hoursSub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  get currentMonthYear(): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
  }

  get currentWeekRange(): string {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    
    const formatDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
  }

  get currentDayFormatted(): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `${days[this.currentDate.getDay()]} ${this.currentDate.getDate()}`;
  }

  segmentChanged(event: CustomEvent): void {
    this.viewMode = event.detail.value as ViewMode;
    this.generateCalendar();
  }

  previousPeriod(): void {
    if (this.viewMode === 'month') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    } else if (this.viewMode === 'week') {
      const newDate = new Date(this.currentDate);
      newDate.setDate(newDate.getDate() - 7);
      this.currentDate = newDate;
    } else {
      const newDate = new Date(this.currentDate);
      newDate.setDate(newDate.getDate() - 1);
      this.currentDate = newDate;
    }
    this.generateCalendar();
  }

  nextPeriod(): void {
    if (this.viewMode === 'month') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    } else if (this.viewMode === 'week') {
      const newDate = new Date(this.currentDate);
      newDate.setDate(newDate.getDate() + 7);
      this.currentDate = newDate;
    } else {
      const newDate = new Date(this.currentDate);
      newDate.setDate(newDate.getDate() + 1);
      this.currentDate = newDate;
    }
    this.generateCalendar();
  }

  goToToday(): void {
    this.currentDate = new Date();
    this.generateCalendar();
  }

  private generateCalendar(): void {
    if (this.viewMode === 'month') {
      this.generateMonthCalendar();
    } else if (this.viewMode === 'week') {
      this.generateWeekCalendar();
    } else {
      this.generateDayCalendar();
    }
  }

  private generateMonthCalendar(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const endDate = new Date(lastDay);
    const daysToAdd = 6 - lastDay.getDay();
    endDate.setDate(endDate.getDate() + daysToAdd);
    
    this.calendarDays = [];
    const current = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    while (current <= endDate) {
      const dateStr = this.formatDateKey(current);
      const entries = this.hoursEntries[dateStr] || [];
      const totalHours = entries.reduce((sum, e) => sum + e.cantidad, 0);
      const establecimientoColors = this.getUniqueEstablecimientoColors(entries);
      
      this.calendarDays.push({
        date: new Date(current),
        dayNumber: current.getDate(),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.getTime() === today.getTime(),
        hasEntries: entries.length > 0,
        totalHours,
        establecimientoColors
      });
      
      current.setDate(current.getDate() + 1);
    }
  }

  private generateWeekCalendar(): void {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    this.calendarDays = [];
    
    for (let i = 0; i < 7; i++) {
      const current = new Date(startOfWeek);
      current.setDate(current.getDate() + i);
      
      const dateStr = this.formatDateKey(current);
      const entries = this.hoursEntries[dateStr] || [];
      const totalHours = entries.reduce((sum, e) => sum + e.cantidad, 0);
      const establecimientoColors = this.getUniqueEstablecimientoColors(entries);
      
      this.calendarDays.push({
        date: new Date(current),
        dayNumber: current.getDate(),
        isCurrentMonth: true,
        isToday: current.getTime() === today.getTime(),
        hasEntries: entries.length > 0,
        totalHours,
        establecimientoColors
      });
    }
  }

  private generateDayCalendar(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dateStr = this.formatDateKey(this.currentDate);
    const entries = this.hoursEntries[dateStr] || [];
    const totalHours = entries.reduce((sum, e) => sum + e.cantidad, 0);
    const establecimientoColors = this.getUniqueEstablecimientoColors(entries);
    
    const currentDateCopy = new Date(this.currentDate);
    currentDateCopy.setHours(0, 0, 0, 0);
    
    this.calendarDays = [{
      date: new Date(this.currentDate),
      dayNumber: this.currentDate.getDate(),
      isCurrentMonth: true,
      isToday: currentDateCopy.getTime() === today.getTime(),
      hasEntries: entries.length > 0,
      totalHours,
      establecimientoColors
    }];
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDisplayDate(date: Date): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
  }

  async onDayClick(day: CalendarDay): Promise<void> {
    if (!day.isCurrentMonth && this.viewMode === 'month') return;
    
    const modal = await this.modalController.create({
      component: DayModalComponent,
      componentProps: {
        date: this.formatDateKey(day.date),
        displayDate: this.formatDisplayDate(day.date)
      },
      cssClass: 'day-modal'
    });
    
    await modal.present();
    await modal.onDidDismiss();
  }

  async openMenu(): Promise<void> {
    await this.menuController.open('main-menu');
  }

  async addEstablecimiento(): Promise<void> {
    await this.menuController.close();
    
    const modal = await this.modalController.create({
      component: AddItemModalComponent,
      componentProps: {
        itemType: 'establecimiento' as AddItemType
      },
      cssClass: 'add-item-modal'
    });
    
    await modal.present();
    await modal.onDidDismiss();
  }

  async addTipoHora(): Promise<void> {
    await this.menuController.close();
    
    const modal = await this.modalController.create({
      component: AddItemModalComponent,
      componentProps: {
        itemType: 'tipoHora' as AddItemType
      },
      cssClass: 'add-item-modal'
    });
    
    await modal.present();
    await modal.onDidDismiss();
  }

  async changeProfessionalArea(): Promise<void> {
    await this.menuController.close();

    const currentArea = this.userService.getAreaProfesional();
    const alert = await this.alertController.create({
      header: '¿Cuál es tu área?',
      inputs: PROFESSIONAL_AREAS.map((area) => ({
        type: 'radio' as const,
        label: area.displayName,
        value: area.id,
        checked: area.id === currentArea
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (value: ProfessionalAreaId) => {
            if (!value) return false;
            void this.userService.updateAreaProfesional(value);
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  async goToBilling(): Promise<void> {
    await this.menuController.close();
    await this.router.navigate(['/billing']);
  }

  async goToReports(): Promise<void> {
    await this.menuController.close();
    await this.router.navigate(['/reports']);
  }

  getMonthTotalHours(): number {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthlyHours = this.hoursService.getHoursForMonth(year, month);
    
    return Object.values(monthlyHours).reduce((total, entries) => {
      return total + entries.reduce((sum, e) => sum + e.cantidad, 0);
    }, 0);
  }

  private getUniqueEstablecimientoColors(entries: HourEntry[]): string[] {
    const uniqueEstablecimientos = [...new Set(entries.map(e => e.establecimiento))];
    return uniqueEstablecimientos.map(est => this.userService.getEstablecimientoColor(est));
  }
}
