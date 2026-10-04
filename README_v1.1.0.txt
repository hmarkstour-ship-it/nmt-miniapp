NMT v1.1.0 — Admin Analytics

Base: v1.0.5 Info Contrast Fix.

What changed:
- expanded the hidden admin panel with Supabase/Postgres-backed user analytics;
- stores Telegram username + last name when a user opens the Mini App again;
- user list shows name, @username, Telegram ID, training test-sessions, completed NMT attempts, answered training questions, first/last visit and online state;
- Telegram ID can be copied by tapping it;
- user search by name, @username or Telegram ID;
- 7 / 14 / 30 day period selector;
- active users in the last hour;
- active users today and within selected period;
- new users, sessions, answers, training test-sessions and completed NMT attempts for the selected period;
- daily unique-user activity chart for 7/14/30 days;
- hourly unique-user chart for the last 24 hours (Europe/Kyiv);
- auto refresh remains every 30 seconds;
- added DB indexes for activity analytics.

Training "tests":
The current Tests mode is an endless mixed training stream, not a finite quiz. For analytics, one training test-session means one Telegram Mini App activity session in which the user answered at least one training question. New answers are linked to the browser activity session exactly. Legacy answers without a session id are grouped by Kyiv calendar day as a safe fallback.

Database migration:
No manual SQL migration is required if the existing server initDb() runs normally. On boot it automatically adds:
- users.last_name
- users.username
- user_answers.activity_session_id
and the required indexes.

Important:
Existing users for whom username was never stored will show "без username" until they open the Mini App again. Telegram does not provide a way to backfill usernames only from old numeric IDs.

Version/cache-buster: 1.1.0
