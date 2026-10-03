import { validateVisualSpec, validateRenderedSvg } from './visual-validator.js';
import {
  renderBarChart,
  renderLineChart,
  renderFunctionGraph,
  renderTrapezoid,
  renderParallelogramDiagonal,
  renderParallelLines,
  renderTriangleSides,
  renderTriangleBisector,
  renderRightTriangle,
  renderCircleAngle,
  renderCircleDiameter,
  renderSimilarTriangles,
  renderRectPrism,
  renderCube,
  renderLinkedSolids,
  renderCircleRectangle,
} from './renderers/svg-renderers.js';

const RENDERERS = Object.freeze({
  bar_chart: renderBarChart,
  line_chart: renderLineChart,
  function_graph: renderFunctionGraph,
  trapezoid: renderTrapezoid,
  parallelogram_diagonal: renderParallelogramDiagonal,
  parallel_lines: renderParallelLines,
  triangle_sides: renderTriangleSides,
  triangle_bisector: renderTriangleBisector,
  right_triangle: renderRightTriangle,
  circle_angle: renderCircleAngle,
  circle_diameter: renderCircleDiameter,
  similar_triangles: renderSimilarTriangles,
  rect_prism: renderRectPrism,
  cube: renderCube,
  linked_solids: renderLinkedSolids,
  circle_rectangle: renderCircleRectangle,
});

export class VisualEngine {
  render(spec) {
    const validation = validateVisualSpec(spec);
    if (!validation.ok) throw new Error(`Invalid visual: ${validation.errors.join('; ')}`);
    const renderer = RENDERERS[spec.type];
    if (!renderer) throw new Error(`No renderer for visual type: ${spec.type}`);
    const markup = renderer(spec);
    const renderedValidation = validateRenderedSvg(markup, spec);
    if (!renderedValidation.ok) {
      throw new Error(`Invalid rendered visual ${spec.type}: ${renderedValidation.errors.join('; ')}`);
    }
    return markup;
  }
}

export const defaultVisualEngine = new VisualEngine();
export function renderVisual(spec) { return defaultVisualEngine.render(spec); }
