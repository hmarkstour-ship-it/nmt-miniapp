import { validateVisualSpec } from './visual-validator.js';

export class VisualEngine {
  render(spec) {
    const validation = validateVisualSpec(spec);
    if (!validation.ok) throw new Error(`Invalid visual: ${validation.errors.join('; ')}`);

    if (spec.type === 'svg') return spec.markup;
    throw new Error(`Unsupported visual type: ${spec.type}`);
  }
}
