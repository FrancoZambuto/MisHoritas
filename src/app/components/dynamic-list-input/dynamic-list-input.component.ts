import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  IonItem,
  IonInput,
  IonButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trashOutline, addOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { I18nService, TranslatePipe } from '../../services/i18n.service';

@Component({
  selector: 'app-dynamic-list-input',
  templateUrl: './dynamic-list-input.component.html',
  styleUrls: ['./dynamic-list-input.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    IonItem,
    IonInput,
    IonButton
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DynamicListInputComponent implements OnInit, OnChanges, OnDestroy {
  @Input() title: string = '';
  @Input() placeholder: string = '';
  @Input() minLength: number = 3;
  @Input() maxLength: number = 50;
  @Input() initialValues: string[] = [];
  @Output() valuesChange = new EventEmitter<string[]>();
  @Output() validityChange = new EventEmitter<boolean>();

  form!: FormGroup;
  private formSubscription?: Subscription;

  constructor(private fb: FormBuilder, private i18n: I18nService) {
    addIcons({ trashOutline, addOutline });
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      items: this.fb.array([])
    });

    this.resetItems(this.initialValues);

    this.formSubscription = this.form.valueChanges.subscribe(() => {
      this.emitValues();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) return;

    if (changes['initialValues'] && !changes['initialValues'].firstChange) {
      const nextValues = this.normalizeValues(this.initialValues);
      const currentValues = this.getCurrentNormalizedValues();
      if (!this.areSameValues(currentValues, nextValues)) {
        this.resetItems(this.initialValues);
      }
    }
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  addItem(value: string = '', emit: boolean = true): void {
    const itemControl = this.fb.control(value, [
      Validators.required,
      Validators.minLength(this.minLength),
      Validators.maxLength(this.maxLength)
    ]);
    this.items.push(itemControl);
    if (emit) this.emitValues();
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
      this.emitValues();
    }
  }

  private resetItems(values: string[]): void {
    while (this.items.length > 0) {
      this.items.removeAt(0);
    }

    if (values.length > 0) {
      values.forEach(value => this.addItem(value, false));
    } else {
      this.addItem('', false);
    }

    this.emitValues();
  }

  private emitValues(): void {
    const values = this.getCurrentNormalizedValues();
    
    this.valuesChange.emit(values);
    this.validityChange.emit(this.isValid());
  }

  private getCurrentNormalizedValues(): string[] {
    const rawValues = this.items.controls.map(control => control.value);
    return this.normalizeValues(rawValues);
  }

  private normalizeValues(values: unknown[]): string[] {
    return values
      .map(value => typeof value === 'string' ? value.trim() : '')
      .filter(value => value.length >= this.minLength);
  }

  private areSameValues(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  isValid(): boolean {
    return this.items.length > 0 && 
           this.items.controls.every(control => control.valid) &&
           this.items.controls.some(control => control.value?.trim().length >= this.minLength);
  }

  getErrorMessage(index: number): string {
    const control = this.items.at(index);
    if (control.hasError('required')) {
      return this.i18n.t('validation.field_required');
    }
    if (control.hasError('minlength') || control.hasError('maxlength')) {
      return this.i18n.t('validation.field_length', { min: this.minLength, max: this.maxLength });
    }
    return '';
  }

  hasError(index: number): boolean {
    const control = this.items.at(index);
    return control.invalid && control.touched;
  }
}
