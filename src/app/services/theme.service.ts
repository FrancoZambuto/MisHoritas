import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'themeMode';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private current: ThemeMode = 'system';

  constructor(private storage: StorageService) {}

  async init(): Promise<void> {
    const saved = await this.storage.get<ThemeMode>(STORAGE_KEY);
    this.current = saved ?? 'system';
    this.apply();
  }

  getMode(): ThemeMode {
    return this.current;
  }

  async setMode(mode: ThemeMode): Promise<void> {
    this.current = mode;
    await this.storage.set(STORAGE_KEY, mode);
    this.apply();
  }

  async cycle(): Promise<ThemeMode> {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(this.current) + 1) % order.length];
    await this.setMode(next);
    return next;
  }

  private apply(): void {
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');

    if (this.current === 'light') {
      body.classList.add('light-theme');
    } else if (this.current === 'dark') {
      body.classList.add('dark-theme');
    }
  }
}
