import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  close,
  personOutline,
  briefcaseOutline,
  businessOutline,
  timeOutline,
  chevronDownOutline,
  chevronBackOutline,
  chevronForwardOutline,
  checkmarkOutline
} from 'ionicons/icons';
import { DynamicListInputComponent } from '../dynamic-list-input/dynamic-list-input.component';
import { UserService } from '../../services';
import {
  WizardState,
  ProfessionalAreaId,
  PROFESSIONAL_AREAS,
  isProfessionalAreaId
} from '../../models';

@Component({
  selector: 'app-wizard',
  templateUrl: './wizard.component.html',
  styleUrls: ['./wizard.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
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
    DynamicListInputComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class WizardComponent implements OnInit {
  readonly steps = {
    name: 1,
    area: 2,
    establecimientos: 3,
    tiposHora: 4
  } as const;

  currentStep: number = this.steps.name;
  totalSteps: number = this.steps.tiposHora;
  readonly professionalAreas = PROFESSIONAL_AREAS;
  
  nombreForm!: FormGroup;
  
  wizardState: WizardState = {
    nombre: '',
    establecimientos: [],
    tiposDeHoraPorEstablecimiento: {}
  };

  establecimientosValid: boolean = false;
  tiposDeHoraPorEstablecimientoValid: { [establecimiento: string]: boolean } = {};
  selectedEstablecimientoTipos: string = '';
  private switchingTiposEstablecimiento: boolean = false;

  constructor(
    private fb: FormBuilder,
    private modalController: ModalController,
    private userService: UserService
  ) {
    addIcons({ 
      close,
      personOutline,
      briefcaseOutline,
      businessOutline,
      timeOutline,
      chevronDownOutline,
      chevronBackOutline,
      chevronForwardOutline,
      checkmarkOutline
    });
  }

  ngOnInit(): void {
    this.nombreForm = this.fb.group({
      nombre: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(25)
      ]]
    });
  }

  get nombreInvalid(): boolean {
    const control = this.nombreForm.get('nombre');
    return control ? control.invalid && control.touched : false;
  }

  get nombreErrorMessage(): string {
    const control = this.nombreForm.get('nombre');
    if (control?.hasError('required')) {
      return 'El nombre es requerido';
    }
    if (control?.hasError('minlength') || control?.hasError('maxlength')) {
      return 'Nombre inválido, ingrese entre 3 y 25 caracteres';
    }
    return '';
  }

  canProceedStep1(): boolean {
    return this.nombreForm.valid;
  }

  canProceedStep2(): boolean {
    return isProfessionalAreaId(this.wizardState.areaProfesional);
  }

  canProceedStep3(): boolean {
    return this.establecimientosValid && this.wizardState.establecimientos.length > 0;
  }

  canProceedStep4(): boolean {
    if (this.wizardState.establecimientos.length === 0) return false;
    return this.wizardState.establecimientos.every(est => this.isEstablecimientoTiposValid(est));
  }

  canProceedCurrentEstablecimientoTipos(): boolean {
    return this.isEstablecimientoTiposValid(this.selectedEstablecimientoTipos);
  }

  get shouldFinishTiposStep(): boolean {
    return this.canProceedCurrentEstablecimientoTipos() && this.canProceedStep4();
  }

  selectArea(areaId: ProfessionalAreaId): void {
    this.wizardState.areaProfesional = areaId;
  }

  private isEstablecimientoTiposValid(establecimiento: string): boolean {
    if (!establecimiento) return false;
    const tipos = this.wizardState.tiposDeHoraPorEstablecimiento[establecimiento] || [];
    return tipos.length > 0 && (this.tiposDeHoraPorEstablecimientoValid[establecimiento] ?? this.isTiposListValid(tipos));
  }

  private getNextEstablecimientoTipos(): string | null {
    const list = this.wizardState.establecimientos;
    const currentIndex = list.indexOf(this.selectedEstablecimientoTipos);

    if (currentIndex >= 0 && currentIndex < list.length - 1) {
      return list[currentIndex + 1];
    }

    const incomplete = list.find(est => !this.isEstablecimientoTiposValid(est));
    if (incomplete && incomplete !== this.selectedEstablecimientoTipos) {
      return incomplete;
    }

    return null;
  }

  nextStep(): void {
    if (this.currentStep === this.steps.name) {
      this.wizardState.nombre = this.nombreForm.get('nombre')?.value?.trim();
    }
    
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      if (this.currentStep === this.steps.tiposHora) {
        this.selectedEstablecimientoTipos = this.wizardState.establecimientos[0] || '';
      }
    }
  }

  onTiposStepPrimaryAction(): void {
    if (!this.canProceedCurrentEstablecimientoTipos()) return;

    if (this.shouldFinishTiposStep) {
      void this.finish();
      return;
    }

    const next = this.getNextEstablecimientoTipos();
    if (!next) {
      void this.finish();
      return;
    }

    this.selectedEstablecimientoTipos = next;
    this.onTiposEstablecimientoChange();
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  onEstablecimientosChange(values: string[]): void {
    const previousMap = this.wizardState.tiposDeHoraPorEstablecimiento;
    const previousValid = this.tiposDeHoraPorEstablecimientoValid;
    const nextMap: { [establecimiento: string]: string[] } = {};
    const nextValid: { [establecimiento: string]: boolean } = {};

    values.forEach(est => {
      const tipos = previousMap[est] ? [...previousMap[est]] : [];
      nextMap[est] = tipos;
      nextValid[est] = previousValid[est] ?? this.isTiposListValid(tipos);
    });

    this.wizardState.establecimientos = values;
    this.wizardState.tiposDeHoraPorEstablecimiento = nextMap;
    this.tiposDeHoraPorEstablecimientoValid = nextValid;

    if (!values.includes(this.selectedEstablecimientoTipos)) {
      this.selectedEstablecimientoTipos = values[0] || '';
    }
  }

  onEstablecimientosValidityChange(valid: boolean): void {
    this.establecimientosValid = valid;
  }

  onTiposDeHoraChange(values: string[]): void {
    if (this.switchingTiposEstablecimiento) return;
    if (!this.selectedEstablecimientoTipos) return;
    this.wizardState.tiposDeHoraPorEstablecimiento = {
      ...this.wizardState.tiposDeHoraPorEstablecimiento,
      [this.selectedEstablecimientoTipos]: values
    };
  }

  onTiposDeHoraValidityChange(valid: boolean): void {
    if (!this.selectedEstablecimientoTipos) return;
    const tipos = this.wizardState.tiposDeHoraPorEstablecimiento[this.selectedEstablecimientoTipos] || [];
    this.tiposDeHoraPorEstablecimientoValid = {
      ...this.tiposDeHoraPorEstablecimientoValid,
      [this.selectedEstablecimientoTipos]: valid && tipos.length > 0
    };
  }

  onTiposEstablecimientoChange(): void {
    this.switchingTiposEstablecimiento = true;
    const est = this.selectedEstablecimientoTipos;
    if (!est) {
      this.switchingTiposEstablecimiento = false;
      return;
    }
    if (!this.wizardState.tiposDeHoraPorEstablecimiento[est]) {
      this.wizardState.tiposDeHoraPorEstablecimiento[est] = [];
    }
    const tipos = this.wizardState.tiposDeHoraPorEstablecimiento[est] || [];
    this.tiposDeHoraPorEstablecimientoValid[est] = this.isTiposListValid(tipos);
    setTimeout(() => {
      this.switchingTiposEstablecimiento = false;
    });
  }

  getTiposDeHoraForSelectedEstablecimiento(): string[] {
    if (!this.selectedEstablecimientoTipos) return [];
    return this.wizardState.tiposDeHoraPorEstablecimiento[this.selectedEstablecimientoTipos] || [];
  }

  private isTiposListValid(tipos: string[]): boolean {
    return tipos.length > 0 && tipos.every(t => t.trim().length >= 3 && t.trim().length <= 50);
  }

  async finish(): Promise<void> {
    if (this.canProceedStep4()) {
      await this.userService.completeOnboarding(this.wizardState);
      await this.modalController.dismiss({ completed: true });
    }
  }

  async close(): Promise<void> {
    await this.modalController.dismiss({ completed: false });
  }

  getProgressWidth(): string {
    return `${(this.currentStep / this.totalSteps) * 100}%`;
  }
}
