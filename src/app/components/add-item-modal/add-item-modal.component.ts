import { Component, Input, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonItem,
  IonSelect,
  IonSelectOption,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  close, 
  businessOutline, 
  timeOutline, 
  checkmarkOutline
} from 'ionicons/icons';
import { UserService } from '../../services';
import { DynamicListInputComponent } from '../dynamic-list-input/dynamic-list-input.component';

export type AddItemType = 'establecimiento' | 'tipoHora';

@Component({
  selector: 'app-add-item-modal',
  templateUrl: './add-item-modal.component.html',
  styleUrls: ['./add-item-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    IonItem,
    IonSelect,
    IonSelectOption,
    DynamicListInputComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AddItemModalComponent implements OnInit {
  @Input() itemType: AddItemType = 'establecimiento';

  items: string[] = [];
  establecimientos: string[] = [];
  selectedEstablecimiento: string = '';
  isValid: boolean = true;
  private tiposDeHoraPorEstablecimiento: { [establecimiento: string]: string[] } = {};
  private tiposValidityPorEstablecimiento: { [establecimiento: string]: boolean } = {};
  private switchingEstablecimiento = false;

  constructor(
    private modalController: ModalController,
    public userService: UserService
  ) {
    addIcons({ 
      close, 
      businessOutline, 
      timeOutline, 
      checkmarkOutline
    });
  }

  ngOnInit(): void {
    this.establecimientos = this.userService.getEstablecimientos();
    if (this.establecimientos.length > 0) {
      this.selectedEstablecimiento = this.establecimientos[0];
    }

    this.establecimientos.forEach(est => {
      const tipos = [...this.userService.getTiposDeHora(est)];
      this.tiposDeHoraPorEstablecimiento[est] = tipos;
      this.tiposValidityPorEstablecimiento[est] = this.isTiposListValid(tipos);
    });

    this.loadItems();
  }

  private loadItems(): void {
    if (this.itemType === 'establecimiento') {
      this.items = [...this.userService.getEstablecimientos()];
      return;
    }

    this.items = [...(this.tiposDeHoraPorEstablecimiento[this.selectedEstablecimiento] || [])];
  }

  get title(): string {
    return this.itemType === 'establecimiento' 
      ? 'Tus lugares de trabajo' 
      : 'Tipos de horas';
  }

  get subtitle(): string {
    return this.itemType === 'establecimiento'
      ? 'Ingrese el establecimiento, ej: Sanatorio Privado Argentino'
      : `Defina los tipos de horas para ${this.selectedEstablecimiento || 'el establecimiento'}`;
  }

  get placeholder(): string {
    return this.itemType === 'establecimiento'
      ? 'Nombre del establecimiento'
      : 'Tipo de hora';
  }

  get icon(): string {
    return this.itemType === 'establecimiento' ? 'business-outline' : 'time-outline';
  }

  get minLength(): number {
    return 3;
  }

  get maxLength(): number {
    return 50;
  }

  get canSave(): boolean {
    if (this.itemType === 'establecimiento') {
      return this.isValid && this.items.length > 0;
    }

    if (!this.selectedEstablecimiento) return false;

    return this.establecimientos.every(est => {
      const tipos = this.tiposDeHoraPorEstablecimiento[est] || [];
      return tipos.length > 0 && (this.tiposValidityPorEstablecimiento[est] ?? false);
    });
  }

  onItemsChange(values: string[]): void {
    if (this.switchingEstablecimiento) return;

    this.items = values;

    if (this.itemType === 'tipoHora' && this.selectedEstablecimiento) {
      this.tiposDeHoraPorEstablecimiento = {
        ...this.tiposDeHoraPorEstablecimiento,
        [this.selectedEstablecimiento]: values
      };
    }
  }

  onValidityChange(valid: boolean): void {
    this.isValid = valid;

    if (this.itemType === 'tipoHora' && this.selectedEstablecimiento) {
      const tipos = this.tiposDeHoraPorEstablecimiento[this.selectedEstablecimiento] || [];
      this.tiposValidityPorEstablecimiento = {
        ...this.tiposValidityPorEstablecimiento,
        [this.selectedEstablecimiento]: valid && tipos.length > 0
      };
    }
  }

  onEstablecimientoChange(): void {
    this.switchingEstablecimiento = true;
    this.loadItems();
    const tipos = this.tiposDeHoraPorEstablecimiento[this.selectedEstablecimiento] || [];
    this.tiposValidityPorEstablecimiento[this.selectedEstablecimiento] = this.isTiposListValid(tipos);
    setTimeout(() => {
      this.switchingEstablecimiento = false;
    });
  }

  private isTiposListValid(tipos: string[]): boolean {
    return tipos.length > 0 && tipos.every(t => t.trim().length >= 3 && t.trim().length <= 50);
  }

  async save(): Promise<void> {
    if (!this.canSave) return;
    
    if (this.itemType === 'establecimiento') {
      await this.userService.updateItems('establecimiento', this.items);
    } else {
      await this.userService.updateTiposDeHoraPorEstablecimiento(
        this.tiposDeHoraPorEstablecimiento
      );
    }

    await this.modalController.dismiss({ saved: true });
  }

  async close(): Promise<void> {
    await this.modalController.dismiss({ saved: false });
  }
}
