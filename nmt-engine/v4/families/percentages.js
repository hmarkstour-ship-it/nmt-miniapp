import { choiceFromModel, shortFromModel, createGenome, pick, ri, ua } from './shared.js';

function genome(variant, extras={}) {
  return createGenome({
    topic:'percents', subtopic:'Відсотки і пропорції', family:'percentages', concept:variant,
    solutionPath:['translate_context','build_ratio','multi_step_percent','solve_target'],
    steps:4, hiddenRelations:['percent_base_choice','reverse_or_successive_change'], conceptualJumps:2,
    algebraLoad:2, theoremRecall:1, combinedTopics:['ratios'], context:'applied', representation:'word_problem',
    parameterPattern:'integer-percent-with-exact-result', answerFormat:extras.answerFormat ?? 'choice',
    distractorLogic:['wrong_base','add_percentages','apply_to_original','reverse_ratio'], wordingStyle:'nmt-applied-compact',
    ...extras,
  });
}

function successiveDiscount(requiredType) {
  const p1=pick([10,15,20,25]); const p2=pick([10,20,25]); const base=pick([800,1000,1200,1600,2000,2400]);
  const final=base*(1-p1/100)*(1-p2/100); if(!Number.isInteger(final)) return successiveDiscount(requiredType);
  const q=`Ціну товару спочатку зменшили на ${p1}%, а потім нову ціну зменшили ще на ${p2}%. Початкова ціна становила ${base} грн. Якою стала ціна товару після двох знижок?`;
  const g=genome('successive-discounts',{solutionPath:['first_discount','new_base','second_discount','final_price']});
  if(requiredType==='short') return shortFromModel({blueprintId:'applied_ratio_percent',topic:'percents',variant:'v4-successive-discounts-short',question:q,correctValue:final,explanation:`Після першої знижки ціна дорівнює ${base}·${100-p1}/100. Другу знижку застосовуємо вже до нової ціни. Отримуємо ${final} грн.`,genome:{...g,answer_format:'short'}});
  return choiceFromModel({blueprintId:'applied_ratio_percent',topic:'percents',variant:'v4-successive-discounts',question:q,correct:ua(final),distractors:[ua(base*(1-(p1+p2)/100)),ua(base*(1-p1/100)),ua(base*(1-p2/100)),ua(base-final)],explanation:`Відсотки застосовуються послідовно до різних баз: ${base}·${100-p1}/100·${100-p2}/100=${final}.`,genome:g});
}

function reverseMarkup() {
  const markup=pick([20,25,40,50]); const discount=pick([10,20,25]); const cost=pick([500,800,1000,1200,1600]);
  const listed=cost*(1+markup/100); const sold=listed*(1-discount/100); if(!Number.isInteger(sold)) return reverseMarkup();
  const profit=sold-cost;
  return choiceFromModel({blueprintId:'applied_ratio_percent',topic:'percents',variant:'v4-markup-then-discount-profit',question:`Магазин установив ціну товару на ${markup}% вищу за закупівельну. Під час акції цю встановлену ціну знизили на ${discount}%. Закупівельна ціна товару — ${cost} грн. Який прибуток або збиток отримав магазин від продажу одного товару?`,correct:ua(profit),distractors:[ua(cost*(markup-discount)/100),ua(listed-cost),ua(cost-sold),ua(listed-sold)],explanation:`Спочатку встановлена ціна: ${cost}·${100+markup}/100=${listed}. Після знижки: ${listed}·${100-discount}/100=${sold}. Різниця з закупівельною ціною: ${sold}−${cost}=${profit} грн.`,genome:genome('markup-discount-profit',{hiddenRelations:['second_percent_uses_list_price','profit_is_difference']})});
}

function mixtureReplacement() {
  const volume=pick([20,30,40,50]); const c1=pick([20,30,40]); const removed=pick([5,10]); const c2=pick([50,60,70]);
  if(removed>=volume) return mixtureReplacement();
  const solute=volume*c1/100; const removedSolute=removed*c1/100; const addedSolute=removed*c2/100; const final=100*(solute-removedSolute+addedSolute)/volume;
  if(!Number.isInteger(final)) return mixtureReplacement();
  return choiceFromModel({blueprintId:'applied_ratio_percent',topic:'percents',variant:'v4-mixture-replacement',question:`У посудині було ${volume} л ${c1}%-го розчину. З нього відлили ${removed} л суміші й долили ${removed} л ${c2}%-го розчину тієї самої речовини. Якою стала концентрація речовини в суміші?`,correct:`${ua(final)}%`,distractors:[`${ua((c1+c2)/2)}%`,`${ua(c1+(c2-c1)*removed/100)}%`,`${ua(c1+c2)}%`,`${ua(c2-c1)}%`],explanation:`У відлитій частині концентрація така сама, як у початковій суміші. Кількість речовини після заміни: ${solute}−${removedSolute}+${addedSolute}. Ділимо на незмінний об’єм ${volume} л й отримуємо ${final}%.`,genome:genome('mixture-replacement',{combinedTopics:['ratios','mixtures'],hiddenRelations:['removed_part_has_same_concentration','total_volume_restored'],algebraLoad:3})});
}

function reversePercentOfRemaining() {
  const loss=pick([20,25,40]); const remaining=pick([600,720,900,1200,1500]); const original=remaining/(1-loss/100); if(!Number.isInteger(original)) return reversePercentOfRemaining();
  const second=pick([10,15,20]); const target=original*second/100;
  if(!Number.isInteger(target)) return reversePercentOfRemaining();
  return choiceFromModel({blueprintId:'applied_ratio_percent',topic:'percents',variant:'v4-reverse-base-then-percent',question:`Після зменшення кількості товару на ${loss}% залишилося ${remaining} одиниць. Скільки одиниць становлять ${second}% від початкової кількості товару?`,correct:ua(target),distractors:[ua(remaining*second/100),ua(original-remaining),ua(remaining/(1-second/100)),ua(original*(loss/100))],explanation:`${remaining} — це ${100-loss}% початкової кількості. Тому початкова кількість дорівнює ${remaining}/(${(100-loss)/100})=${original}. ${second}% від неї — ${target}.`,genome:genome('reverse-base-then-percent',{hiddenRelations:['remaining_is_not_original_base','second_percent_uses_recovered_base']})});
}

const variants=[successiveDiscount,reverseMarkup,mixtureReplacement,reversePercentOfRemaining];
export function generatePercentagesV4(requiredType=null){return pick(variants)(requiredType);}
