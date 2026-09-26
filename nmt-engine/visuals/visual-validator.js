const FORBIDDEN_SVG_PATTERNS = [
  /<script\b/i,
  /<iframe\b/i,
  /<foreignObject\b/i,
  /\son[a-z]+\s*=/i,
  /javascript\s*:/i,
];

export function validateVisualSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return { ok: false, errors: ['visual spec must be an object'] };
  if (!spec.type) errors.push('visual type is required');

  if (spec.type === 'svg') {
    if (typeof spec.markup !== 'string' || !spec.markup.trim().startsWith('<svg')) {
      errors.push('svg visual must contain SVG markup');
    } else {
      for (const pattern of FORBIDDEN_SVG_PATTERNS) {
        if (pattern.test(spec.markup)) errors.push(`forbidden SVG content: ${pattern}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
