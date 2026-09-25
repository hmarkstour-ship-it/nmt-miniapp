import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import pg from 'pg';
import 'dotenv/config';
import { NMT_META, getTopic, getPublicTopics } from './nmt-knowledge.js';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

if (!GEMINI_API_KEY) {
  console.warn(
    '⚠️  GEMINI_API_KEY не знайдено в .env — сервер запуститься, але /api/generate-question поверне помилку.'
  );
}
if (!DATABASE_URL) {
  console.warn(
    '⚠️  DATABASE_URL не знайдено в .env — прогрес і захист від повторів завдань працювати не будуть.'
  );
}
if (!BOT_TOKEN) {
  console.warn(
    '⚠️  BOT_TOKEN не знайдено в .env — не можемо перевірити, хто саме користувач, прогрес не зберігатиметься.'
  );
}

// ---- База даних ---------------------------------------------------------------

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDb() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      first_name TEXT,
      correct_count INT NOT NULL DEFAULT 0,
      wrong_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_history (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id),
      topic TEXT NOT NULL,
      question_text TEXT NOT NULL,
      asked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_history_user_topic
    ON question_history (telegram_id, topic, asked_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id SERIAL PRIMARY KEY,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'середній',
      question_text TEXT NOT NULL,
      question_json JSONB NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT true,
      is_active BOOLEAN NOT NULL DEFAULT true,
      use_count INT NOT NULL DEFAULT 0,
      report_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_question_bank_pick
    ON question_bank (topic, difficulty, is_active, use_count);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_unique_text
    ON question_bank (topic, question_text);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_answers (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id),
      topic TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL,
      question_bank_id INT REFERENCES question_bank(id) ON DELETE SET NULL,
      answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_answers_profile
    ON user_answers (telegram_id, answered_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_reports (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT REFERENCES users(telegram_id),
      question_bank_id INT REFERENCES question_bank(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      question_snapshot JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_question_reports_one_per_user
    ON question_reports (telegram_id, question_bank_id)
    WHERE question_bank_id IS NOT NULL;
  `);

  console.log('✅ Таблиці бази даних готові.');
}

async function getOrCreateUser(telegramUser) {
  if (!pool || !telegramUser?.id) return null;

  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, first_name)
     VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET first_name = EXCLUDED.first_name
     RETURNING telegram_id, first_name, correct_count, wrong_count, created_at`,
    [telegramUser.id, telegramUser.first_name || null]
  );
  return rows[0];
}

async function getRecentQuestions(telegramId, topic, limit = 12) {
  if (!pool || !telegramId) return [];

  const { rows } = await pool.query(
    `SELECT question_text FROM question_history
     WHERE telegram_id = $1 AND topic = $2
     ORDER BY asked_at DESC
     LIMIT $3`,
    [telegramId, topic, limit]
  );
  return rows.map((r) => r.question_text);
}

async function saveQuestionToHistory(telegramId, topic, questionText) {
  if (!pool || !telegramId) return;
  await pool.query(
    `INSERT INTO question_history (telegram_id, topic, question_text) VALUES ($1, $2, $3)`,
    [telegramId, topic, questionText]
  );
}

async function recordAnswer(telegramId, isCorrect, topic = 'mixed', questionBankId = null) {
  if (!pool || !telegramId) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const column = isCorrect ? 'correct_count' : 'wrong_count';
    const { rows } = await client.query(
      `UPDATE users SET ${column} = ${column} + 1
       WHERE telegram_id = $1
       RETURNING correct_count, wrong_count`,
      [telegramId]
    );

    await client.query(
      `INSERT INTO user_answers (telegram_id, topic, is_correct, question_bank_id)
       VALUES ($1, $2, $3, $4)`,
      [telegramId, topic || 'mixed', !!isCorrect, questionBankId || null]
    );

    await client.query('COMMIT');
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getQuestionFromBank(topic, difficulty, avoidList = []) {
  if (!pool) return null;

  const { rows } = await pool.query(
    `SELECT id, question_json
     FROM question_bank
     WHERE topic = $1
       AND difficulty = $2
       AND is_active = true
       AND verified = true
       AND NOT ((question_json->>'question') = ANY($3::text[]))
     ORDER BY use_count ASC, random()
     LIMIT 1`,
    [topic, difficulty, avoidList]
  );

  const row = rows[0];
  if (!row) return null;

  await pool.query(
    `UPDATE question_bank
     SET use_count = use_count + 1, last_used_at = now()
     WHERE id = $1`,
    [row.id]
  );

  return { id: row.id, question: row.question_json };
}

async function saveQuestionToBank(topic, difficulty, question) {
  if (!pool || !question?.question) return null;

  const { rows } = await pool.query(
    `INSERT INTO question_bank (topic, difficulty, question_text, question_json, verified)
     VALUES ($1, $2, $3, $4::jsonb, true)
     ON CONFLICT (topic, question_text)
     DO UPDATE SET question_json = EXCLUDED.question_json, verified = true, is_active = true
     RETURNING id`,
    [topic, difficulty, question.question, JSON.stringify(question)]
  );

  return rows[0]?.id ?? null;
}

async function getProfileData(telegramId) {
  if (!pool || !telegramId) return null;

  const userResult = await pool.query(
    `SELECT telegram_id, first_name, correct_count, wrong_count, created_at
     FROM users WHERE telegram_id = $1`,
    [telegramId]
  );

  const user = userResult.rows[0];
  if (!user) return null;

  const statsResult = await pool.query(
    `SELECT topic, COUNT(*)::int AS total,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct
     FROM user_answers
     WHERE telegram_id = $1
     GROUP BY topic
     ORDER BY total DESC`,
    [telegramId]
  );

  return { user, topicStats: statsResult.rows };
}

// ---- Промпти ----------------------------------------------------------------

function buildGeneratePrompt(topicKey, difficulty, avoidList = []) {
  const topic = getTopic(topicKey);

  const avoidBlock = avoidList.length
    ? `

Користувач уже бачив ці завдання. НЕ копіюй їх, НЕ перефразовуй і НЕ роби ту саму задачу з іншими числами:
${avoidList
        .map((q, i) => `${i + 1}. ${q}`)
        .join('\n')}`
    : '';

  return `Ти — укладач тренувальних завдань для НМТ-${NMT_META.year} з математики в Україні.

ОФІЦІЙНА РАМКА:
- НМТ-${NMT_META.year} з математики базується на чинній програмі ЗНО з математики.
- Офіційні великі розділи: ${NMT_META.officialSections.join('; ')}.
- У реальному НМТ є 22 завдання. Поточний режим застосунку тренує формат "одна правильна відповідь із п'яти варіантів".
- Не виходь за межі шкільної програми НМТ. Не використовуй університетську математику, олімпіадні трюки або матеріал, якого немає в програмі.

ОБРАНА ТЕМА: ${topic.label}
Межі теми: ${topic.scope}.

Дозволені навички для цієї теми:
${topic.skills.map((x) => `- ${x}`).join('\n')}

Типові ПАТЕРНИ завдань, на які можна орієнтуватися:
${topic.patterns.map((x) => `- ${x}`).join('\n')}

РІВЕНЬ СКЛАДНОСТІ: ${difficulty}.

Згенеруй ОДНЕ нове тренувальне завдання в стилі НМТ.

ЖОРСТКІ ВИМОГИ:
- Рівно 5 варіантів відповіді.
- Лише один варіант правильний.
- Завдання має однозначно належати до обраної теми.
- Правильна відповідь повинна точно бути серед 5 варіантів.
- Неправильні варіанти мають бути правдоподібними результатами типових учнівських помилок, а не випадковими числами.
- Не копіюй дослівно реальні завдання УЦОЯО та не відтворюй їх з мінімальними змінами.
- Завдання має бути реально розв'язати приблизно за 1-3 хвилини на чернетці.
- Уникай невиправдано громіздких обчислень і довгих десяткових дробів.
- УСЮ математику оформлюй у LaTeX і завжди бери математичний вираз у delimiters \\( ... \\) для рядкового запису або \\[ ... \\] для окремого великого виразу.
- ВАЖЛИВО ДЛЯ JSON: кожен backslash у LaTeX ОБОВ'ЯЗКОВО екрануй ще одним backslash. Наприклад, у сирому JSON правильно: "Обчисліть \\\\(\\\\sqrt{9}\\\\)". Не повертай одинарні backslash усередині JSON-рядків.
- НІКОЛИ не показуй учневі програмістський запис на кшталт sqrt(9), x^2, a/b, *, <=, >=, log_2(8).
- Використовуй нормальний шкільний математичний вигляд: \\(\\sqrt{9}\\), \\(x^{2}\\), \\(\\frac{a}{b}\\), \\(a \\cdot b\\), \\(x \\le 5\\), \\(\\log_{2} 8\\).
- КОЖНА формула повинна мати повну пару delimiters. Заборонено повертати сирий LaTeX на кшталт \\frac{1}{2}, \\sqrt{5}, \\left(...\\right) без \\( ... \\) або \\[ ... \\].
- Не починай формулу зі звичайної дужки перед LaTeX-командою. Правильно: \\(\\left(\\frac{5}{6}-\\frac{3}{4}\\right)\\cdot 24\\). Неправильно: (\\left(\\frac{5}{6}... ).
- У видимому українському тексті десятковий роздільник записуй комою: 2,5; 0,75. Крапку використовуй лише там, де це не десятковий дріб.
- Звичайний текст пиши українською, а формули — LaTeX усередині \\( ... \\).
- У поясненні дай коротке, правильне, покрокове розв'язання українською мовою з таким самим акуратним математичним оформленням. Розбий пояснення на 2-5 чітких кроків і починай кожен крок з 1., 2., 3. тощо.
- Для тем, де потрібна схема/рисунок, сформулюй задачу так, щоб її можна було однозначно розв'язати БЕЗ зображення.
${avoidBlock}

Поверни ЛИШЕ валідний JSON без markdown і без тексту навколо:
{
  "question": "текст завдання",
  "options": ["варіант 1", "варіант 2", "варіант 3", "варіант 4", "варіант 5"],
  "correct_index": 0,
  "explanation": "короткий покроковий розв'язок"
}`;
}

function buildVerifyPrompt(q, topicKey) {
  const topic = getTopic(topicKey);
  const options = q.options.map((option, index) => `${index}: ${option}`).join('\n');

  return `Ти — незалежний редактор і перевіряючий завдань НМТ з математики.

ОБРАНА ТЕМА: ${topic.label}
Допустимі навички:
${topic.skills.map((x) => `- ${x}`).join('\n')}

Завдання:
${q.question}

Варіанти:
${options}

Автор позначив правильним індекс: ${q.correct_index}

Зроби чотири перевірки:
1. Самостійно розв'яжи завдання та визнач фактичний правильний індекс.
2. Перевір, чи завдання справді відповідає обраній темі.
3. Перевір, чи воно відповідає шкільному рівню та рамкам НМТ, а не виходить у університетську/олімпіадну математику.
4. Перевір математичне оформлення: учень не повинен бачити сирі записи sqrt(...), x^2, a/b, *, <=, >= або іншу програмістську нотацію. Формули мають бути коректним LaTeX у \\( ... \\) або \\[ ... \\].

Поверни ЛИШЕ валідний JSON:
{
  "actual_correct_index": 0,
  "is_correct": true,
  "topic_match": true,
  "is_nmt_appropriate": true,
  "math_format_ok": true,
  "note": "коротка причина, якщо є проблема; інакше порожній рядок"
}`;
}


function buildExtraHelpPrompt(mode, payload) {
  const options = Array.isArray(payload.options)
    ? payload.options.map((x, i) => `${i}: ${x}`).join('\n')
    : '';

  const modeInstruction = mode === 'why_wrong'
    ? `Учень обрав варіант ${payload.selected_index}. Поясни конкретно, чому цей варіант неправильний, де найімовірніше сталася помилка, і покажи правильний шлях.`
    : `Поясни це завдання максимально просто, ніби учень знає тему слабко. Не перескакуй через кроки.`;

  return `Ти — уважний репетитор НМТ з математики.

Завдання: ${payload.question}
Варіанти:
${options}
Правильний індекс: ${payload.correct_index}

${modeInstruction}

Правила:
- Не змінюй умову та правильну відповідь.
- Пиши українською.
- Математику оформлюй LaTeX у \\( ... \\) або \\[ ... \\].
- Дай 2-5 коротких послідовних кроків.
- Не використовуй зайву теорію.

Поверни ЛИШЕ JSON:
{
  "title": "короткий заголовок",
  "steps": ["крок 1", "крок 2", "крок 3"]
}`;
}

function buildSimilarPrompt(topicKey, difficulty, originalQuestion) {
  return `${buildGeneratePrompt(topicKey, difficulty, [originalQuestion.question])}

ДОДАТКОВА ВИМОГА:
Створи завдання на ТУ САМУ навичку й приблизно таку саму складність, що й це завдання, але з іншими числами/умовою та без копіювання формулювання:
${originalQuestion.question}`;
}

// ---- Виклик Gemini ------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google's servers occasionally return 503 (overloaded) or 429 (rate limited).
// These are transient — retrying after a short delay usually succeeds.
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 3;
const GEMINI_TIMEOUT_MS = 25_000;


function stripJsonCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

// Gemini інколи повертає математичний LaTeX у JSON з одинарними backslash:
// "\\(\\frac{1}{2}\\)" замість JSON-safe "\\\\(\\\\frac{1}{2}\\\\)".
// Через це звичайний JSON.parse падає (а \\frac ще й може трактуватися як JSON escape \\f).
// Ця функція акуратно екранує лише НЕекрановані backslash усередині JSON-рядків.
function repairJsonBackslashes(raw) {
  const text = stripJsonCodeFence(raw);
  let out = '';
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (ch === '"') {
      // Quote closes the JSON string only if it is not escaped.
      let slashCount = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) slashCount++;
      out += ch;
      if (slashCount % 2 === 0) inString = false;
      continue;
    }

    if (ch !== '\\') {
      out += ch;
      continue;
    }

    const next = text[i + 1];
    const afterNext = text[i + 2];

    // Already JSON-escaped backslash/quote/slash: keep the pair unchanged.
    if (next === '\\' || next === '"' || next === '/') {
      out += ch + next;
      i++;
      continue;
    }

    // Valid Unicode JSON escape: \\uXXXX.
    if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
      out += text.slice(i, i + 6);
      i += 5;
      continue;
    }

    // Preserve genuine JSON control escapes only when they are standalone.
    // If a letter follows (\\frac, \\right, \\times, \\neq...), it is LaTeX.
    if ('bfnrt'.includes(next) && !/[A-Za-z]/.test(afterNext || '')) {
      out += ch + next;
      i++;
      continue;
    }

    // Everything else is treated as a literal LaTeX backslash and escaped for JSON.
    out += '\\\\';
  }

  return out;
}

function parseGeminiJson(raw) {
  const clean = stripJsonCodeFence(raw);

  try {
    return JSON.parse(clean);
  } catch (firstError) {
    const repaired = repairJsonBackslashes(clean);
    try {
      const parsed = JSON.parse(repaired);
      console.warn('⚠️ Gemini JSON автоматично виправлено (LaTeX backslash escaping).');
      return parsed;
    } catch (secondError) {
      const err = new Error(`Gemini повернув некоректний JSON: ${secondError.message}`);
      err.rawPreview = clean.slice(0, 500);
      throw err;
    }
  }
}

async function callGemini(prompt, temperature = 0.5) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY не налаштовано на сервері');
  }

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature,
          },
        }),
      });

      if (response.ok) {
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini повернув порожню відповідь');
  }

  try {
    return parseGeminiJson(text);
  } catch (parseErr) {
    console.warn('⚠️ Gemini повернув некоректний JSON. Повторюємо запит...');

    console.warn('JSON parse detail:', parseErr.message);
    if (parseErr.rawPreview) console.warn('JSON preview:', parseErr.rawPreview);

    lastError = parseErr;

    if (attempt < MAX_RETRIES) {
      const delayMs = 800 * Math.pow(2, attempt);
      await sleep(delayMs);
      continue;
    }

    throw lastError;
  }
}

      const errText = await response.text();
      lastError = new Error(`Gemini API помилка ${response.status}: ${errText}`);

      if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
        const delayMs = 800 * Math.pow(2, attempt); // 800ms, 1.6s, 3.2s
        console.warn(`Gemini ${response.status}, повтор через ${delayMs}мс (спроба ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delayMs);
        continue;
      }

      throw lastError;
    } catch (err) {
      if (err.name === 'AbortError') {
        lastError = new Error('Gemini не відповів за 25 секунд (тайм-аут)');
        if (attempt < MAX_RETRIES) {
          console.warn(`Тайм-аут, повтор (спроба ${attempt + 1}/${MAX_RETRIES})`);
          continue;
        }
        throw lastError;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function isValidQuestion(q) {
  return (
    q &&
    typeof q.question === 'string' &&
    q.question.trim().length > 0 &&
    Array.isArray(q.options) &&
    q.options.length === 5 &&
    q.options.every((o) => typeof o === 'string' && o.trim().length > 0) &&
    new Set(q.options.map((o) => o.trim())).size === 5 &&
    Number.isInteger(q.correct_index) &&
    q.correct_index >= 0 &&
    q.correct_index <= 4 &&
    typeof q.explanation === 'string' &&
    q.explanation.trim().length > 0
  );
}


// ---- Нормалізація математичного запису ---------------------------------------
// Страховка на випадок, якщо модель інколи поверне старий текстовий формат.
// Основний формат — LaTeX у \( ... \) / \[ ... \], а ці перетворення ловлять
// найтиповіші записи на кшталт sqrt(9), log_2(8), (a+b)/2 тощо.

function normalizeLegacyMathNotation(value) {
  if (typeof value !== 'string') return value;

  let text = value;

  // sqrt(25) -> \(\sqrt{25}\)
  text = text.replace(/(?<!\\)sqrt\(([^()]+)\)/gi, (_, inside) =>
    `\\(\\sqrt{${inside}}\\)`
  );

  // log_2(8) -> \(\log_{2}\left(8\right)\)
  text = text.replace(/(?<!\\)log_([0-9a-zA-Z]+)\(([^()]+)\)/g, (_, base, inside) =>
    `\\(\\log_{${base}}\\left(${inside}\\right)\\)`
  );

  // (a+b)/2 -> \(\frac{a+b}{2}\)
  text = text.replace(/\(([^()]+)\)\s*\/\s*([0-9a-zA-Z]+)/g, (_, numerator, denominator) =>
    `\\(\\frac{${numerator}}{${denominator}}\\)`
  );

  // 3/4 або a/b -> \(\frac{3}{4}\)
  text = text.replace(/\b([0-9a-zA-Z]+)\s*\/\s*([0-9a-zA-Z]+)\b/g, (_, numerator, denominator) =>
    `\\(\\frac{${numerator}}{${denominator}}\\)`
  );

  // x^2 -> \(x^{2}\) (для простих legacy-випадків)
  text = text.replace(/\b([a-zA-Z0-9]+)\^(-?[0-9]+)\b/g, (_, base, exponent) =>
    `\\(${base}^{${exponent}}\\)`
  );

  // Зрозумілі символи навіть якщо це не було оформлено як LaTeX.
  text = text
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/\s\*\s/g, ' · ')
    .replace(/\bpi\b/gi, 'π');

  return text;
}

function normalizeQuestionMath(question) {
  if (!question || typeof question !== 'object') return question;

  return {
    ...question,
    question: normalizeLegacyMathNotation(question.question),
    options: Array.isArray(question.options)
      ? question.options.map(normalizeLegacyMathNotation)
      : question.options,
    explanation: normalizeLegacyMathNotation(question.explanation),
  };
}


// ---- Контроль математичного форматування -------------------------------------
// KaTeX рендерить лише формули в явних delimiters. Якщо модель повернула
// сирий LaTeX (наприклад, \\frac без \\( ... \\)), таке завдання не показуємо
// учневі — генеруємо інше.

function stripDelimitedMath(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ');
}

function hasUnsafeRawMath(value) {
  if (typeof value !== 'string') return false;

  const outsideMath = stripDelimitedMath(value);

  const rawLatexCommand = /\\(?:frac|dfrac|tfrac|sqrt|left|right|cdot|times|div|log|ln|sin|cos|tan|cot|le|ge|neq|approx|pi|infty|sum|prod|overline|vec|begin|end)\b/;
  const legacyNotation = /\bsqrt\s*\(|\blog_[A-Za-z0-9]+\s*\(|(?:[A-Za-z0-9)}\]])\s*\^\s*(?:\{|[-+]?\d)/;

  return rawLatexCommand.test(outsideMath) || legacyNotation.test(outsideMath);
}

function hasSafeQuestionMath(question) {
  if (!question || typeof question !== 'object') return false;

  const fields = [
    question.question,
    ...(Array.isArray(question.options) ? question.options : []),
    question.explanation,
  ];

  return fields.every((value) => !hasUnsafeRawMath(value));
}

// ---- Перевірка Telegram initData -----------------------------------
// Документація: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  const userJson = params.get('user');
  return userJson ? JSON.parse(userJson) : null;
}

// ---- Роути --------------------------------------------------------------------

app.get('/api/topics', (req, res) => {
  res.json(getPublicTopics());
});

// Повертає збережений прогрес користувача
app.post('/api/progress', async (req, res) => {
  const { initData } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    const user = await getOrCreateUser(telegramUser);

    res.json({
      correct: user?.correct_count ?? 0,
      wrong: user?.wrong_count ?? 0,
      persistent: !!user,
    });
  } catch (err) {
    console.error('PROGRESS ERROR:', err);

    res.status(500).json({
      correct: 0,
      wrong: 0,
      persistent: false,
    });
  }
});


// Записує відповідь користувача
app.post('/api/answer', async (req, res) => {
  const { initData, isCorrect, topic = 'mixed', questionBankId = null } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);

    if (!telegramUser?.id) {
      return res.json({ saved: false });
    }

    await getOrCreateUser(telegramUser);

    const updated = await recordAnswer(
      telegramUser.id,
      !!isCorrect,
      topic,
      Number.isInteger(Number(questionBankId)) ? Number(questionBankId) : null
    );

    res.json({
      saved: !!updated,
      ...updated,
    });

  } catch (err) {
    console.error('ANSWER ERROR:', err);

    res.status(500).json({
      saved: false
    });
  }
});


// Профіль користувача та статистика по темах
app.post('/api/profile', async (req, res) => {
  const { initData } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });

    await getOrCreateUser(telegramUser);
    const profile = await getProfileData(telegramUser.id);
    if (!profile) return res.status(404).json({ error: 'Профіль не знайдено.' });

    const correct = Number(profile.user.correct_count) || 0;
    const wrong = Number(profile.user.wrong_count) || 0;
    const total = correct + wrong;

    const topicStats = profile.topicStats.map((row) => {
      const rowTotal = Number(row.total) || 0;
      const rowCorrect = Number(row.correct) || 0;
      return {
        topic: row.topic,
        label: getTopic(row.topic)?.label || row.topic,
        total: rowTotal,
        correct: rowCorrect,
        accuracy: rowTotal ? Math.round((rowCorrect / rowTotal) * 100) : 0,
      };
    });

    res.json({
      first_name: profile.user.first_name || telegramUser.first_name || 'Учень',
      correct,
      wrong,
      total,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      created_at: profile.user.created_at,
      topic_stats: topicStats,
    });
  } catch (err) {
    console.error('PROFILE ERROR:', err);
    res.status(500).json({ error: 'Не вдалося завантажити профіль.' });
  }
});

// Скарга на некоректне/незрозуміле завдання
app.post('/api/report-question', async (req, res) => {
  const { initData, questionBankId = null, reason = 'Інше', question = null } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });
    await getOrCreateUser(telegramUser);

    const bankId = Number(questionBankId);
    const validBankId = Number.isInteger(bankId) && bankId > 0 ? bankId : null;

    let inserted = true;

    if (pool) {
      const reportResult = await pool.query(
        validBankId
          ? `INSERT INTO question_reports (telegram_id, question_bank_id, reason, question_snapshot)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (telegram_id, question_bank_id) WHERE question_bank_id IS NOT NULL DO NOTHING
             RETURNING id`
          : `INSERT INTO question_reports (telegram_id, question_bank_id, reason, question_snapshot)
             VALUES ($1, $2, $3, $4::jsonb)
             RETURNING id`,
        [telegramUser.id, validBankId, String(reason).slice(0, 120), JSON.stringify(question || null)]
      );
      inserted = reportResult.rowCount > 0;
    }

    if (pool && validBankId && inserted) {
      const { rows } = await pool.query(
        `UPDATE question_bank
         SET report_count = report_count + 1
         WHERE id = $1
         RETURNING report_count`,
        [validBankId]
      );

      if ((rows[0]?.report_count || 0) >= 3) {
        await pool.query(`UPDATE question_bank SET is_active = false WHERE id = $1`, [validBankId]);
      }
    }

    res.json({ saved: true, duplicate: !inserted });
  } catch (err) {
    console.error('REPORT ERROR:', err);
    res.status(500).json({ saved: false, error: 'Не вдалося надіслати скаргу.' });
  }
});

// Додаткова AI-допомога після відповіді
app.post('/api/explain-more', async (req, res) => {
  const { initData, mode = 'simple', topic = 'mixed', difficulty = 'середній', question } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });
    if (!question?.question || !Array.isArray(question.options)) return res.status(400).json({ error: 'Немає даних завдання.' });

    if (mode === 'similar') {
      let similar = null;
      let verified = false;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const raw = await callGemini(buildSimilarPrompt(topic, difficulty, question), 0.45);
        const candidate = normalizeQuestionMath(raw);
        if (!isValidQuestion(candidate) || !hasSafeQuestionMath(candidate)) continue;

        try {
          const check = await callGemini(buildVerifyPrompt(candidate, topic), 0.1);
          const actualIndex = Number(check.actual_correct_index);
          if (
            check.is_correct === true &&
            Number.isInteger(actualIndex) &&
            actualIndex === candidate.correct_index &&
            check.topic_match === true &&
            check.is_nmt_appropriate === true
          ) {
            similar = candidate;
            verified = true;
            break;
          }
        } catch (verifyErr) {
          console.warn('SIMILAR VERIFY ERROR:', verifyErr.message);
        }
      }

      if (!similar) return res.status(502).json({ error: 'Не вдалося створити схоже завдання. Спробуйте ще раз.' });

      let bankId = null;
      if (verified) bankId = await saveQuestionToBank(topic, difficulty, similar);
      await saveQuestionToHistory(telegramUser.id, topic, similar.question);

      return res.json({ mode: 'similar', question: { ...similar, topic, difficulty, verified, bank_id: bankId, source: 'ai' } });
    }

    if (!['simple', 'why_wrong'].includes(mode)) return res.status(400).json({ error: 'Невідомий режим пояснення.' });

    const help = await callGemini(buildExtraHelpPrompt(mode, question), 0.25);
    const steps = Array.isArray(help.steps) ? help.steps.filter((x) => typeof x === 'string' && x.trim()) : [];
    if (!steps.length) return res.status(502).json({ error: 'AI не повернув пояснення.' });

    res.json({ title: help.title || 'Пояснення', steps: steps.slice(0, 6) });
  } catch (err) {
    console.error('EXPLAIN MORE ERROR:', err);
    res.status(500).json({ error: 'Не вдалося отримати додаткове пояснення.' });
  }
});


// Генерує нове питання
app.post('/api/generate-question', async (req, res) => {
  const {
    topic = 'mixed',
    difficulty = 'середній',
    verify = true,
    initData,
    forceFresh = false,
  } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    const user = await getOrCreateUser(telegramUser);
    const telegramId = user?.telegram_id ?? null;

    const avoidList = telegramId
      ? await getRecentQuestions(telegramId, topic)
      : [];

    let question = null;
    let verified = false;
    let bankId = null;
    let source = 'ai';

    // Спочатку намагаємося віддати вже перевірене завдання з банку.
    // forceFresh використовується для явної перегенерації користувачем.
    if (!forceFresh) {
      const bankQuestion = await getQuestionFromBank(topic, difficulty, avoidList);
      if (bankQuestion?.question && isValidQuestion(bankQuestion.question) && hasSafeQuestionMath(bankQuestion.question)) {
        question = bankQuestion.question;
        verified = true;
        bankId = bankQuestion.id;
        source = 'bank';
      }
    }

    if (!question) {
      const maxQuestionAttempts = verify ? 4 : 3;

      for (let generationAttempt = 1; generationAttempt <= maxQuestionAttempts; generationAttempt++) {
        const rawQuestion = await callGemini(
          buildGeneratePrompt(topic, difficulty, avoidList),
          0.5
        );

        const candidate = normalizeQuestionMath(rawQuestion);

        if (!isValidQuestion(candidate)) {
          console.warn(`⚠️ Generation ${generationAttempt}: невірна JSON-структура завдання`);
          continue;
        }

        if (!hasSafeQuestionMath(candidate)) {
          console.warn(`⚠️ Generation ${generationAttempt}: некоректне математичне оформлення, генеруємо заново`);
          continue;
        }

        if (!verify) {
          question = candidate;
          break;
        }

        try {
          const verification = await callGemini(
            buildVerifyPrompt(candidate, topic),
            0.1
          );

          const actualIndex = Number(verification.actual_correct_index);
          const verificationFailed =
            verification.is_correct !== true ||
            !Number.isInteger(actualIndex) ||
            actualIndex !== candidate.correct_index ||
            verification.topic_match !== true ||
            verification.is_nmt_appropriate !== true;

          if (verificationFailed) {
            console.warn(`⚠️ Verification ${generationAttempt}: кандидат відхилено, генеруємо новий.`, {
              expected: candidate.correct_index,
              actual: verification.actual_correct_index,
              note: verification.note,
            });
            continue;
          }

          question = candidate;
          verified = true;
          break;
        } catch (verifyErr) {
          console.warn(`⚠️ Verification ${generationAttempt}: технічна помилка:`, verifyErr.message);
          question = candidate;
          verified = false;
          break;
        }
      }

      if (question && verified) {
        bankId = await saveQuestionToBank(topic, difficulty, question);
      }
    }

    if (!question) {
      return res.status(502).json({
        error: 'Не вдалося підібрати коректне завдання після кількох спроб. Натисніть «Спробувати ще раз».',
      });
    }

    if (telegramId) {
      await saveQuestionToHistory(telegramId, topic, question.question);
    }

    const freshUser = telegramUser ? await getOrCreateUser(telegramUser) : null;

    res.json({
      ...question,
      topic,
      difficulty,
      verified,
      bank_id: bankId,
      source,
      progress: {
        correct: freshUser?.correct_count ?? 0,
        wrong: freshUser?.wrong_count ?? 0,
      },
    });
  } catch (err) {
    console.error('GENERATE ERROR:', err);

    res.status(500).json({
      error: 'Не вдалося згенерувати завдання: ' + err.message,
    });
  }
});

app.use(
  express.static('public', {
    etag: false,
    lastModified: false,
    maxAge: 0,

    setHeaders: (res) => {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
    },
  })
);


app.listen(PORT, async () => {
  console.log(
    `✅ Сервер запущено: http://localhost:${PORT}`
  );

  console.log(
    '   Для Telegram Mini App потрібен публічний HTTPS-URL.'
  );

  try {
    await initDb();

  } catch (err) {
    console.error(
      '❌ Не вдалося ініціалізувати базу даних:',
      err.message
    );
  }
});