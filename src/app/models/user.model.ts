import { ProfessionalAreaId } from './professional-area.model';

export interface User {
  nombre: string;
  areaProfesional?: ProfessionalAreaId | string;
  establecimientos: string[];
  tiposDeHoraPorEstablecimiento: { [establecimiento: string]: string[] };
  // Campo legacy para migración de datos existentes
  tiposDeHora?: string[];
  establecimientoColors: { [establecimiento: string]: string };
  isOnboarded: boolean;
}

export interface WizardState {
  nombre: string;
  areaProfesional?: ProfessionalAreaId;
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

export const ESTABLECIMIENTO_COLORS: string[] = [
  '#7c6ae8',  // Violeta (primary)
  '#50c8e8',  // Celeste
  '#5dd9a3',  // Verde
  '#f8b4d9',  // Rosa
  '#ffd080',  // Naranja
  '#f07878',  // Rojo
  '#6bb3f0',  // Azul
  '#a8e06c',  // Lima
  '#e8a06c',  // Durazno
  '#c49df0',  // Lila
];
