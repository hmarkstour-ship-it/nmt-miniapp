import crypto from 'node:crypto';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

export function sha256(value) {
  const payload = typeof value === 'string' ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function answerSignature(question) {
  if (question.type === 'choice') {
    return {
      options: question.options ?? [],
      correct_index: question.correct_index ?? null,
    };
  }
  if (question.type === 'matching') {
    return {
      left: question.left ?? [],
      match_options: question.match_options ?? [],
      correct_pairs: question.correct_pairs ?? {},
    };
  }
  return { correct_value: question.correct_value ?? null };
}

export function contentFingerprint(question) {
  return sha256({
    type: question.type,
    blueprint_id: question.blueprint_id,
    variant_key: question.variant_key,
    question: question.question,
    answer: answerSignature(question),
    diagram_svg: question.diagram_svg ?? null,
  });
}

export function skeletonFingerprint(question) {
  return sha256({
    type: question.type,
    blueprint_id: question.blueprint_id,
    variant_key: question.variant_key,
    question_skeleton: question.question_skeleton ?? question.question,
  });
}

export class BankDuplicateGuard {
  constructor({ maxPerSkeleton = 10 } = {}) {
    this.maxPerSkeleton = Math.max(1, Number(maxPerSkeleton) || 1);
    this.content = new Set();
    this.skeletonCounts = new Map();
  }

  inspect(question) {
    const contentHash = contentFingerprint(question);
    const skeletonHash = skeletonFingerprint(question);
    const skeletonCount = this.skeletonCounts.get(skeletonHash) ?? 0;
    const reasons = [];

    if (this.content.has(contentHash)) reasons.push('exact_content_duplicate');
    if (skeletonCount >= this.maxPerSkeleton) reasons.push('skeleton_quota_exceeded');

    return {
      accepted: reasons.length === 0,
      reasons,
      contentHash,
      skeletonHash,
      skeletonCount,
    };
  }

  add(question) {
    const check = this.inspect(question);
    if (!check.accepted) return check;
    this.content.add(check.contentHash);
    this.skeletonCounts.set(check.skeletonHash, check.skeletonCount + 1);
    return { ...check, skeletonCount: check.skeletonCount + 1 };
  }

  snapshot() {
    return {
      uniqueContent: this.content.size,
      uniqueSkeletons: this.skeletonCounts.size,
      skeletonCounts: Object.fromEntries(this.skeletonCounts),
    };
  }
}
