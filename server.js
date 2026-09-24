import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import pg from 'pg';
import 'dotenv/config';

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

  console.log('✅ Таблиці бази даних готові.');
}

async function getOrCreateUser(telegramUser) {
  if (!pool || !telegramUser?.id) return null;

  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, first_name)
     VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET first_name = EXCLUDED.first_name
     RETURNING telegram_id, correct_count, wrong_count`,
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

async function recordAnswer(telegramId, isCorrect) {
  if (!pool || !telegramId) return null;

  const column = isCorrect ? 'correct_count' : 'wrong_count';
  const { rows } = await pool.query(
    `UPDATE users SET ${column} = ${column} + 1
     WHERE telegram_id = $1
     RETURNING correct_count, wrong_count`,
    [telegramId]
  );
  return rows[0] || null;
}

// ---- Теми НМТ з математики -------------------------------------------------

const TOPICS = {
  algebra: 'алгебраїчні вирази, рівняння та нерівності',
  functions: 'функції та їхні властивості (лінійна, квадратична, графіки)',
  geometry: 'планіметрія: трикутники, кола, чотирикутники, площі та периметри',
  word_problems: 'текстові задачі (рух, спільна робота, суміші, відсотки)',
  stats: 'елементи комбінаторики, теорії ймовірностей і статистики',
  progressions: 'арифметична та геометрична прогресії',
};

// ---- Промпти ----------------------------------------------------------------

function buildGeneratePrompt(topicKey, difficulty, avoidList = []) {
  const topicDesc = TOPICS[topicKey] || TOPICS.algebra;

  const avoidBlock = avoidList.length
    ? `\n\nЦі завдання користувач уже бачив — придумай щось ІНШЕ, з іншими числами й іншим сюжетом, не перефразовуй їх:\n${avoidList
        .map((q, i) => `${i + 1}. ${q}`)
        .join('\n')}`
    : '';

  return `Ти — укладач тестових завдань для НМТ (Національний мультипредметний тест) з математики в Україні.

Згенеруй ОДНЕ тестове завдання з вибором відповіді на тему: "${topicDesc}".
Рівень складності: ${difficulty} (легкий / середній / складний).

Вимоги:
- Завдання має відповідати формату та стилю реального НМТ з математики.
- Рівно 4 варіанти відповіді, лише один правильний.
- Числа мають бути "красивими" (без довгих десяткових дробів чи громіздких коренів), щоб задачу можна було розв'язати на чернетці за 1-2 хвилини.
- Формули записуй у звичайному текстовому вигляді (наприклад: x^2, sqrt(9), (a+b)/2), без LaTeX.
- Пояснення розв'язку — стисле, покрокове, українською мовою.
- Щоразу вигадуй інший сюжет і інші числа, навіть у межах однієї теми — уникай шаблонних "класичних" прикладів з підручника.${avoidBlock}

Поверни ЛИШЕ валідний JSON без жодного тексту навколо, точно в такому форматі:
{
  "question": "текст завдання",
  "options": ["варіант 1", "варіант 2", "варіант 3", "варіант 4"],
  "correct_index": 0,
  "explanation": "короткий покроковий розв'язок"
}`;
}

function buildVerifyPrompt(q) {
  return `Ти — незалежний перевіряючий. Розв'яжи це завдання з математики самостійно, з нуля, не довіряючи вказаній відповіді.

Завдання: ${q.question}
Варіанти:
0: ${q.options[0]}
1: ${q.options[1]}
2: ${q.options[2]}
3: ${q.options[3]}

Вказаний як правильний індекс: ${q.correct_index}

Розв'яжи задачу і визнач правильний індекс сам. Порівняй зі вказаним.

Поверни ЛИШЕ валідний JSON:
{
  "actual_correct_index": число,
  "is_correct": true або false,
  "note": "коротка причина розбіжності, якщо вона є, інакше порожній рядок"
}`;
}

// ---- Виклик Gemini ------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google's servers occasionally return 503 (overloaded) or 429 (rate limited).
// These are transient — retrying after a short delay usually succeeds.
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 3;
const GEMINI_TIMEOUT_MS = 25_000;

async function callGemini(prompt) {
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
            temperature: 0.7,
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
    return JSON.parse(text);
  } catch (parseErr) {
    console.warn('⚠️ Gemini повернув некоректний JSON. Повторюємо запит...');

    lastError = new Error('Gemini повернув некоректний JSON');

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
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o) => typeof o === 'string') &&
    Number.isInteger(q.correct_index) &&
    q.correct_index >= 0 &&
    q.correct_index <= 3
  );
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
  res.json(Object.entries(TOPICS).map(([key, label]) => ({ key, label })));
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
  const { initData, isCorrect } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);

    if (!telegramUser?.id) {
      return res.json({ saved: false });
    }

    await getOrCreateUser(telegramUser);

    const updated = await recordAnswer(
      telegramUser.id,
      !!isCorrect
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


// Генерує нове питання
app.post('/api/generate-question', async (req, res) => {
  const {
    topic = 'algebra',
    difficulty = 'середній',
    verify = true,
    initData,
  } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);

    const user = await getOrCreateUser(telegramUser);

    const telegramId =
      user?.telegram_id ?? null;

    const avoidList = telegramId
      ? await getRecentQuestions(
          telegramId,
          topic
        )
      : [];

    const question = await callGemini(
      buildGeneratePrompt(
        topic,
        difficulty,
        avoidList
      )
    );

    if (!isValidQuestion(question)) {
      return res.status(502).json({
        error:
          'AI повернув завдання у невірному форматі. Спробуйте ще раз.',
      });
    }

    let verified = false;

    if (verify) {
      try {
        const verification =
          await callGemini(
            buildVerifyPrompt(question)
          );

        if (
          verification.is_correct === false
        ) {
          return res.status(422).json({
            error:
              'Завдання не пройшло самоперевірку — можлива помилка в правильній відповіді. Спробуйте ще раз.',
            details: verification,
          });
        }

        verified = true;

      } catch (verifyErr) {
        console.warn(
          'Самоперевірка не вдалася, повертаємо завдання без неї:',
          verifyErr.message
        );
      }
    }

    if (telegramId) {
      await saveQuestionToHistory(
        telegramId,
        topic,
        question.question
      );
    }

    const freshUser =
      telegramUser
        ? await getOrCreateUser(
            telegramUser
          )
        : null;

    res.json({
      ...question,
      topic,
      difficulty,
      verified,

      progress: {
        correct:
          freshUser?.correct_count ?? 0,

        wrong:
          freshUser?.wrong_count ?? 0,
      },
    });

  } catch (err) {
    console.error(
      'GENERATE ERROR:',
      err
    );

    res.status(500).json({
      error:
        'Не вдалося згенерувати завдання: ' +
        err.message,
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