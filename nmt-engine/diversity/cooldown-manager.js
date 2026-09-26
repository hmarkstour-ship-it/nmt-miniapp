export class CooldownManager {
  constructor({ familyCooldown = 7, variantCooldown = 20, solutionPathCooldown = 8 } = {}) {
    this.familyCooldown = familyCooldown;
    this.variantCooldown = variantCooldown;
    this.solutionPathCooldown = solutionPathCooldown;
  }

  check(candidate, history = []) {
    const reasons = [];
    const familyRecent = history.slice(-this.familyCooldown);
    const variantRecent = history.slice(-this.variantCooldown);
    const pathRecent = history.slice(-this.solutionPathCooldown);

    if (candidate.family && familyRecent.some((item) => item.family === candidate.family)) {
      reasons.push(`family:${candidate.family}`);
    }
    if (candidate.family && candidate.variant && variantRecent.some((item) => item.family === candidate.family && item.variant === candidate.variant)) {
      reasons.push(`variant:${candidate.family}/${candidate.variant}`);
    }
    if (candidate.solution_path && pathRecent.some((item) => item.solution_path === candidate.solution_path)) {
      reasons.push(`solution_path:${candidate.solution_path}`);
    }

    return { ok: reasons.length === 0, reasons };
  }
}
