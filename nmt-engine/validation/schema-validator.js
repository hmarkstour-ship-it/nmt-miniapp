import { validateNormalizedItemShape } from '../core/item-schema.js';

export function validateSchema(item) {
  return validateNormalizedItemShape(item);
}
