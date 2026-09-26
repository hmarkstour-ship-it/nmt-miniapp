import re, json, hashlib, statistics, os
from pathlib import Path
from collections import Counter, defaultdict

BASE=Path('/mnt/data/stage1_dataset')

UKR_LETTERS='АБВГД'

def clean_text(s):
    s=s.replace('\u00ad','').replace('\x07','').replace('￾','')
    # remove common watermarks / page decorations
    lines=[]
    for line in s.splitlines():
        st=line.strip()
        if not st: 
            lines.append('')
            continue
        if st in {'at','m','it','ab','@','h'}: continue
        if re.fullmatch(r'@?abitmath', st, re.I): continue
        if re.fullmatch(r'https://t\.me/abit(?:math|blog).*', st): continue
        # standalone page number
        if re.fullmatch(r'\d{1,3}', st):
            continue
        lines.append(line.rstrip())
    s='\n'.join(lines)
    s=re.sub(r'[ \t]+',' ',s)
    s=re.sub(r'\n{3,}','\n\n',s)
    return s.strip()

def skeleton(text):
    t=text.lower()
    t=re.sub(r'@[a-z0-9_]+','',t)
    t=re.sub(r'https?://\S+','',t)
    t=re.sub(r'(?<![a-zа-яіїєґ])[-+−]?\d+(?:[.,]\d+)?',' # ',t)
    t=re.sub(r'\b[abcdабвгд]\b',' ',t)
    t=re.sub(r'\s+',' ',t)
    t=re.sub(r'[^a-zа-яіїєґ#πφ√∠]+',' ',t)
    return re.sub(r'\s+',' ',t).strip()

def format_for(q):
    if q<=15: return 'single_choice'
    if q<=18: return 'matching'
    return 'short_answer'

def representation(text):
    t=text.lower()
    if 'діаграм' in t: return 'chart'
    if 'таблиц' in t: return 'table'
    if 'графік' in t or 'графіка' in t:
        return 'graph'
    if 'схем' in t and ('літак' in t or 'салон' in t): return 'scheme'
    if 'рисунк' in t:
        if any(w in t for w in ['куб','призм','пірамід','конус','циліндр','кул','паралелепіпед']): return 'spatial_diagram'
        return 'geometry_diagram'
    return 'text'

def classify(text,q):
    t=text.lower().replace('−','-')
    fmt=format_for(q)
    # official content line first
    if any(w in t for w in ['куб','пірамід','призм','циліндр','конус','куля','кулі','паралелепіпед','у просторі','просторов']):
        official='Стереометрія'
        topic='geometry'
        if 'координат' in t or 'вектор' in t: sub='Координати й вектори у просторі'; skill='spatial_coordinates_vectors'
        elif 'об’єм' in t or "об'єм" in t: sub='Об’єми тіл'; skill='solid_volume'
        elif 'бічн' in t or 'поверхн' in t: sub='Площі поверхонь'; skill='solid_surface_area'
        elif 'утворен' in t and 'обертан' in t: sub='Тіла обертання'; skill='solid_of_revolution'
        elif 'площин' in t or 'паралельн' in t: sub='Прямі й площини у просторі'; skill='spatial_lines_planes'
        else: sub='Просторові тіла'; skill='solid_geometry_general'
    elif any(w in t for w in ['трикут','трапец','паралелограм','прямокутник','квадрат','ромб','коло','круга','хорд','діаметр','радіус','кут','медіан','бісектрис','висот']) and not ('функц' in t and 'кут' not in t):
        official='Планіметрія'; topic='geometry'
        if 'трапец' in t: sub='Трапеція'; skill='trapezoid'
        elif 'коло' in t or 'круга' in t or 'хорд' in t or 'діаметр' in t or 'радіус' in t: sub='Коло і круг'; skill='circle'
        elif 'трикут' in t: sub='Трикутник'; skill='triangle'
        elif 'паралелограм' in t: sub='Паралелограм'; skill='parallelogram'
        elif 'ромб' in t: sub='Ромб'; skill='rhombus'
        elif 'квадрат' in t: sub='Квадрат'; skill='square'
        elif 'прямокутник' in t: sub='Прямокутник'; skill='rectangle'
        else: sub='Кути та геометричні властивості'; skill='angles_geometry'
        if 'подібн' in t: skill='similarity'
        elif 'косинус' in t and 'cos' not in t: skill='law_of_cosines'
        elif 'синус' in t and 'sin' not in t: skill='law_of_sines'
        elif 'площ' in t: skill += '_area'
        elif 'периметр' in t: skill += '_perimeter'
    elif any(w in t for w in ['ймовірн','навмання','комбінатор','медіан','середнє арифметич','частот','вибирають','обирають']) or ('діаграм' in t and q in [1,2,7,20]):
        official='Елементи комбінаторики, теорії ймовірностей та статистики'; topic='probability_stats'
        if 'ймовірн' in t or 'навмання' in t: sub='Ймовірність'; skill='classical_probability'
        elif 'комбінатор' in t: sub='Комбінаторика'; skill='combinatorics'
        else: sub='Статистика та дані'; skill='statistics_interpretation'
    elif any(w in t for w in ['функц','графік','похідн','первісн','критичн','екстрем','прогрес']) and not ('рівняння' in t and q>=22):
        official='Функції, прогресії'; topic='functions'
        if 'похідн' in t: sub='Похідна'; skill='derivative'
        elif 'первісн' in t or 'інтеграл' in t: sub='Первісна та інтеграл'; skill='antiderivative_integral'
        elif 'критичн' in t or 'максимум' in t or 'мінімум' in t: sub='Екстремуми функції'; skill='extrema'
        elif 'прогрес' in t: sub='Прогресії'; skill='progressions'
        elif 'парн' in t or 'непарн' in t: sub='Властивості функцій'; skill='parity'
        elif 'графік' in t: sub='Графіки функцій'; skill='graph_interpretation_transform'
        else: sub='Функції'; skill='function_properties'
    elif any(w in t for w in ['рівнян','нерівн','систем']) or (q==22 and ' a' in ' '+t):
        official='Рівняння і нерівності'; topic='equations_inequalities'
        if q==22 and ('значень a' in t or 'значення a' in t or 'за кожного з яких' in t): sub='Завдання з параметром'; skill='parameter_roots'
        elif 'систем' in t: sub='Системи рівнянь/нерівностей'; skill='systems'
        elif 'нерівн' in t: sub='Нерівності'; skill='inequality'
        elif 'log' in t or 'логариф' in t: sub='Логарифмічні рівняння'; skill='log_equation'
        elif re.search(r'\^?x',t) and any(ch in t for ch in ['2','3','5']): sub='Показникові/степеневі рівняння'; skill='exponential_equation'
        else: sub='Рівняння'; skill='equation'
    else:
        official='Числа і вирази'; topic='numbers_expressions'
        if 'відсот' in t or '%' in t: sub='Відсотки і пропорції'; skill='percent_ratio'
        elif 'log' in t or 'логариф' in t: sub='Логарифми'; skill='logarithmic_expression'
        elif 'sin' in t or 'cos' in t or 'tg' in t or 'тригоном' in t: sub='Тригонометричні вирази'; skill='trigonometric_expression'
        elif 'модул' in t or '|' in t: sub='Модуль'; skill='absolute_value_expression'
        elif 'степен' in t or re.search(r'[a-z]\d',t): sub='Степені'; skill='powers'
        elif 'вираз' in t or 'спрост' in t: sub='Алгебраїчні вирази'; skill='algebraic_simplification'
        elif '%' in t: sub='Відсотки'; skill='percent'
        else: sub='Числа та арифметика'; skill='numeric_reasoning'
    return official,topic,sub,skill

def solution_path(text,q,skill,rep):
    t=text.lower()
    if q in [16,17,18]: return 'solve_3_fragments→match_to_5_options'
    if q==22 and skill=='parameter_roots': return 'transform_model→analyze_number_of_roots→derive_parameter_set→aggregate_if_needed'
    if skill=='derivative':
        return 'differentiate→evaluate_or_use_tangent_condition'
    if skill=='extrema': return 'differentiate→solve_f_prime_zero→classify_extremum'
    if skill=='antiderivative_integral': return 'apply_antiderivative_rule→evaluate'
    if 'probability' in skill: return 'count_favorable_outcomes→count_all_outcomes→form_ratio'
    if 'percent' in skill: return 'translate_percent_relation→solve_arithmetic_relation'
    if rep in ['chart','table','graph'] and q<=10: return 'read_visual_data→compare_or_compute'
    if skill in ['triangle','trapezoid','circle','rectangle','square','rhombus','parallelogram','similarity','law_of_cosines','law_of_sines'] or skill.startswith(('triangle_','trapezoid_','circle_','rectangle_','square_','rhombus_','parallelogram_')):
        return 'extract_geometric_constraints→derive_missing_relation→compute_target'
    if skill.startswith('solid_') or skill in ['spatial_coordinates_vectors','spatial_lines_planes']:
        return 'extract_spatial_constraints→derive_missing_measure→compute_target'
    if skill in ['equation','log_equation','exponential_equation','systems']:
        return 'transform_equation→solve→select_requested_value'
    if skill=='inequality': return 'transform_inequality→solve_intervals→select_requested_result'
    if skill in ['algebraic_simplification','powers','logarithmic_expression','trigonometric_expression','numeric_reasoning']:
        return 'apply_identity_or_operation_rules→simplify→select_result'
    if skill in ['graph_interpretation_transform','function_properties','parity']:
        return 'apply_function_property→interpret_graph_or_expression→select_result'
    return 'identify_relation→compute→select_or_enter_result'

def difficulty_from(p,q):
    if p is not None:
        if p>=70: band='easy'
        elif p>=45: band='medium'
        elif p>=25: band='hard'
        else: band='very_hard'
        return band,'psychometric_p_value'
    # position prior only, intentionally weak
    if q<=4: band='easy'
    elif q<=10: band='medium'
    elif q<=15: band='medium_hard'
    elif q<=18: band='hard'
    elif q<=20: band='hard'
    else: band='very_hard'
    return band,'position_prior'

def estimate_steps(q,skill):
    if q<=4: base=1
    elif q<=10: base=2
    elif q<=15: base=2
    elif q<=18: base=3
    elif q<=20: base=3
    else: base=4
    if skill in ['parameter_roots','solid_volume','solid_surface_area','extrema']: base=max(base,4)
    return base

def extract_psychometrics(block):
    if 'P-value' not in block and 'Складність' not in block: return None,None,None,None
    lines=[l.strip() for l in block.splitlines() if l.strip()]
    candidates=[]
    for line in lines[-20:]:
        nums=re.findall(r'(?<!\d)(\d{1,3},\d)(?!\d)',line)
        if len(nums)>=3:
            candidates.append((line,nums))
    if not candidates: return None,None,None,None
    line,nums=candidates[-1]
    vals=[float(x.replace(',','.')) for x in nums]
    p,d,rit=vals[-3],vals[-2],vals[-1]
    # answer is prefix before first decimal token
    idx=line.find(nums[0])
    prefix=line[:idx].strip().replace(' ','')
    ans=None
    if prefix:
        ans=prefix
    return p,d,rit,ans

def parse_answer_table(text):
    ans={}
    lines=text.splitlines()
    # First pass: ordinary same-line tables.
    for line in lines:
        m=re.match(r'^\s*(\d{1,2})\s+(.+?)\s*$',line)
        if not m: continue
        q=int(m.group(1))
        if 1<=q<=22:
            val=m.group(2).strip()
            if len(val)>80: continue
            if re.search(r'[АБВГД]|\d|–|-',val):
                ans[q]=val
    # Layout-aware pass for the reconstructed collection: watermarks split
    # q1/q2/q11 from their answer cells. Read left and right columns in order.
    start=0
    for i,line in enumerate(lines):
        if 'Номер завдання' in line and 'Правильна відповідь' in line:
            start=i+1; break
    if start:
        qseq=[]; aseq=[]
        for line in lines[start:]:
            left=line[:38] if len(line)>=38 else line
            right=line[50:] if len(line)>50 else ''
            qm=re.search(r'(?<!\d)(\d{1,2})(?!\d)',left)
            if qm:
                q=int(qm.group(1))
                if 1<=q<=22 and (not qseq or q!=qseq[-1]): qseq.append(q)
            # remove watermark fragments then parse answer cell
            rr=re.sub(r'\b(?:at|it|ab|m|h)\b',' ',right).strip()
            if rr:
                # exact likely cell values only
                if re.fullmatch(r'[АБВГД]',rr) or re.fullmatch(r'1[–-][АБВГД];?\s*2[–-][АБВГД];?\s*3[–-][АБВГД]',rr) or re.fullmatch(r'[−–-]?\d+(?:[,.]\d+)?',rr):
                    aseq.append(rr)
        if len(qseq)>=22 and len(aseq)>=22:
            for q,val in zip(qseq[:22],aseq[:22]): ans[q]=val
    return ans

def split_questions(text, maxq=22):
    # capture q markers at starts of lines
    ms=list(re.finditer(r'(?m)^\s*(\d{1,2})\.\s*',text))
    out=[]
    for i,m in enumerate(ms):
        q=int(m.group(1))
        if not 1<=q<=maxq: continue
        end=ms[i+1].start() if i+1<len(ms) else len(text)
        block=text[m.start():end]
        out.append((q,m.start(),block))
    # Keep first monotonic occurrence of 1..22, avoid TOC/other references
    chosen=[]; expected=1
    for q,pos,block in out:
        if q==expected:
            chosen.append((q,pos,block)); expected+=1
            if expected==23: break
    return chosen

def page_for_offset(text,offset):
    return text[:offset].count('\f')+1

records=[]

def add_record(source_name,source_id,year,session,q,block,answer,page,source_type,source_confidence,psych=None):
    block=clean_text(block)
    p=d=rit=None; psych_ans=None
    if psych:
        p,d,rit,psych_ans=psych
    if not answer and psych_ans:
        answer=psych_ans
    off,topic,sub,skill=classify(block,q)
    rep=representation(block)
    has_visual=rep!='text'
    diff,basis=difficulty_from(p,q)
    sk=skeleton(block)
    rec={
        'id':f'{source_id}__{session.replace(" ","_").replace(".","")}__q{q:02d}',
        'year':year,
        'session':session,
        'question_no':q,
        'format':format_for(q),
        'official_content_line':off,
        'topic':topic,
        'subtopic':sub,
        'skill':skill,
        'representation':rep,
        'has_visual':has_visual,
        'visual_review_required': has_visual,
        'solution_path_hint':solution_path(block,q,skill,rep),
        'steps_estimate':estimate_steps(q,skill),
        'difficulty_band':diff,
        'difficulty_basis':basis,
        'psychometrics':({'p_value':p,'d_index':d,'rit':rit} if p is not None else None),
        'answer_key':answer,
        'source':{
            'file':source_name,
            'source_id':source_id,
            'page_start':page,
            'type':source_type,
            'confidence':source_confidence,
        },
        'raw_text':block,
        'text_skeleton':sk,
        'skeleton_hash':hashlib.sha1(sk.encode('utf-8')).hexdigest()[:16],
        'classification_confidence':'medium',
        'review_flags':[],
    }
    # flags
    if not answer: rec['review_flags'].append('missing_answer_key')
    if len(block)<25: rec['review_flags'].append('short_or_garbled_text')
    if any(ch in block for ch in ['','￾','—\n','�']): rec['review_flags'].append('formula_text_may_be_garbled')
    if has_visual: rec['review_flags'].append('inspect_embedded_visual_before_blueprint')
    if q>=19 and diff in ['easy','medium']: rec['review_flags'].append('difficulty_check')
    records.append(rec)

# Short files
short_specs=[
    ('2025_mat-1.txt','2025_mat-1.pdf','ref_2025_psychometric_1',2025,'provided variant 1','psychometric_extract',3,False),
    ('2025_mat-2.txt','2025_mat-2.pdf','ref_2025_certification_2',2025,'provided variant 2','certification_work_extract',3,True),
    ('НМТ_2026_Варіант_1_Математика_@abitdocs.txt','НМТ_2026_Варіант_1_Математика_@abitdocs.pdf','ref_2026_psychometric_1',2026,'provided variant 1','psychometric_extract',3,False),
    ('НМТ_2026_Варіант_2_Математика_@abitdocs.txt','НМТ_2026_Варіант_2_Математика_@abitdocs.pdf','ref_2026_certification_2',2026,'provided variant 2','certification_work_extract',3,True),
]
for txtfn,pdffn,sid,year,session,stype,sconf,has_answer_page in short_specs:
    text=(BASE/txtfn).read_text(encoding='utf-8',errors='ignore')
    qs=split_questions(text)
    # answer table after 'Правильні відповіді' if present
    answers={}
    if has_answer_page:
        idx=text.lower().rfind('правильні відповіді')
        if idx!=-1: answers=parse_answer_table(text[idx:])
    for q,pos,block in qs:
        psych=extract_psychometrics(block)
        ans=answers.get(q)
        add_record(pdffn,sid,year,session,q,block,ans,page_for_offset(text,pos),stype,sconf,psych)

# Big reconstructed 2026 by TOC page ranges
bigfn='НМТ 2026 основна сесія.txt'; bigpdf='НМТ 2026 основна сесія.pdf'; sid='ref_2026_reconstructed_main'
text=(BASE/bigfn).read_text(encoding='utf-8',errors='ignore')
pages=text.split('\f')
sessions=[
('23.05.2026',12,18),('30.05.2026',19,24),('01.06.2026',25,30),('02.06.2026',31,36),('03.06.2026',37,43),('04.06.2026',44,49),('05.06.2026',50,55),('08.06.2026',56,61),('09.06.2026',62,67),('10.06.2026',68,74),('11.06.2026',75,80),('12.06.2026',81,87),('15.06.2026',88,93),('16.06.2026',94,99),('17.06.2026',100,106),('18.06.2026',107,112),('19.06.2026',113,118)]
for session,start,answer_page in sessions:
    content='\f'.join(pages[start-1:answer_page-1])
    ans_text=pages[answer_page-1] if answer_page-1<len(pages) else ''
    answers=parse_answer_table(ans_text)
    qs=split_questions(content)
    for q,pos,block in qs:
        local_page=page_for_offset(content,pos)
        add_record(bigpdf,sid,2026,session,q,block,answers.get(q),start+local_page-1,'reconstructed_participant_recall',2,None)

# Duplicate groups by skeleton hash
by_hash=defaultdict(list)
for r in records: by_hash[r['skeleton_hash']].append(r['id'])
for r in records:
    group=by_hash[r['skeleton_hash']]
    r['possible_duplicate_group']=group if len(group)>1 else None

# classification confidence upgrades/downgrades
for r in records:
    if r['official_content_line'] and r['skill'] and len(r['raw_text'])>40:
        r['classification_confidence']='high' if not r['review_flags'] or r['review_flags']==['inspect_embedded_visual_before_blueprint'] else 'medium'
    if 'short_or_garbled_text' in r['review_flags']: r['classification_confidence']='low'

# Sort
records.sort(key=lambda r:(r['year'],r['source']['source_id'],r['session'],r['question_no']))

# summary
summary={
    'version':'stage1-v1',
    'record_count':len(records),
    'sources':dict(Counter(r['source']['file'] for r in records)),
    'years':dict(Counter(str(r['year']) for r in records)),
    'formats':dict(Counter(r['format'] for r in records)),
    'official_content_lines':dict(Counter(r['official_content_line'] for r in records)),
    'representations':dict(Counter(r['representation'] for r in records)),
    'difficulty_bands':dict(Counter(r['difficulty_band'] for r in records)),
    'psychometric_records':sum(1 for r in records if r['psychometrics']),
    'visual_records':sum(1 for r in records if r['has_visual']),
    'missing_answer_keys':sum(1 for r in records if not r['answer_key']),
    'duplicate_groups':sum(1 for g in by_hash.values() if len(g)>1),
}

out={'metadata':{
    'name':'NMT Mathematics Reference Dataset',
    'version':'1.0-stage1',
    'purpose':'Reference corpus for NMT Engine 3.0; not production question bank',
    'notes':[ 
        'Raw text is preserved from supplied PDFs and may contain PDF extraction artifacts in formulas.',
        'Visual questions are flagged for visual review before conversion into production blueprints.',
        'The reconstructed 2026 main-session collection explicitly states that wording/options may differ from the original exam; confidence is lower for those records.',
        'Topic/skill/solution-path labels are first-pass structured annotations and should be audited before blueprint compilation.'
    ],
    'summary':summary,
},'questions':records}
(BASE/'nmt-reference-dataset-v1.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')

# schema doc
schema={
  'record_fields':{
    'id':'stable dataset id','year':'exam/reference year','session':'variant/date label','question_no':'1..22','format':'single_choice|matching|short_answer','official_content_line':'2026-style content line','topic':'internal broad topic','subtopic':'human-readable subtopic','skill':'machine-oriented skill label','representation':'text|graph|chart|table|geometry_diagram|spatial_diagram|scheme','has_visual':'visual dependency flag','visual_review_required':'must inspect source image before blueprinting','solution_path_hint':'first-pass reasoning path','steps_estimate':'estimated logical steps','difficulty_band':'first-pass level','difficulty_basis':'psychometric_p_value or position_prior','psychometrics':'p_value,d_index,rit when extractable','answer_key':'source answer/key','source':'file, id, page, type, confidence','raw_text':'source-extracted question block','text_skeleton':'numbers/options normalized for duplicate detection','skeleton_hash':'stable hash','possible_duplicate_group':'same-skeleton record ids','review_flags':'manual audit flags'
  }
}
(BASE/'nmt-reference-dataset-v1-schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2),encoding='utf-8')

# markdown audit report
src_counts=summary['sources']; line_counts=summary['official_content_lines']; rep_counts=summary['representations']
md=[]
md.append('# NMT Reference Dataset — Stage 1 Audit\n')
md.append(f"**Records:** {summary['record_count']}  \n**Psychometric records:** {summary['psychometric_records']}  \n**Visual records:** {summary['visual_records']}  \n**Missing answer keys:** {summary['missing_answer_keys']}  \n**Exact-skeleton duplicate groups:** {summary['duplicate_groups']}\n")
md.append('## Source coverage\n')
for k,v in src_counts.items(): md.append(f'- {k}: {v}')
md.append('\n## Content-line distribution\n')
for k,v in line_counts.items(): md.append(f'- {k}: {v}')
md.append('\n## Representation distribution\n')
for k,v in rep_counts.items(): md.append(f'- {k}: {v}')
md.append('\n## Stage-1 quality rules\n')
md += [
'- This is a **reference corpus**, not a user-facing bank.',
'- Every visual item remains flagged for source-image inspection before it becomes a production blueprint.',
'- Garbled formulas are retained rather than silently corrected.',
'- Empirical difficulty is used when a P-value was extractable; otherwise only a weak position-based prior is stored.',
'- The reconstructed 2026 collection is tagged separately with lower source confidence.',
'- Duplicate detection is deliberately conservative: identical normalized skeletons are grouped, but no records are deleted yet.',
]
md.append('\n## Next Stage\nConvert audited references into atomic problem families / item grammar. Start with the highest-frequency families and visually inspect all diagram-dependent references before encoding constraints.\n')
(BASE/'STAGE1_AUDIT.md').write_text('\n'.join(md),encoding='utf-8')

print(json.dumps(summary,ensure_ascii=False,indent=2))
# per source q counts sanity
for src,c in Counter(r['source']['file'] for r in records).items(): print(src,c)
