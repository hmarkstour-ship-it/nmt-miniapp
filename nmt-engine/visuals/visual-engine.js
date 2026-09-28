import { validateVisualSpec } from './visual-validator.js';
import {
  renderBarChart,
  renderLineChart,
  renderFunctionGraph,
  renderTrapezoid,
  renderParallelogramDiagonal,
  renderParallelLines,
  renderTriangleSides,
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
    if (typeof markup !== 'string' || !markup.startsWith('<svg')) {
      throw new Error(`Renderer ${spec.type} did not return SVG`);
    }
    return markup;
  }
}

export const defaultVisualEngine = new VisualEngine();
export function renderVisual(spec) { return defaultVisualEngine.render(spec); }
