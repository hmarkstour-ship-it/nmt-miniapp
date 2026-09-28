export async function aiPolishWording(provider, { question, invariantFacts=[] } = {}) {
  if (!provider || provider.name === 'disabled') return { text:question, ai_used:false };
  const out = await provider.json({
    system:'Rewrite a Ukrainian NMT math prompt for clarity and authentic concise exam style. Return JSON {text}. Never add/remove/change mathematical facts, values, symbols, or requested quantity.',
    user:JSON.stringify({question,invariantFacts}), temperature:.25,
  });
  return { text:out?.text ?? question, ai_used:true };
}
