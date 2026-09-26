export function filterAccepted(evaluated = []) {
  return evaluated.filter((entry) => entry.result?.accepted);
}
