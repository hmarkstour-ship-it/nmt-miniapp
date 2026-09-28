export async function aiVisualDirection(provider, { visualSpec, genome } = {}) {
  if (!provider || provider.name === 'disabled' || !visualSpec) return { spec:visualSpec, ai_used:false };
  const out = await provider.json({
    system:'You are a math diagram art director. Return JSON only. Suggest label emphasis and auxiliary-line visibility without changing mathematical relations or numeric facts.',
    user:JSON.stringify({visualSpec,genome}), temperature:.2,
  });
  return { spec:{...visualSpec, metadata:{...(visualSpec.metadata??{}), ...(out?.metadata_patch??{})}}, ai_used:true };
}
