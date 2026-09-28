const SUPPORTED = new Set([
  'legacy_svg',
  'bar_chart',
  'function_graph',
  'trapezoid',
  'triangle_sides',
  'circle_angle',
  'similar_triangles',
  'rect_prism',
  'linked_solids',
  'circle_rectangle',
]);

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
  if (!SUPPORTED.has(spec.type)) errors.push(`unsupported visual type: ${spec.type}`);
  if (!spec.data || typeof spec.data !== 'object') errors.push('visual data must be an object');

  if (spec.type === 'legacy_svg') {
    const markup = spec.data?.markup;
    if (typeof markup !== 'string' || !markup.trim().startsWith('<svg')) {
      errors.push('legacy_svg visual must contain SVG markup');
    } else {
      for (const pattern of FORBIDDEN_SVG_PATTERNS) {
        if (pattern.test(markup)) errors.push(`forbidden SVG content: ${pattern}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
