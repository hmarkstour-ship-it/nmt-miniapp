export const VISUAL_ENGINE_VERSION = 2;

export function createVisualSpec({ type, diagram_type = null, data = {}, labels = {}, metadata = {} }) {
  if (!type) throw new Error('Visual spec requires type');
  return {
    type,
    diagram_type: diagram_type ?? type,
    data: data ?? {},
    labels: labels ?? {},
    metadata: {
      renderer: 'nmt-engine3-visual-engine-v2',
      visual_engine_version: VISUAL_ENGINE_VERSION,
      ...metadata,
    },
  };
}

export function visualSpecFromQuestion(question, diagramType = null) {
  if (question?.visual_spec) return question.visual_spec;
  if (!question?.diagram_svg) return null;
  return {
    type: 'legacy_svg',
    diagram_type: diagramType,
    data: { markup: question.diagram_svg },
    labels: {},
    metadata: { source: 'legacy-diagram-svg' },
  };
}
