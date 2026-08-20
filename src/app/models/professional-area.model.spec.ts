import {
  GENERIC_BRANDING_ASSET,
  FALLBACK_PROFESSIONAL_ASSET,
  PROFESSIONAL_AREAS,
  resolveBrandingAssets,
  resolveHeaderAsset,
  resolveStartupAsset,
  resolveProfessionalAreaConfig,
  isProfessionalAreaId
} from './professional-area.model';

describe('Professional area branding resolver', () => {
  it('Scenario A — brand-new user without profession gets empty branding (text-only splash)', () => {
    expect(resolveStartupAsset(undefined)).toBe(GENERIC_BRANDING_ASSET);
    expect(resolveHeaderAsset(undefined)).toBe(GENERIC_BRANDING_ASSET);
    expect(resolveStartupAsset(null)).toBe(GENERIC_BRANDING_ASSET);
    expect(resolveStartupAsset('')).toBe(GENERIC_BRANDING_ASSET);
    expect(GENERIC_BRANDING_ASSET).toBe('');
  });

  it('Scenario B — Bioquímica uses Bacteria.png for startup and header', () => {
    const branding = resolveBrandingAssets('biochemistry');
    expect(branding.startupAsset).toBe('assets/Bacteria.png');
    expect(branding.headerAsset).toBe('assets/Bacteria.png');
  });

  it('Scenario C — Medicina uses Estetoscopio.png for startup and header', () => {
    const branding = resolveBrandingAssets('medicine');
    expect(branding.startupAsset).toBe('assets/Estetoscopio.png');
    expect(branding.headerAsset).toBe('assets/Estetoscopio.png');
  });

  it('Scenario D — Hemoterapia uses Gotita.png for startup and header', () => {
    const branding = resolveBrandingAssets('hemotherapy');
    expect(branding.startupAsset).toBe('assets/Gotita.png');
    expect(branding.headerAsset).toBe('assets/Gotita.png');
  });

  it('Scenario E — Kinesiología uses Kenesio.png for startup and header', () => {
    const branding = resolveBrandingAssets('kinesiology');
    expect(branding.startupAsset).toBe('assets/Kenesio.png');
    expect(branding.headerAsset).toBe('assets/Kenesio.png');
  });

  it('Scenario F — Instrumentación Quirúrgica uses bisturi.png for startup and header', () => {
    const branding = resolveBrandingAssets('surgical_instrumentation');
    expect(branding.startupAsset).toBe('assets/bisturi.png');
    expect(branding.headerAsset).toBe('assets/bisturi.png');
  });

  it('Scenario G2 — Desarrollo uses dev.png for startup and header', () => {
    const branding = resolveBrandingAssets('dev');
    expect(branding.startupAsset).toBe('assets/dev.png');
    expect(branding.headerAsset).toBe('assets/dev.png');
  });

  it('Scenario G — Otros uses Other.png for startup and header', () => {
    const branding = resolveBrandingAssets('other');
    expect(branding.startupAsset).toBe(FALLBACK_PROFESSIONAL_ASSET);
    expect(branding.headerAsset).toBe(FALLBACK_PROFESSIONAL_ASSET);
    expect(branding.startupAsset).toBe('assets/Other.png');
  });

  it('Scenario H — unknown persisted value falls back to Other.png without throwing', () => {
    expect(() => resolveBrandingAssets('odontology')).not.toThrow();
    const branding = resolveBrandingAssets('odontology');
    expect(branding.startupAsset).toBe(FALLBACK_PROFESSIONAL_ASSET);
    expect(branding.headerAsset).toBe(FALLBACK_PROFESSIONAL_ASSET);
    expect(resolveProfessionalAreaConfig('odontology').id).toBe('other');
  });

  it('keeps Spanish labels as presentation values only', () => {
    expect(PROFESSIONAL_AREAS.map((area) => area.displayName)).toEqual([
      'Bioquímica',
      'Medicina',
      'Técnico en Hemoterapia',
      'Kinesiología',
      'Instrumentación Quirúrgica',
      'Desarrollo',
      'Otros'
    ]);
    expect(isProfessionalAreaId('Bioquímica')).toBeFalse();
    expect(isProfessionalAreaId('biochemistry')).toBeTrue();
  });
});
