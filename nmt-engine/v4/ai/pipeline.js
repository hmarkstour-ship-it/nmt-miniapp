import { aiCritique } from './critic.js';
import { aiPlanGenome } from './planner.js';
import { aiPolishWording } from './wording.js';
import { aiVisualDirection } from './visual-director.js';

export async function reviewEngine4Item(provider, item, references=[]) {
  const planner = await aiPlanGenome(provider,{genome:item.genome,references});
  const critic = await aiCritique(provider,{question:{type:item.type,question:item.question,options:item.options,visual_spec:item.visual_spec},genome:item.genome,references});
  const wording = await aiPolishWording(provider,{question:item.question,invariantFacts:[item.blueprint_id,item.variant_key,...(item.options??[])]});
  const visual = await aiVisualDirection(provider,{visualSpec:item.visual_spec,genome:item.genome});
  return {ai_used:Boolean(planner.ai_used||critic.ai_used||wording.ai_used||visual.ai_used),planner,critic,wording_suggestion:wording,visual_suggestion:visual};
}
