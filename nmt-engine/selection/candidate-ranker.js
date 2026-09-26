export function rankCandidates(evaluated = []) {
  return [...evaluated].sort((a, b) => {
    if (a.result.accepted !== b.result.accepted) return Number(b.result.accepted) - Number(a.result.accepted);
    if (a.result.diversityScore !== b.result.diversityScore) return b.result.diversityScore - a.result.diversityScore;
    return (a.result.reasons?.length ?? 0) - (b.result.reasons?.length ?? 0);
  });
}
