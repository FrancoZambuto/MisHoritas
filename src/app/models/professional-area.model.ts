export const GENERIC_BRANDING_ASSET = 'assets/MisHoritas.png';
export const FALLBACK_PROFESSIONAL_ASSET = 'assets/Other.png';

export type ProfessionalAreaId =
  | 'biochemistry'
  | 'medicine'
  | 'hemotherapy'
  | 'kinesiology'
  | 'surgical_instrumentation'
  | 'other';

export interface ProfessionalAreaConfig {
  id: ProfessionalAreaId;
  displayName: string;
  startupAsset: string;
  headerAsset: string;
}

export interface BrandingAssets {
  startupAsset: string;
  headerAsset: string;
}

export const DEFAULT_EXISTING_USER_AREA: ProfessionalAreaId = 'biochemistry';

export const PROFESSIONAL_AREAS: readonly ProfessionalAreaConfig[] = [
  {
    id: 'biochemistry',
    displayName: 'Bioquímica',
    startupAsset: 'assets/Bacteria.png',
    headerAsset: 'assets/Bacteria.png'
  },
  {
    id: 'medicine',
    displayName: 'Medicina',
    startupAsset: 'assets/Estetoscopio.png',
    headerAsset: 'assets/Estetoscopio.png'
  },
  {
    id: 'hemotherapy',
    displayName: 'Técnico en Hemoterapia',
    startupAsset: 'assets/Gotita.png',
    headerAsset: 'assets/Gotita.png'
  },
  {
    id: 'kinesiology',
    displayName: 'Kinesiología',
    // On-disk filename is Kenesio.png (not Kinesio.png)
    startupAsset: 'assets/Kenesio.png',
    headerAsset: 'assets/Kenesio.png'
  },
  {
    id: 'surgical_instrumentation',
    displayName: 'Instrumentación Quirúrgica',
    startupAsset: 'assets/bisturi.png',
    headerAsset: 'assets/bisturi.png'
  },
  {
    id: 'other',
    displayName: 'Otros',
    startupAsset: FALLBACK_PROFESSIONAL_ASSET,
    headerAsset: FALLBACK_PROFESSIONAL_ASSET
  }
];

const PROFESSIONAL_AREAS_BY_ID = new Map<string, ProfessionalAreaConfig>(
  PROFESSIONAL_AREAS.map((area) => [area.id, area])
);

export function isProfessionalAreaId(value: unknown): value is ProfessionalAreaId {
  return typeof value === 'string' && PROFESSIONAL_AREAS_BY_ID.has(value);
}

export function hasProfessionalAreaSelection(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function resolveProfessionalAreaConfig(
  areaId: string | null | undefined
): ProfessionalAreaConfig {
  if (areaId && PROFESSIONAL_AREAS_BY_ID.has(areaId)) {
    return PROFESSIONAL_AREAS_BY_ID.get(areaId)!;
  }

  return PROFESSIONAL_AREAS_BY_ID.get('other')!;
}

export function resolveBrandingAssets(
  areaId: string | null | undefined
): BrandingAssets {
  if (!hasProfessionalAreaSelection(areaId)) {
    return {
      startupAsset: GENERIC_BRANDING_ASSET,
      headerAsset: GENERIC_BRANDING_ASSET
    };
  }

  const config = resolveProfessionalAreaConfig(areaId);
  return {
    startupAsset: config.startupAsset,
    headerAsset: config.headerAsset
  };
}

export function resolveStartupAsset(areaId: string | null | undefined): string {
  return resolveBrandingAssets(areaId).startupAsset;
}

export function resolveHeaderAsset(areaId: string | null | undefined): string {
  return resolveBrandingAssets(areaId).headerAsset;
}
