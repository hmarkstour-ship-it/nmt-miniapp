export function defineVariant({
  id,
  weight = 1,
  solution_path = null,
  representation = 'text',
  context_type = null,
  diagram_type = null,
  parameter_bucket = null,
  metadata = {},
}) {
  if (!id) throw new Error('Variant requires id');
  return Object.freeze({
    id,
    weight,
    solution_path,
    representation,
    context_type,
    diagram_type,
    parameter_bucket,
    metadata: Object.freeze({ ...metadata }),
  });
}
