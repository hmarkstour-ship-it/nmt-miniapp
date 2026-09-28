import { createVisualSpec, renderVisual } from '../../visuals/index.js';

const SVG_TYPES = new Set(['function_graph','triangle_sides','right_triangle','circle_angle','circle_diameter','circle_rectangle','parallel_lines','trapezoid','parallelogram_diagonal','similar_triangles','bar_chart','line_chart','rect_prism','cube','linked_solids']);

export function chooseRenderer({ kind, complexity='standard', interactive=false, precision='normal' } = {}) {
  if (kind === 'table' || kind === 'matrix') return 'html';
  if (kind === 'solid_3d' && interactive) return 'threejs';
  if (kind === 'plot_dense') return 'canvas';
  if (kind === 'geometry_2d' && precision === 'publication') return 'tikz';
  return 'svg';
}

function tikzSource(spec){
  if(!spec) return null;
  if(spec.type==='triangle_sides'){
    const {left='a',right='b',base='c'}=spec.data??{};
    return `\\begin{tikzpicture}[scale=1]\\coordinate(A)at(0,0);\\coordinate(B)at(4,0);\\coordinate(C)at(1.5,2.6);\\draw(A)--node[below]{${base}}(B)--node[right]{${right}}(C)--node[left]{${left}}cycle;\\end{tikzpicture}`;
  }
  if(spec.type==='circle_rectangle') return '\\begin{tikzpicture}\\draw (0,0) circle (2);\\draw (-1.4,-1.2) rectangle (1.4,1.2);\\draw (-1.4,-1.2)--(1.4,1.2);\\end{tikzpicture}';
  return null;
}
function canvasPayload(spec){return {kind:'canvas2d',commands:[{op:'semantic',spec}]};}
function threePayload(spec){return {kind:'threejs-scene',camera:{position:[4,3,5],lookAt:[0,0,0]},scene:{semantic_spec:spec}};}
function htmlPayload(spec){return {kind:'html',semantic_spec:spec};}

export function buildHybridVisual({ spec, preferredRenderer=null, intent={} } = {}) {
  if (!spec) return { visual_spec:null, visual_bundle:null, diagram_svg:null };
  const typed = spec.type ? createVisualSpec(spec) : spec;
  const renderer = preferredRenderer ?? chooseRenderer(intent);
  const svgFallback = SVG_TYPES.has(typed.type) ? renderVisual(typed) : null;
  const payload = renderer==='tikz' ? {tikz_source:tikzSource(typed)}
    : renderer==='canvas' ? canvasPayload(typed)
    : renderer==='threejs' ? threePayload(typed)
    : renderer==='html' ? htmlPayload(typed)
    : {kind:'svg'};
  return {
    visual_spec: typed,
    visual_bundle: {
      version:4,
      renderer,
      semantic_spec: typed,
      renderer_payload: payload,
      fallback: svgFallback ? 'svg' : null,
      fallback_svg: svgFallback,
      quality_target: 94,
      runtime_capable: true,
      telegram_strategy: 'svg-fallback-first',
    },
    diagram_svg: svgFallback,
  };
}

export function visualQualityHeuristic(bundle) {
  if (!bundle) return 100;
  let score = 86;
  if (bundle.semantic_spec?.labels) score += 2;
  if (bundle.semantic_spec?.data) score += 3;
  if (bundle.fallback === 'svg') score += 5;
  if (bundle.renderer_payload) score += 2;
  if (bundle.renderer === 'tikz') score += 2;
  return Math.min(100, score);
}
