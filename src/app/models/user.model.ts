import { ProfessionalAreaId } from './professional-area.model';

export interface User {
  nombre: string;
  areaProfesional?: ProfessionalAreaId | string;
  idioma?: string;
  establecimientos: string[];
  tiposDeHoraPorEstablecimiento: { [establecimiento: string]: string[] };
  tiposDeHora?: string[];
  establecimientoColors: { [establecimiento: string]: string };
  isOnboarded: boolean;
}

export interface WizardState {
  nombre: string;
  areaProfesional?: ProfessionalAreaId;
  idioma: string;
  establecimientos: string[];
  tiposDeHoraPorEstablecimiento: { [establecimiento: string]: string[] };
}

export const DEFAULT_USER: User = {
  nombre: '',
  establecimientos: [],
  tiposDeHoraPorEstablecimiento: {},
  establecimientoColors: {},
  isOnboarded: false
};

export const PALETTE_COLORS: Record<string, string[]> = {
  nocturne: [
    '#7c6ae8', '#50c8e8', '#5dd9a3', '#f8b4d9', '#ffd080',
    '#f07878', '#6bb3f0', '#a8e06c', '#e8a06c', '#c49df0',
  ],
  ocean: [
    '#14b8a6', '#38bdf8', '#4ade80', '#f9a8d4', '#fbbf24',
    '#fb7185', '#60a5fa', '#a3e635', '#fb923c', '#a78bfa',
  ],
  sunset: [
    '#f97316', '#f43f5e', '#eab308', '#fb7185', '#a78bfa',
    '#14b8a6', '#38bdf8', '#4ade80', '#e879f9', '#fbbf24',
  ],
  sapphire: [
    '#3b82f6', '#06b6d4', '#10b981', '#f472b6', '#f59e0b',
    '#ef4444', '#8b5cf6', '#84cc16', '#f97316', '#6366f1',
  ],
};

export const ESTABLECIMIENTO_COLORS: string[] = PALETTE_COLORS['nocturne'];
