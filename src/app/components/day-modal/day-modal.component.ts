import { Component, Input, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { 
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  ModalController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  close, 
  trashOutline, 
  closeCircleOutline, 
  addOutline, 
  checkmarkOutline,
  warningOutline
} from 'ionicons/icons';
import { HoursService, UserService } from '../../services';
import { I18nService, TranslatePipe } from '../../services/i18n.service';
import { HourEntry } from '../../models';

@Component({
  selector: 'app-day-modal',
  templateUrl: './day-modal.component.html',
  styleUrls: ['./day-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DayModalComponent implements OnInit {
  @Input() date!: string;
  @Input() displayDate!: string;

  form!: FormGroup;
  establecimientos: string[] = [];
  existingEntries: HourEntry[] = [];
  submitted = false;

  constructor(
    private fb: FormBuilder,
    private modalController: ModalController,
    private alertController: AlertController,
    private hoursService: HoursService,
    private userService: UserService,
    private i18n: I18nService
  ) {
    addIcons({ 
      close, 
      trashOutline, 
      closeCircleOutline, 
      addOutline, 
      checkmarkOutline,
      warningOutline
    });
  }

  async ngOnInit(): Promise<void> {
    this.establecimientos = this.userService.getEstablecimientos();
    
    this.form = this.fb.group({
      entries: this.fb.array([])
    });

    await this.loadExistingEntries();
  }

  get entries(): FormArray {
    return this.form.get('entries') as FormArray;
  }

  private async loadExistingEntries(): Promise<void> {
    this.existingEntries = await this.hoursService.getEntriesForDate(this.date);
    
    if (this.existingEntries.length > 0) {
      this.existingEntries.forEach(entry => this.addEntry(entry));
    } else {
      this.addEntry();
    }
  }

  addEntry(entry?: HourEntry): void {
    const entryGroup = this.fb.group({
      establecimiento: [entry?.establecimiento ?? '', Validators.required],
      tipoHora: [entry?.tipoHora ?? '', Validators.required],
      cantidad: [entry?.cantidad ?? null, [Validators.required, Validators.min(0.01)]]
    });
    this.entries.push(entryGroup);
  }

  getTiposDeHoraForEntry(index: number): string[] {
    const control = this.entries.at(index);
    const establecimiento = control?.get('establecimiento')?.value as string;
    const tipoActual = control?.get('tipoHora')?.value as string;
    const tipos = this.userService.getTiposDeHora(establecimiento);
    return tipoActual && !tipos.includes(tipoActual)
      ? [...tipos, tipoActual]
      : tipos;
  }

  onEstablecimientoChange(index: number): void {
    const control = this.entries.at(index);
    const establecimiento = control.get('establecimiento')?.value as string;
    const tipoControl = control.get('tipoHora');
    const tiposDisponibles = this.userService.getTiposDeHora(establecimiento);
    const tipoActual = tipoControl?.value as string;
    if (tipoActual && !tiposDisponibles.includes(tipoActual)) {
      tipoControl?.setValue('');
      tipoControl?.markAsTouched();
    }
  }

  removeEntry(index: number): void {
    if (this.entries.length > 1) {
      this.entries.removeAt(index);
    }
  }

  isEntryValid(index: number): boolean {
    return this.entries.at(index).valid;
  }

  getEntryError(index: number, field: string): boolean {
    if (!this.submitted) return false;
    const control = this.entries.at(index).get(field);
    return control ? control.invalid : false;
  }

  get exceedsMaxHours(): boolean {
    return this.getTotalHours() > 24;
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }

    if (this.exceedsMaxHours) {
      const alert = await this.alertController.create({
        header: this.i18n.t('common.error'),
        message: this.i18n.t('day_modal.exceeds_max_alert'),
        buttons: [this.i18n.t('common.understood')]
      });
      await alert.present();
      return;
    }

    const entries: HourEntry[] = this.entries.controls.map(control => ({
      establecimiento: control.get('establecimiento')?.value,
      tipoHora: control.get('tipoHora')?.value,
      cantidad: parseFloat(control.get('cantidad')?.value)
    }));

    await this.hoursService.setEntriesForDate(this.date, entries);
    await this.modalController.dismiss({ saved: true });
  }

  async confirmDelete(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.i18n.t('day_modal.delete_title'),
      message: this.i18n.t('day_modal.delete_message'),
      buttons: [
        {
          text: this.i18n.t('common.cancel'),
          role: 'cancel'
        },
        {
          text: this.i18n.t('common.delete'),
          role: 'destructive',
          handler: async () => {
            await this.hoursService.setEntriesForDate(this.date, []);
            await this.modalController.dismiss({ saved: true, deleted: true });
          }
        }
      ]
    });
    await alert.present();
  }

  async close(): Promise<void> {
    await this.modalController.dismiss({ saved: false });
  }

  private markAllAsTouched(): void {
    this.entries.controls.forEach(control => {
      Object.keys((control as FormGroup).controls).forEach(key => {
        control.get(key)?.markAsTouched();
      });
    });
  }

  getTotalHours(): number {
    return this.entries.controls.reduce((sum, control) => {
      const cantidad = parseFloat(control.get('cantidad')?.value) || 0;
      return sum + cantidad;
    }, 0);
  }
}
