import { UserService } from './user.service';
import { StorageService, StorageKeys } from './storage.service';
import {
  User,
  DEFAULT_USER,
  DEFAULT_EXISTING_USER_AREA,
  WizardState
} from '../models';

class MemoryStorageService {
  private data = new Map<string, unknown>();

  async init(): Promise<void> {}

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.data.has(key) ? this.data.get(key) : null) as T | null;
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }
}

describe('UserService professional area persistence', () => {
  let storage: MemoryStorageService;
  let userService: UserService;

  const onboardedWithoutArea: User = {
    nombre: 'Ana',
    establecimientos: ['Hospital Central'],
    tiposDeHoraPorEstablecimiento: {
      'Hospital Central': ['Horas comunes']
    },
    establecimientoColors: {
      'Hospital Central': '#7c6ae8'
    },
    isOnboarded: true
  };

  beforeEach(() => {
    storage = new MemoryStorageService();
    userService = new UserService(storage as unknown as StorageService);
  });

  it('Scenario A — new user stays without professional area and not onboarded', async () => {
    const user = await userService.loadUser();
    expect(user.isOnboarded).toBeFalse();
    expect(user.areaProfesional).toBeUndefined();
  });

  it('persists the selected professional area when onboarding completes', async () => {
    const wizardState: WizardState = {
      nombre: 'Lucía',
      areaProfesional: 'medicine',
      establecimientos: ['Clínica Norte'],
      tiposDeHoraPorEstablecimiento: {
        'Clínica Norte': ['Guardia']
      }
    };

    await userService.completeOnboarding(wizardState);
    const persisted = await storage.get<User>(StorageKeys.USER);

    expect(persisted?.isOnboarded).toBeTrue();
    expect(persisted?.areaProfesional).toBe('medicine');
    expect(persisted?.nombre).toBe('Lucía');
    expect(userService.getAreaProfesional()).toBe('medicine');
  });

  it('Scenario I — existing onboarded user without area migrates to Bioquímica', async () => {
    await storage.set(StorageKeys.USER, onboardedWithoutArea);

    const migrated = await userService.loadUser();
    const persisted = await storage.get<User>(StorageKeys.USER);

    expect(migrated.isOnboarded).toBeTrue();
    expect(migrated.areaProfesional).toBe(DEFAULT_EXISTING_USER_AREA);
    expect(migrated.areaProfesional).toBe('biochemistry');
    expect(migrated.nombre).toBe('Ana');
    expect(migrated.establecimientos).toEqual(['Hospital Central']);
    expect(persisted?.areaProfesional).toBe('biochemistry');
  });

  it('Scenario I — migration is idempotent and does not reopen onboarding', async () => {
    await storage.set(StorageKeys.USER, onboardedWithoutArea);

    await userService.loadUser();
    const secondLoad = await userService.loadUser();
    const persisted = await storage.get<User>(StorageKeys.USER);

    expect(secondLoad.isOnboarded).toBeTrue();
    expect(secondLoad.areaProfesional).toBe('biochemistry');
    expect(persisted?.areaProfesional).toBe('biochemistry');
  });

  it('Scenario J — existing configured area is not overwritten', async () => {
    await storage.set(StorageKeys.USER, {
      ...onboardedWithoutArea,
      areaProfesional: 'medicine'
    });

    const user = await userService.loadUser();
    expect(user.areaProfesional).toBe('medicine');
    expect(user.isOnboarded).toBeTrue();
  });

  it('keeps an unknown persisted professional area instead of forcing Bioquímica', async () => {
    await storage.set(StorageKeys.USER, {
      ...onboardedWithoutArea,
      areaProfesional: 'odontology'
    });

    const user = await userService.loadUser();
    expect(user.areaProfesional).toBe('odontology');
    expect(user.isOnboarded).toBeTrue();
  });

  it('updates only professional area metadata when changed later', async () => {
    await userService.completeOnboarding({
      nombre: 'Marcos',
      areaProfesional: 'biochemistry',
      establecimientos: ['Lab Sur'],
      tiposDeHoraPorEstablecimiento: {
        'Lab Sur': ['Horas comunes']
      }
    });

    await userService.updateAreaProfesional('kinesiology');
    const persisted = await storage.get<User>(StorageKeys.USER);

    expect(persisted?.areaProfesional).toBe('kinesiology');
    expect(persisted?.nombre).toBe('Marcos');
    expect(persisted?.establecimientos).toEqual(['Lab Sur']);
    expect(persisted?.tiposDeHoraPorEstablecimiento['Lab Sur']).toEqual(['Horas comunes']);
    expect(persisted?.isOnboarded).toBeTrue();
  });

  it('does not invent a default user record when storage is empty', async () => {
    const user = await userService.loadUser();
    expect(user).toEqual(jasmine.objectContaining({
      nombre: DEFAULT_USER.nombre,
      isOnboarded: false,
      establecimientos: []
    }));
    expect(await storage.get<User>(StorageKeys.USER)).toBeNull();
  });
});
