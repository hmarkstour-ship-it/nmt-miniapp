export class ExposureController {
  constructor({ maxFamilyShare = 0.30, maxVariantShare = 0.18, minSampleSize = 12 } = {}) {
    this.maxFamilyShare = maxFamilyShare;
    this.maxVariantShare = maxVariantShare;
    this.minSampleSize = minSampleSize;
  }

  check(candidate, history = []) {
    if (history.length < this.minSampleSize) return { ok: true, reasons: [] };

    const totalAfter = history.length + 1;
    const familyCount = history.filter((item) => item.family === candidate.family).length + 1;
    const variantCount = history.filter((item) => item.family === candidate.family && item.variant === candidate.variant).length + 1;
    const familyShare = familyCount / totalAfter;
    const variantShare = variantCount / totalAfter;
    const reasons = [];

    if (familyShare > this.maxFamilyShare) reasons.push('family_overexposed');
    if (variantShare > this.maxVariantShare) reasons.push('variant_overexposed');

    return { ok: reasons.length === 0, reasons, familyShare, variantShare };
  }
}
