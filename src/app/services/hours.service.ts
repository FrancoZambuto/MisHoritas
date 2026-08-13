import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService, StorageKeys } from './storage.service';
import { HourEntry, HoursEntries } from '../models';

@Injectable({
  providedIn: 'root'
})
export class HoursService {
  private hoursSubject = new BehaviorSubject<HoursEntries>({});
  public hours$: Observable<HoursEntries> = this.hoursSubject.asObservable();

  constructor(private storageService: StorageService) {}

  async loadHours(): Promise<HoursEntries> {
    const hours = await this.storageService.get<HoursEntries>(StorageKeys.HOURS_ENTRIES);
    const currentHours = hours ?? {};
    this.hoursSubject.next(currentHours);
    return currentHours;
  }

  async saveHours(hours: HoursEntries): Promise<void> {
    await this.storageService.set(StorageKeys.HOURS_ENTRIES, hours);
    this.hoursSubject.next(hours);
  }

  async getEntriesForDate(date: string): Promise<HourEntry[]> {
    const hours = this.hoursSubject.getValue();
    return hours[date] ?? [];
  }

  async setEntriesForDate(date: string, entries: HourEntry[]): Promise<void> {
    const hours = { ...this.hoursSubject.getValue() };
    if (entries.length === 0) {
      delete hours[date];
    } else {
      hours[date] = entries;
    }
    await this.saveHours(hours);
  }

  async addEntryForDate(date: string, entry: HourEntry): Promise<void> {
    const hours = { ...this.hoursSubject.getValue() };
    if (!hours[date]) {
      hours[date] = [];
    }
    hours[date] = [...hours[date], entry];
    await this.saveHours(hours);
  }

  async updateEntryForDate(date: string, index: number, entry: HourEntry): Promise<void> {
    const hours = { ...this.hoursSubject.getValue() };
    if (hours[date] && hours[date][index]) {
      hours[date] = [...hours[date]];
      hours[date][index] = entry;
      await this.saveHours(hours);
    }
  }

  async deleteEntryForDate(date: string, index: number): Promise<void> {
    const hours = { ...this.hoursSubject.getValue() };
    if (hours[date]) {
      hours[date] = hours[date].filter((_, i) => i !== index);
      if (hours[date].length === 0) {
        delete hours[date];
      }
      await this.saveHours(hours);
    }
  }

  hasEntriesForDate(date: string): boolean {
    const hours = this.hoursSubject.getValue();
    return !!hours[date] && hours[date].length > 0;
  }

  getHoursForMonth(year: number, month: number): HoursEntries {
    const hours = this.hoursSubject.getValue();
    const monthStr = String(month + 1).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    
    const filtered: HoursEntries = {};
    Object.keys(hours).forEach(date => {
      if (date.startsWith(prefix)) {
        filtered[date] = hours[date];
      }
    });
    return filtered;
  }

  getAllHours(): HoursEntries {
    return this.hoursSubject.getValue();
  }
}
