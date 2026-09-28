import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { FACTORY_VERSION, BANK_SCHEMA_VERSION } from './constants.js';
const BLUEPRINTS=new Map(QUESTION_BLUEPRINTS.map(x=>[x.id,x]));
export function toBankItem({raw,normalized,v4,duplicate}){
  const id=`nmt4-${duplicate.contentHash.slice(0,16)}`;
  const hasVisual=Boolean(raw.visual_spec||raw.diagram_svg);
  const bp=BLUEPRINTS.get(raw.blueprint_id)??null;
  return {...raw,id,difficulty:'NMT HARD',bank_meta:{
    schema_version:BANK_SCHEMA_VERSION,factory_version:FACTORY_VERSION,
    content_hash:duplicate.contentHash,skeleton_hash:duplicate.skeletonHash,
    family:normalized.family,variant:normalized.variant,solution_path:normalized.solution_path,
    representation:normalized.representation,complexity_score:v4?.complexity?.score??null,complexity_standard:'NMT_HARD',
    quality_score:v4?.quality?.overall??null,quality_components:v4?.quality?.components??null,
    novelty_score:v4?.novelty?.score??null,nmt_similarity:v4?.nmt_similarity??null,
    genome:normalized.genome,genome_signature:v4?.genome_signature??null,
    mock_slots:[...(bp?.mock_slots??[])],usage:{training:raw.type==='choice',training_plain:raw.type==='choice'&&!hasVisual,training_visual:raw.type==='choice'&&hasVisual,mock:true},
    visual:{required:hasVisual,diagram_type:normalized.diagram_type??null,renderer:raw.visual_bundle?.renderer??(hasVisual?'svg':null),engine_version:raw.visual_spec?.metadata?.visual_engine_version??null},
    fingerprint:normalized.fingerprint,
  }};
}
