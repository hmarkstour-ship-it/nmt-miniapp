export async function aiCritique(provider, { question, genome, references=[] } = {}) {
  if (!provider || provider.name === 'disabled') return { accepted:true, ai_used:false, issues:[] };
  const out = await provider.json({
    system:'You are a strict Ukrainian NMT math item critic. Return JSON only. Never decide the answer; inspect ambiguity, wording, NMT style, accidental clues, weak distractors, and visual clarity. accepted must be boolean.',
    user:JSON.stringify({question,genome,references:references.slice(0,3)}),
    temperature:.2,
  });
  return { accepted: out?.accepted !== false, ai_used:true, issues:out?.issues ?? [], scores:out?.scores ?? {} };
}
