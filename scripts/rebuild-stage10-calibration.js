import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import 'dotenv/config';
import { buildCalibrationSnapshot, ANALYTICS_VERSION } from '../nmt-engine/analytics/index.js';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required for Stage 10 calibration rebuild.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  const { rows } = await pool.query(`
    SELECT event_key, telegram_id, mode, item_id, question_bank_id, attempt_id,
           question_index, topic, blueprint_id, question_type, is_correct,
           score_awarded, max_score, score_fraction, selected_index, response_ms,
           ability_proxy, model_difficulty_score, engine_version, created_at
    FROM nmt_item_events
    WHERE item_id IS NOT NULL
    ORDER BY created_at ASC
  `);

  const snapshot = buildCalibrationSnapshot(rows);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of snapshot.items) {
      await client.query(`
        INSERT INTO nmt_item_calibration (
          item_id, topic, blueprint_id, question_type, sample_count, training_count, mock_count,
          raw_p, smoothed_p, model_difficulty_score, empirical_difficulty_score,
          blended_difficulty_score, confidence, discrimination, discrimination_n,
          median_response_ms, p90_response_ms, selected_index_hist, quality_flags, status,
          analytics_version, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,$21,now()
        )
        ON CONFLICT (item_id) DO UPDATE SET
          topic=EXCLUDED.topic, blueprint_id=EXCLUDED.blueprint_id, question_type=EXCLUDED.question_type,
          sample_count=EXCLUDED.sample_count, training_count=EXCLUDED.training_count, mock_count=EXCLUDED.mock_count,
          raw_p=EXCLUDED.raw_p, smoothed_p=EXCLUDED.smoothed_p,
          model_difficulty_score=EXCLUDED.model_difficulty_score,
          empirical_difficulty_score=EXCLUDED.empirical_difficulty_score,
          blended_difficulty_score=EXCLUDED.blended_difficulty_score,
          confidence=EXCLUDED.confidence, discrimination=EXCLUDED.discrimination,
          discrimination_n=EXCLUDED.discrimination_n, median_response_ms=EXCLUDED.median_response_ms,
          p90_response_ms=EXCLUDED.p90_response_ms, selected_index_hist=EXCLUDED.selected_index_hist,
          quality_flags=EXCLUDED.quality_flags, status=EXCLUDED.status,
          analytics_version=EXCLUDED.analytics_version, updated_at=now()
      `, [
        item.item_id, item.topic, item.blueprint_id, item.question_type,
        item.sample_count, item.training_count, item.mock_count,
        item.raw_p, item.smoothed_p, item.model_difficulty_score,
        item.empirical_difficulty_score, item.blended_difficulty_score,
        item.confidence, item.discrimination, item.discrimination_n,
        item.median_response_ms, item.p90_response_ms,
        JSON.stringify(item.selected_index_hist || {}), JSON.stringify(item.quality_flags || []),
        item.status, ANALYTICS_VERSION,
      ]);
    }

    await client.query(`
      INSERT INTO nmt_calibration_runs (analytics_version, event_count, item_count, status_counts, completed_at)
      VALUES ($1,$2,$3,$4::jsonb,now())
    `, [ANALYTICS_VERSION, snapshot.event_count, snapshot.item_count, JSON.stringify(snapshot.statuses)]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const outDir = path.resolve('generated');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'nmt-stage10-calibration-latest.json');
  fs.writeFileSync(outPath, JSON.stringify({
    analytics_version: ANALYTICS_VERSION,
    generated_at: new Date().toISOString(),
    ...snapshot,
  }, null, 2));

  console.log(`Stage 10 calibration rebuilt: ${snapshot.event_count} events -> ${snapshot.item_count} items`);
  console.log(`Output: ${outPath}`);
  console.log(`Statuses: ${JSON.stringify(snapshot.statuses)}`);
} finally {
  await pool.end();
}
