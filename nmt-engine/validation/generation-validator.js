import { validateSchema } from './schema-validator.js';
import { validateAnswer } from './answer-validator.js';
import { validateDistractors } from './distractor-validator.js';
import { validateVisualSpec } from '../visuals/visual-validator.js';

export function validateGeneratedItem(item) {
  const results = [validateSchema(item), validateAnswer(item), validateDistractors(item)];
  if (item.visual) results.push(validateVisualSpec(item.visual));
  const errors = results.flatMap((result) => result.errors ?? []);
  return { ok: errors.length === 0, errors };
}
