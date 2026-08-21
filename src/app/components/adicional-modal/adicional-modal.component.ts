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
  IonInput,
  IonSelect,
  IonSelectOption,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close,
  cashOutline,
  checkmarkOutline
} from 'ionicons/icons';
import {
  BillingAdicional,
  createAdicionalId,
  normalizeAdicional
} from '../../models';
import { I18nService, TranslatePipe } from '../../services/i18n.service';

@Component({
  selector: 'app-adicional-modal',
  templateUrl: './adicional-modal.component.html',
  styleUrls: ['./adicional-modal.component.scss'],
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
    IonFooter,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdicionalModalComponent implements OnInit {
  @Input() adicional?: BillingAdicional | null;
  @Input() establecimientos: string[] = [];
  @Input() conceptoSuggestions: string[] = [];

  concepto = '';
  monto: number | string | null = null;
  establecimiento: string = '';
  nota = '';
  errorMessage = '';

  readonly SIN_ESTABLECIMIENTO = '';

  constructor(private modalController: ModalController, private i18n: I18nService) {
    addIcons({ close, cashOutline, checkmarkOutline });
  }

  ngOnInit(): void {
    if (this.adicional) {
      this.concepto = this.adicional.concepto || '';
      this.monto = this.adicional.monto ?? null;
      this.establecimiento = this.adicional.establecimiento || '';
      this.nota = this.adicional.nota || '';
    }
  }

  get title(): string {
    return this.adicional ? this.i18n.t('adicional.edit_title') : this.i18n.t('adicional.add_title');
  }

  private parseMonto(): number {
    return parseFloat(String(this.monto ?? '').replace(',', '.')) || 0;
  }

  get canSave(): boolean {
    return this.concepto.trim().length >= 2 && this.parseMonto() > 0;
  }

  selectConcepto(concepto: string): void {
    this.concepto = concepto;
    this.errorMessage = '';
  }

  async save(): Promise<void> {
    const normalized = normalizeAdicional({
      id: this.adicional?.id || createAdicionalId(),
      concepto: this.concepto,
      monto: this.parseMonto(),
      establecimiento: this.establecimiento || null,
      nota: this.nota
    });

    if (!normalized) {
      this.errorMessage = this.i18n.t('validation.complete_concept_amount');
      return;
    }

    await this.modalController.dismiss({ saved: true, adicional: normalized });
  }

  async close(): Promise<void> {
    await this.modalController.dismiss({ saved: false });
  }
}
