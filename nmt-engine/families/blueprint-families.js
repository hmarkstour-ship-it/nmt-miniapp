import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { defineFamily, defineVariant } from '../dsl/index.js';
import { FamilyRegistry } from '../core/family-registry.js';

function defaultRepresentation(blueprint) {
  if (!blueprint.diagram_type) return 'text';
  if (String(blueprint.diagram_type).includes('graph')) return 'graph';
  if (String(blueprint.diagram_type).includes('chart')) return 'chart';
  if (['solid', 'linked_solids'].includes(blueprint.diagram_type)) return 'spatial_diagram';
  return 'geometry_diagram';
}

export function blueprintToFamily(blueprint) {
  const variant = defineVariant({
    id: 'base',
    solution_path: blueprint.skill ?? blueprint.id,
    representation: defaultRepresentation(blueprint),
    diagram_type: blueprint.diagram_type ?? null,
    metadata: {
      formats: blueprint.formats ?? [],
      mock_slots: blueprint.mock_slots ?? [],
      source_confidence: blueprint.source_confidence ?? null,
      subtopic: blueprint.subtopic ?? null,
    },
  });

  return defineFamily({
    id: blueprint.id,
    topic: blueprint.topic,
    title: blueprint.subtopic ?? blueprint.id,
    variants: [variant],
    metadata: {
      skill: blueprint.skill ?? null,
      formats: blueprint.formats ?? [],
      mock_slots: blueprint.mock_slots ?? [],
      diagram_type: blueprint.diagram_type ?? null,
      source_confidence: blueprint.source_confidence ?? null,
    },
  });
}

export function createBlueprintFamilyRegistry() {
  const registry = new FamilyRegistry();
  registry.registerMany(QUESTION_BLUEPRINTS.map(blueprintToFamily));
  return registry;
}
