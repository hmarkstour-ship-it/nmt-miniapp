const SUPPORTED = new Set([
  'bar_chart',
  'line_chart',
  'function_graph',
  'trapezoid',
  'parallelogram_diagonal',
  'parallel_lines',
  'triangle_sides',
  'triangle_bisector',
  'right_triangle',
  'circle_angle',
  'circle_diameter',
  'similar_triangles',
  'rect_prism',
  'cube',
  'linked_solids',
  'circle_rectangle',
]);

export function validateVisualSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return { ok:false, errors:['visual spec must be an object'] };
  if (!SUPPORTED.has(spec.type)) errors.push(`unsupported visual type: ${spec.type}`);
  if (!spec.data || typeof spec.data !== 'object') errors.push('visual data must be an object');
  if (spec.metadata?.renderer !== 'nmt-engine4-hybrid-visual-v5') errors.push('visual must be created by Visual Engine v5');
  return { ok:errors.length===0, errors };
}
