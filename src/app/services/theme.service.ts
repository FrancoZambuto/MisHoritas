import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorPalette = 'nocturne' | 'ocean' | 'sunset' | 'sapphire';

const THEME_KEY = 'themeMode';
const PALETTE_KEY = 'colorPalette';

const PALETTES: ColorPalette[] = ['nocturne', 'ocean', 'sunset', 'sapphire'];

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private current: ThemeMode = 'system';
  private palette: ColorPalette = 'nocturne';

  private paletteSubject = new BehaviorSubject<ColorPalette>('nocturne');
  palette$ = this.paletteSubject.asObservable();

  constructor(private storage: StorageService) {}

  async init(): Promise<void> {
    const savedMode = await this.storage.get<ThemeMode>(THEME_KEY);
    const savedPalette = await this.storage.get<ColorPalette>(PALETTE_KEY);
    this.current = savedMode ?? 'system';
    this.palette = savedPalette && PALETTES.includes(savedPalette) ? savedPalette : 'nocturne';
    this.apply();
  }

  getMode(): ThemeMode {
    return this.current;
  }

  getPalette(): ColorPalette {
    return this.palette;
  }

  async setMode(mode: ThemeMode): Promise<void> {
    this.current = mode;
    await this.storage.set(THEME_KEY, mode);
    this.apply();
  }

  async setPalette(palette: ColorPalette): Promise<void> {
    this.palette = palette;
    this.paletteSubject.next(palette);
    await this.storage.set(PALETTE_KEY, palette);
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

    PALETTES.forEach(p => body.classList.remove(`palette-${p}`));
    if (this.palette !== 'nocturne') {
      body.classList.add(`palette-${this.palette}`);
    }
  }
}
