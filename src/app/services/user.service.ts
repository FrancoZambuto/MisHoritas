import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService, StorageKeys } from './storage.service';
import { User, DEFAULT_USER, WizardState, ESTABLECIMIENTO_COLORS } from '../models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userSubject = new BehaviorSubject<User>(DEFAULT_USER);
  public user$: Observable<User> = this.userSubject.asObservable();

  constructor(private storageService: StorageService) {}

  async loadUser(): Promise<User> {
    const user = await this.storageService.get<User>(StorageKeys.USER);
    let currentUser = this.migrateUser(user ?? DEFAULT_USER);

    this.userSubject.next(currentUser);

    // Persistir migración automáticamente si faltaban campos nuevos
    if (JSON.stringify(user) !== JSON.stringify(currentUser)) {
      await this.saveUser(currentUser);
    }

    return currentUser;
  }

  async saveUser(user: User): Promise<void> {
    await this.storageService.set(StorageKeys.USER, user);
    this.userSubject.next(user);
  }

  async completeOnboarding(wizardState: WizardState): Promise<void> {
    const colors = this.assignColorsToEstablecimientos(wizardState.establecimientos, {});

    const user: User = {
      nombre: wizardState.nombre,
      establecimientos: wizardState.establecimientos,
      tiposDeHoraPorEstablecimiento: wizardState.tiposDeHoraPorEstablecimiento,
      establecimientoColors: colors,
      isOnboarded: true
    };
    await this.saveUser(user);
  }

  async isOnboarded(): Promise<boolean> {
    const user = await this.loadUser();
    return user.isOnboarded;
  }

  async addEstablecimiento(establecimiento: string): Promise<void> {
    const user = this.userSubject.getValue();
    if (!user.establecimientos.includes(establecimiento)) {
      const newColors = this.assignColorsToEstablecimientos(
        [establecimiento], 
        user.establecimientoColors || {}
      );
      const tiposDeHoraPorEstablecimiento = {
        ...user.tiposDeHoraPorEstablecimiento,
        [establecimiento]: []
      };
      const updatedUser: User = {
        ...user,
        establecimientos: [...user.establecimientos, establecimiento],
        tiposDeHoraPorEstablecimiento,
        establecimientoColors: { ...user.establecimientoColors, ...newColors }
      };
      await this.saveUser(updatedUser);
    }
  }

  async addTipoDeHora(establecimiento: string, tipoHora: string): Promise<void> {
    const user = this.userSubject.getValue();
    const tipos = user.tiposDeHoraPorEstablecimiento[establecimiento] ?? [];
    if (tipos.includes(tipoHora)) return;

    const updatedUser: User = {
      ...user,
      tiposDeHoraPorEstablecimiento: {
        ...user.tiposDeHoraPorEstablecimiento,
        [establecimiento]: [...tipos, tipoHora]
      }
    };
    await this.saveUser(updatedUser);
  }

  getEstablecimientos(): string[] {
    return this.userSubject.getValue().establecimientos;
  }

  getTiposDeHora(establecimiento?: string): string[] {
    const map = this.userSubject.getValue().tiposDeHoraPorEstablecimiento ?? {};
    if (establecimiento) {
      return map[establecimiento] ?? [];
    }
    return this.getAllTiposDeHora();
  }

  getAllTiposDeHora(): string[] {
    const map = this.userSubject.getValue().tiposDeHoraPorEstablecimiento ?? {};
    const all = Object.values(map).reduce<string[]>((acc, curr) => acc.concat(curr), []);
    return [...new Set(all)];
  }

  getNombre(): string {
    return this.userSubject.getValue().nombre;
  }

  getEstablecimientoColor(establecimiento: string): string {
    const colors = this.userSubject.getValue().establecimientoColors || {};
    return colors[establecimiento] || ESTABLECIMIENTO_COLORS[0];
  }

  getEstablecimientoColors(): { [key: string]: string } {
    return this.userSubject.getValue().establecimientoColors || {};
  }

  async updateItems(
    itemType: 'establecimiento' | 'tipoHora',
    values: string[],
    establecimiento?: string
  ): Promise<void> {
    const user = this.userSubject.getValue();
    
    if (itemType === 'establecimiento') {
      const newColors = this.assignColorsToEstablecimientos(values, user.establecimientoColors || {});
      const previousMap = user.tiposDeHoraPorEstablecimiento || {};
      const nextMap: { [key: string]: string[] } = {};
      values.forEach((est) => {
        nextMap[est] = previousMap[est] ? [...previousMap[est]] : [];
      });

      const updatedUser: User = {
        ...user,
        establecimientos: values,
        tiposDeHoraPorEstablecimiento: nextMap,
        establecimientoColors: newColors
      };
      await this.saveUser(updatedUser);
    } else {
      if (!establecimiento) return;
      const updatedUser: User = {
        ...user,
        tiposDeHoraPorEstablecimiento: {
          ...user.tiposDeHoraPorEstablecimiento,
          [establecimiento]: values
        }
      };
      await this.saveUser(updatedUser);
    }
  }

  async updateTiposDeHoraPorEstablecimiento(
    tiposDeHoraPorEstablecimiento: { [establecimiento: string]: string[] }
  ): Promise<void> {
    const user = this.userSubject.getValue();
    const nextMap: { [establecimiento: string]: string[] } = {};

    user.establecimientos.forEach((est) => {
      const tipos = tiposDeHoraPorEstablecimiento[est];
      nextMap[est] = Array.isArray(tipos) ? [...tipos] : [];
    });

    const updatedUser: User = {
      ...user,
      tiposDeHoraPorEstablecimiento: nextMap
    };
    await this.saveUser(updatedUser);
  }

  private migrateUser(user: User): User {
    const tiposDeHoraLegacy = Array.isArray(user.tiposDeHora) ? user.tiposDeHora : [];
    const existingMap = user.tiposDeHoraPorEstablecimiento ?? {};

    const tiposDeHoraPorEstablecimiento: { [establecimiento: string]: string[] } = {};
    user.establecimientos.forEach((est) => {
      const current = existingMap[est];
      tiposDeHoraPorEstablecimiento[est] = Array.isArray(current) ? [...current] : [...tiposDeHoraLegacy];
    });

    return {
      ...user,
      tiposDeHoraPorEstablecimiento,
      establecimientoColors: this.assignColorsToEstablecimientos(
        user.establecimientos,
        user.establecimientoColors || {}
      )
    };
  }

  private assignColorsToEstablecimientos(
    establecimientos: string[], 
    existingColors: { [key: string]: string }
  ): { [key: string]: string } {
    const colors = { ...existingColors };
    const usedColors = new Set(Object.values(colors));
    
    establecimientos.forEach(est => {
      if (!colors[est]) {
        const availableColor = ESTABLECIMIENTO_COLORS.find(c => !usedColors.has(c)) 
          || ESTABLECIMIENTO_COLORS[Object.keys(colors).length % ESTABLECIMIENTO_COLORS.length];
        colors[est] = availableColor;
        usedColors.add(availableColor);
      }
    });
    
    return colors;
  }
}
