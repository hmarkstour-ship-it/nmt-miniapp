import { createSeededRandom, deriveSeed } from '../factory/seeded-rng.js';
import { auditExamDiversity } from '../integration/exam-diversity-audit.js';
import { validateExamQuestions } from '../generation/question-generator.js';
import { genomeDistance } from '../v4/genome.js';

function fam(x) { return x?.bank_meta?.family || x?.family || x?.blueprint_id || 'unknown'; }
function meta(x) { return x?.bank_meta || x || {}; }
function genome(x) { return meta(x)?.genome || x?.genome || null; }
function skeleton(x) { return meta(x)?.skeleton_hash || x?.skeleton_hash || null; }
function genomeSignature(x) { return meta(x)?.genome_signature || x?.genome_signature || null; }
function solutionPath(x) {
  const direct = meta(x)?.solution_path || x?.solution_path;
  if (direct) return String(direct);
  const path = genome(x)?.solution_path;
  return Array.isArray(path) ? path.join('>') : '';
}
function concept(x) { return genome(x)?.concept || x?.concept || ''; }
function topic(x) { return x?.topic || genome(x)?.topic || ''; }

function structural(a, b) {
  const ga = genome(a), gb = genome(b);
  return ga && gb ? 1 - genomeDistance(ga, gb) : 0;
}

function sameStructure(a, b) {
  if (!a || !b) return false;
  const sa = skeleton(a), sb = skeleton(b);
  if (sa && sb && sa === sb) return true;
  const ga = genomeSignature(a), gb = genomeSignature(b);
  if (ga && gb && ga === gb) return true;
  const pa = solutionPath(a), pb = solutionPath(b);
  if (pa && pb && pa === pb && fam(a) === fam(b)) return true;
  return structural(a, b) >= 0.90;
}

function poolFor(index, slot, disabled) {
  const direct = index.mockPool(slot.slot, slot.type).filter((x) => !disabled.has(x.id));
  return direct.length
    ? direct
    : index.items.filter((x) => !disabled.has(x.id) && x.bank_meta?.usage?.mock && x.type === slot.type && slot.blueprint_ids.includes(x.blueprint_id));
}

function buildRecentMemory(recentIds = [], recentItems = []) {
  const ids = new Set(recentIds || []);
  const skeletons = new Set();
  const genomes = new Set();
  const paths = new Set();
  const familyConcepts = new Set();
  const items = [];
  for (const item of recentItems || []) {
    if (!item) continue;
    items.push(item);
    if (item.id) ids.add(item.id);
    if (skeleton(item)) skeletons.add(skeleton(item));
    if (genomeSignature(item)) genomes.add(genomeSignature(item));
    if (solutionPath(item)) paths.add(`${fam(item)}|${solutionPath(item)}`);
    if (concept(item)) familyConcepts.add(`${fam(item)}|${concept(item)}`);
  }
  return { ids, skeletons, genomes, paths, familyConcepts, items };
}

function recentPenalty(item, recent) {
  let penalty = 0;
  if (recent.ids.has(item.id)) penalty += 260;
  if (skeleton(item) && recent.skeletons.has(skeleton(item))) penalty += 180;
  if (genomeSignature(item) && recent.genomes.has(genomeSignature(item))) penalty += 150;
  if (solutionPath(item) && recent.paths.has(`${fam(item)}|${solutionPath(item)}`)) penalty += 95;
  if (concept(item) && recent.familyConcepts.has(`${fam(item)}|${concept(item)}`)) penalty += 55;
  if (recent.items.length) {
    const maxRecentSimilarity = Math.max(0, ...recent.items.slice(0, 176).map((x) => structural(item, x)));
    if (maxRecentSimilarity >= .92) penalty += 125;
    else if (maxRecentSimilarity >= .82) penalty += 55;
  }
  return penalty;
}

function itemScore(item, { selected, recent, usage, random }) {
  const q = Number(item.bank_meta?.quality_score ?? 0);
  const n = Number(item.bank_meta?.novelty_score ?? 0);
  const familyRepeats = selected.filter((x) => fam(x) === fam(item)).length;
  const maxSim = Math.max(0, ...selected.map((x) => structural(item, x)));
  const previous = selected[selected.length - 1] || null;
  const adjacentFamily = previous && fam(previous) === fam(item) ? 1 : 0;
  const adjacentStructure = previous && sameStructure(previous, item) ? 1 : 0;
  return q * 1.15 + n * .35
    - recentPenalty(item, recent)
    - familyRepeats * 28
    - maxSim * 95
    - adjacentFamily * 55
    - adjacentStructure * 180
    - Math.min(usage.get(item.id) ?? 0, 25) * 1.6
    + random() * 8;
}

function once(index, slots, { recent, usage, seed, disabled }) {
  const random = createSeededRandom(seed);
  const entries = slots.map((slot) => ({ slot, pool: poolFor(index, slot, disabled) }));
  for (const entry of entries) if (!entry.pool.length) throw new Error(`No Engine 4 candidates for NMT slot ${entry.slot.slot}`);
  entries.sort((a, b) => a.pool.length - b.pool.length || a.slot.slot - b.slot.slot);

  const selected = [], used = new Set(), bySlot = new Map();
  for (const { slot, pool } of entries) {
    const unused = pool.filter((x) => !used.has(x.id));
    if (!unused.length) throw new Error(`Bank exhausted at slot ${slot.slot}`);

    // Prefer a genuinely new structure. If a slot is too narrow, gracefully fall back
    // to the best scored candidate instead of making the whole mock impossible.
    const fresh = unused.filter((item) => {
      if (recent.ids.has(item.id)) return false;
      if (skeleton(item) && recent.skeletons.has(skeleton(item))) return false;
      if (genomeSignature(item) && recent.genomes.has(genomeSignature(item))) return false;
      if (selected.some((chosen) => sameStructure(item, chosen))) return false;
      return true;
    });
    const candidatePool = fresh.length ? fresh : unused;
    const ranked = candidatePool
      .map((item) => ({ item, score: itemScore(item, { selected, recent, usage, random }) }))
      .sort((a, b) => b.score - a.score);
    const topWindow = Math.min(fresh.length ? 4 : 3, ranked.length);
    const chosen = ranked[Math.floor(random() * Math.max(1, topWindow))].item;
    selected.push(chosen);
    used.add(chosen.id);
    bySlot.set(slot.slot, { ...chosen, number: slot.slot, max_score: slot.max_score, runtime_source: 'offline_bank' });
  }

  const exam = [...bySlot.values()].sort((a, b) => a.number - b.number);
  validateExamQuestions(exam);
  return exam;
}

function examQ(exam, recent) {
  const diversity = auditExamDiversity(exam);
  const exactRepeats = exam.filter((q) => recent.ids.has(q.id)).length;
  const structuralRepeats = exam.filter((q) =>
    (skeleton(q) && recent.skeletons.has(skeleton(q))) ||
    (genomeSignature(q) && recent.genomes.has(genomeSignature(q))) ||
    (solutionPath(q) && recent.paths.has(`${fam(q)}|${solutionPath(q)}`))
  ).length;
  let adjacentSimilar = 0;
  for (let i = 1; i < exam.length; i += 1) {
    if (sameStructure(exam[i - 1], exam[i]) || fam(exam[i - 1]) === fam(exam[i])) adjacentSimilar += 1;
  }
  const uniqueFamilies = new Set(exam.map(fam)).size;
  const avgQ = exam.reduce((sum, x) => sum + Number(x.bank_meta?.quality_score ?? 0), 0) / exam.length;
  return {
    repeats: exactRepeats,
    structuralRepeats,
    adjacentSimilar,
    diversityIssues: diversity.issueCount,
    uniqueFamilies,
    averageQuality: Math.round(avgQ * 10) / 10,
    score: exactRepeats * 180 + structuralRepeats * 55 + adjacentSimilar * 24 + diversity.issueCount * 10 - uniqueFamilies - avgQ / 10,
  };
}

export function assembleMockExam(index, slots, {
  recentIds = [], recentItems = [], usage = new Map(), seed = Date.now(), attempts = 48, disabledIds = new Set(),
} = {}) {
  const recent = buildRecentMemory(recentIds, recentItems);
  let best = null;
  for (let i = 0; i < Math.max(1, attempts); i += 1) {
    const exam = once(index, slots, { recent, usage, seed: deriveSeed(seed, 'nmt4-antirepeat2', i), disabled: disabledIds });
    const quality = examQ(exam, recent);
    if (!best || quality.score < best.quality.score) best = { exam, quality };
    if (!quality.repeats && !quality.structuralRepeats && !quality.adjacentSimilar && !quality.diversityIssues && quality.averageQuality >= 88) break;
  }
  return best;
}
