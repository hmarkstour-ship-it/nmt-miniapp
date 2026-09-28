export async function aiPlanGenome(provider, { genome, references=[] } = {}) {
  if (!provider || provider.name === 'disabled') return { genome, ai_used:false };
  const out = await provider.json({
    system:'You are an NMT mathematics assessment architect. Return JSON only. Do not solve or change the correct mathematics. Propose structural diversity, hidden relation, wording style, and visual intent.',
    user:JSON.stringify({genome,references:references.slice(0,5).map(r=>({topic:r.topic,subtopic:r.subtopic,skill:r.skill,format:r.format,representation:r.representation,solution_path_hint:r.solution_path_hint}))}),
  });
  return { genome:{...genome,...(out?.genome_patch ?? {})}, ai_used:true, notes:out?.notes ?? [] };
}
