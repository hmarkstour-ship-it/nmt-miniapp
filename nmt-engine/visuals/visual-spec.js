export function createVisualSpec({ type, diagram_type = null, markup = null, data = null, metadata = {} }) {
  if (!type) throw new Error('Visual spec requires type');
  return { type, diagram_type, markup, data, metadata };
}

export function visualSpecFromQuestion(question, diagramType = null) {
  if (!question?.diagram_svg) return null;
  return createVisualSpec({
    type: 'svg',
    diagram_type: diagramType,
    markup: question.diagram_svg,
    metadata: { source: 'question-engine' },
  });
}
