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
  businessOutline,
  timeOutline,
  chevronDownOutline,
  chevronBackOutline,
  chevronForwardOutline,
  checkmarkOutline
} from 'ionicons/icons';
import { DynamicListInputComponent } from '../dynamic-list-input/dynamic-list-input.component';
import { UserService } from '../../services';
import { WizardState } from '../../models';

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
  currentStep: number = 1;
  totalSteps: number = 3;
  
  nombreForm!: FormGroup;
  
  wizardState: WizardState = {
    nombre: '',
    establecimientos: [],
    tiposDeHoraPorEstablecimiento: {}
  };

  establecimientosValid: boolean = false;
  tiposDeHoraPorEstablecimientoValid: { [establecimiento: string]: boolean } = {};
  selectedEstablecimientoStep3: string = '';
  private switchingStep3Establecimiento: boolean = false;

  constructor(
    private fb: FormBuilder,
    private modalController: ModalController,
    private userService: UserService
  ) {
    addIcons({ 
      close,
      personOutline,
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
    return this.establecimientosValid && this.wizardState.establecimientos.length > 0;
  }

  canProceedStep3(): boolean {
    if (this.wizardState.establecimientos.length === 0) return false;
    return this.wizardState.establecimientos.every(est => this.isEstablecimientoTiposValid(est));
  }

  canProceedCurrentEstablecimientoStep3(): boolean {
    return this.isEstablecimientoTiposValid(this.selectedEstablecimientoStep3);
  }

  get isLastEstablecimientoStep3(): boolean {
    const list = this.wizardState.establecimientos;
    if (list.length === 0) return true;
    return list.indexOf(this.selectedEstablecimientoStep3) === list.length - 1;
  }

  get shouldFinishStep3(): boolean {
    return this.canProceedCurrentEstablecimientoStep3() && this.canProceedStep3();
  }

  get step3PrimaryLabel(): string {
    return this.shouldFinishStep3 ? 'Finalizar' : 'Siguiente';
  }

  private isEstablecimientoTiposValid(establecimiento: string): boolean {
    if (!establecimiento) return false;
    const tipos = this.wizardState.tiposDeHoraPorEstablecimiento[establecimiento] || [];
    return tipos.length > 0 && (this.tiposDeHoraPorEstablecimientoValid[establecimiento] ?? this.isTiposListValid(tipos));
  }

  private getNextEstablecimientoStep3(): string | null {
    const list = this.wizardState.establecimientos;
    const currentIndex = list.indexOf(this.selectedEstablecimientoStep3);

    if (currentIndex >= 0 && currentIndex < list.length - 1) {
      return list[currentIndex + 1];
    }

    const incomplete = list.find(est => !this.isEstablecimientoTiposValid(est));
    if (incomplete && incomplete !== this.selectedEstablecimientoStep3) {
      return incomplete;
    }

    return null;
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      this.wizardState.nombre = this.nombreForm.get('nombre')?.value?.trim();
    }
    
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      if (this.currentStep === 3) {
        this.selectedEstablecimientoStep3 = this.wizardState.establecimientos[0] || '';
      }
    }
  }

  onStep3PrimaryAction(): void {
    if (!this.canProceedCurrentEstablecimientoStep3()) return;

    if (this.shouldFinishStep3) {
      void this.finish();
      return;
    }

    const next = this.getNextEstablecimientoStep3();
    if (!next) {
      void this.finish();
      return;
    }

    this.selectedEstablecimientoStep3 = next;
    this.onStep3EstablecimientoChange();
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

    if (!values.includes(this.selectedEstablecimientoStep3)) {
      this.selectedEstablecimientoStep3 = values[0] || '';
    }
  }

  onEstablecimientosValidityChange(valid: boolean): void {
    this.establecimientosValid = valid;
  }

  onTiposDeHoraChange(values: string[]): void {
    if (this.switchingStep3Establecimiento) return;
    if (!this.selectedEstablecimientoStep3) return;
    this.wizardState.tiposDeHoraPorEstablecimiento = {
      ...this.wizardState.tiposDeHoraPorEstablecimiento,
      [this.selectedEstablecimientoStep3]: values
    };
  }

  onTiposDeHoraValidityChange(valid: boolean): void {
    if (!this.selectedEstablecimientoStep3) return;
    const tipos = this.wizardState.tiposDeHoraPorEstablecimiento[this.selectedEstablecimientoStep3] || [];
    this.tiposDeHoraPorEstablecimientoValid = {
      ...this.tiposDeHoraPorEstablecimientoValid,
      [this.selectedEstablecimientoStep3]: valid && tipos.length > 0
    };
  }

  onStep3EstablecimientoChange(): void {
    this.switchingStep3Establecimiento = true;
    const est = this.selectedEstablecimientoStep3;
    if (!est) {
      this.switchingStep3Establecimiento = false;
      return;
    }
    if (!this.wizardState.tiposDeHoraPorEstablecimiento[est]) {
      this.wizardState.tiposDeHoraPorEstablecimiento[est] = [];
    }
    const tipos = this.wizardState.tiposDeHoraPorEstablecimiento[est] || [];
    this.tiposDeHoraPorEstablecimientoValid[est] = this.isTiposListValid(tipos);
    setTimeout(() => {
      this.switchingStep3Establecimiento = false;
    });
  }

  getTiposDeHoraForSelectedEstablecimiento(): string[] {
    if (!this.selectedEstablecimientoStep3) return [];
    return this.wizardState.tiposDeHoraPorEstablecimiento[this.selectedEstablecimientoStep3] || [];
  }

  private isTiposListValid(tipos: string[]): boolean {
    return tipos.length > 0 && tipos.every(t => t.trim().length >= 3 && t.trim().length <= 50);
  }

  async finish(): Promise<void> {
    if (this.canProceedStep3()) {
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
