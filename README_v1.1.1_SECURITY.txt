NMT v1.1.1 — SECURITY HARDENING
================================

Що змінено
-----------
1. Telegram initData:
   - HMAC порівнюється timing-safe.
   - Перевіряється auth_date.
   - За замовчуванням сесія initData дійсна 6 годин.

2. Авторизація API:
   - training batch/single, progress, answer, profile, NMT lifecycle,
     reports, AI-help та heartbeat тепер вимагають валідного Telegram initData.
   - /api/topics лишився публічним як легкий wake/health endpoint.
   - /api/knowledge/meta більше не віддає внутрішні версії рушіїв.
   - повний meta endpoint перенесений під admin token: /api/admin/knowledge/meta.

3. Server-side grading:
   - /api/answer більше НЕ довіряє isCorrect від браузера.
   - сервер бере verified question_json із question_bank та сам визначає правильність.

4. Rate limiting:
   - IP burst shield на весь /api.
   - окремі Telegram-ID limits для heartbeat/training/answers/NMT/reports/AI.
   - AI: 8 запитів/хв і 60/год на Telegram-користувача.

5. Admin:
   - адмін-вхід тепер потребує І пароля, І Telegram ID з ADMIN_TELEGRAM_IDS.
   - IP береться через Express trust proxy / req.ip, а не з сирого X-Forwarded-For.

6. SVG/XSS:
   - regex sanitizer прибрано.
   - SVG парситься DOMParser, проходить allowlist тегів/атрибутів,
     небезпечні CSS/URL/event handlers видаляються.
   - SVG монтується у Shadow DOM, щоб CSS із SVG не витікав у сторінку.
   - це застосовано і до тренувань, і до пробного НМТ/розбору.

7. Browser/server headers:
   - X-Powered-By вимкнено.
   - CSP, nosniff, referrer policy, HSTS для HTTPS.
   - JSON body limit 256 KB.
   - frontend index.html також має CSP meta policy.

8. CORS:
   - wildcard прибраний.
   - cross-origin доступ дозволяється лише точним origin із CORS_ALLOWED_ORIGINS.

9. Question reports:
   - 3 скарги більше НЕ вимикають завдання автоматично.
   - після REPORT_REVIEW_THRESHOLD завдання отримує needs_review=true.
   - auto-quarantine вимкнений за замовчуванням; за потреби задається окремим env.

10. Supabase:
   - додано supabase_security_v1.1.1.sql для RLS + revoke anon/authenticated.

ОБОВ'ЯЗКОВІ Render Environment Variables
----------------------------------------
Залиш існуючі:
BOT_TOKEN
DATABASE_URL
GEMINI_API_KEY
ADMIN_PANEL_PASSWORD

Додай:
ADMIN_TELEGRAM_IDS=123456789
  Твій Telegram numeric ID. Для кількох адмінів: 123456789,987654321

CORS_ALLOWED_ORIGINS=https://ТВІЙ-STATIC-SITE.onrender.com
  Саме origin сторінки, яка відкривається в Telegram Mini App.
  Без кінцевого слеша. Кілька origin можна через кому.

Необов'язкові:
TELEGRAM_INITDATA_MAX_AGE_SECONDS=21600
REPORT_REVIEW_THRESHOLD=3
REPORT_AUTO_QUARANTINE_THRESHOLD=0
DB_POOL_MAX=10
DATABASE_SSL_CA_BASE64=<base64 Supabase CA certificate>

ВАЖЛИВО ПРО CORS
----------------
Frontend у цьому проєкті працює окремим Render Static Site, а API —
https://nmt-miniapp.onrender.com. Тому перед/одночасно з деплоєм ОБОВ'ЯЗКОВО
додай точний URL Static Site у CORS_ALLOWED_ORIGINS, інакше браузер правильно
заблокує запити до API.

SUPABASE RLS
------------
1. Supabase -> SQL Editor -> New query.
2. Встав увесь файл supabase_security_v1.1.1.sql.
3. Run.
4. Security Advisor має прибрати RLS Disabled in Public для цих таблиць.

SQL не створює frontend policies навмисно: Mini App не повинен читати базу
напряму. Node backend працює через DATABASE_URL.

POSTGRES TLS
------------
Код підтримує повну перевірку сертифіката через DATABASE_SSL_CA_BASE64.
Поки CA не заданий, сумісність зі старим Supabase connection string збережена,
але server log покаже warning. Для повної TLS verification завантаж Supabase
Database CA certificate, base64-кодуй його й додай в env.

ПЕРЕВІРКА ПІСЛЯ ДЕПЛОЮ
-----------------------
- Відкрити Mini App через Telegram.
- Пройти 2-3 тренувальні питання; прогрес має рахуватися.
- Запустити пробний НМТ і зберегти відповідь.
- Зайти в адмінку своїм Telegram-акаунтом.
- Перевірити, що інший Telegram ID не має адмін-доступу.
- Supabase Security Advisor: перевірити відсутність RLS Disabled in Public.
- Якщо API дає CORS error: виправити CORS_ALLOWED_ORIGINS на точний frontend URL.
