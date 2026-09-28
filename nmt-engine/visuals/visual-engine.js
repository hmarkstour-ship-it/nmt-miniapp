import { validateVisualSpec } from './visual-validator.js';
import {
  renderBarChart,
  renderFunctionGraph,
  renderTrapezoid,
  renderTriangleSides,
  renderCircleAngle,
  renderSimilarTriangles,
  renderRectPrism,
  renderLinkedSolids,
  renderCircleRectangle,
  renderLegacy,
} from './renderers/svg-renderers.js';

const RENDERERS = Object.freeze({
  legacy_svg: renderLegacy,
  bar_chart: renderBarChart,
  function_graph: renderFunctionGraph,
  trapezoid: renderTrapezoid,
  triangle_sides: renderTriangleSides,
  circle_angle: renderCircleAngle,
  similar_triangles: renderSimilarTriangles,
  rect_prism: renderRectPrism,
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
