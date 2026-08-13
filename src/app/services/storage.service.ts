import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

export enum StorageKeys {
  USER = 'user',
  HOURS_ENTRIES = 'hoursEntries',
  VALORES_POR_HORA = 'valoresPorHora',
  BILLING_SNAPSHOTS = 'billingSnapshots',
  BILLING_ADICIONALES = 'billingAdicionales'
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Storage | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private storage: Storage) {}

  async init(): Promise<void> {
    if (this._storage) return;
    
    if (!this.initPromise) {
      this.initPromise = this.storage.create().then(storage => {
        this._storage = storage;
      }).catch(err => {
        console.warn('Storage create failed, using fallback:', err);
        this._storage = this.createFallbackStorage();
      });
    }
    
    await this.initPromise;
  }

  private createFallbackStorage(): Storage {
    return {
      get: async (key: string) => {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      },
      set: async (key: string, value: any) => {
        localStorage.setItem(key, JSON.stringify(value));
      },
      remove: async (key: string) => {
        localStorage.removeItem(key);
      },
      clear: async () => {
        localStorage.clear();
      },
      keys: async () => {
        return Object.keys(localStorage);
      }
    } as unknown as Storage;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.init();
    await this._storage?.set(key, value);
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();
    return await this._storage?.get(key) ?? null;
  }

  async remove(key: string): Promise<void> {
    await this.init();
    await this._storage?.remove(key);
  }

  async clear(): Promise<void> {
    await this.init();
    await this._storage?.clear();
  }

  async keys(): Promise<string[]> {
    await this.init();
    return await this._storage?.keys() ?? [];
  }
}
