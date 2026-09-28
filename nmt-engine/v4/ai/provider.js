export class DisabledAIProvider {
  constructor(){ this.name='disabled'; }
  async json(){ return null; }
}

export class CompatibleAIProvider {
  constructor({ endpoint=process.env.NMT_AI_ENDPOINT, apiKey=process.env.NMT_AI_KEY, model=process.env.NMT_AI_MODEL } = {}) {
    this.endpoint = endpoint; this.apiKey = apiKey; this.model = model; this.name='compatible-http';
  }
  get enabled(){ return Boolean(this.endpoint && this.model); }
  async json({ system, user, temperature=.4 }) {
    if (!this.enabled) return null;
    const response = await fetch(this.endpoint, {
      method:'POST',
      headers:{'content-type':'application/json', ...(this.apiKey?{authorization:`Bearer ${this.apiKey}`}:{})},
      body:JSON.stringify({model:this.model,temperature,messages:[{role:'system',content:system},{role:'user',content:user}],response_format:{type:'json_object'}}),
    });
    if (!response.ok) throw new Error(`AI provider HTTP ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? data?.output_text ?? null;
    return content ? JSON.parse(content) : null;
  }
}

export function createAIProviderFromEnv(){
  const p = new CompatibleAIProvider();
  return p.enabled ? p : new DisabledAIProvider();
}
