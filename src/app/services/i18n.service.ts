import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';

import esTranslations from '../../assets/i18n/es.json';
import enTranslations from '../../assets/i18n/en.json';

export type AppLanguage = 'es' | 'en';

const STORAGE_KEY = 'appLanguage';

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  es: esTranslations as Record<string, string>,
  en: enTranslations as Record<string, string>
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private current: AppLanguage = 'es';
  private langSubject = new BehaviorSubject<AppLanguage>('es');
  lang$ = this.langSubject.asObservable();

  constructor(private storage: StorageService) {}

  async init(): Promise<void> {
    const saved = await this.storage.get<AppLanguage>(STORAGE_KEY);
    if (saved && (saved === 'es' || saved === 'en')) {
      this.current = saved;
      this.langSubject.next(saved);
    }
  }

  getLanguage(): AppLanguage {
    return this.current;
  }

  async setLanguage(lang: AppLanguage): Promise<void> {
    this.current = lang;
    this.langSubject.next(lang);
    await this.storage.set(STORAGE_KEY, lang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const dict = TRANSLATIONS[this.current] ?? TRANSLATIONS['es'];
    let value = dict[key] ?? TRANSLATIONS['es'][key] ?? key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      });
    }

    return value;
  }
}

@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  constructor(private i18n: I18nService) {}

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
