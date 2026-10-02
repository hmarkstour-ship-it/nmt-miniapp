export const VISUAL_ENGINE_VERSION = 5;

export function createVisualSpec({ type, diagram_type = null, data = {}, labels = {}, metadata = {} }) {
  if (!type) throw new Error('Visual spec requires type');
  return {
    type,
    diagram_type: diagram_type ?? type,
    data: data ?? {},
    labels: labels ?? {},
    metadata: {
      renderer: 'nmt-engine4-hybrid-visual-v5',
      visual_engine_version: VISUAL_ENGINE_VERSION,
      ...metadata,
    },
  };
}

export function visualSpecFromQuestion(question) {
  // Legacy raw SVG is deliberately not adapted anymore. Every generated
  // visual must originate as a typed visual_spec and pass through VisualEngine.
  return question?.visual_spec ?? null;
}
