# NMT Bot — Launch Patch v1.0

Це **overlay-патч** поверх актуального `nmt-miniapp`. Він зібраний на базі останньої доступної мені Engine 4.1, тому **не видаляй свою поточну папку проєкту**. Скопіюй файли з ZIP у свій актуальний `D:\Downloads\nmt-miniapp` зі збереженням структури папок і заміною однойменних файлів.

## Що входить

- Надійніший math/KaTeX pipeline: форматування формул у питаннях, відповідях, matching та поясненнях; broken/raw math відсіюється до показу.
- Visual Engine polish: внутрішні дуги кутів будуються з геометрії променів; додаткова перевірка SVG; semantic validator продовжує ловити витік відповіді через рисунок.
- Короткі пояснення: 2–4 людські кроки + фінальна відповідь; кнопки «Пояснити простіше» і «Пояснити детальніше».
- Anti-repeat 2.0: exact item/text, skeleton, genome, blueprint і topic rotation; сервер передає до 180 останніх задач.
- «Тести» — один нескінченний mixed-stream без вибору тем і difficulty.
- Premium UI cleanup: profile streak pill, settings card, dark Telegram theme, cleaner error states, microanimations.
- Звуки + haptic: correct/wrong/finish; перемикач у профілі. Звуки генеруються Web Audio, окремих mp3-файлів немає.
- Onboarding: 3 короткі екрани, автоматично **лише при першому вході**; після Start/Skip більше сам не з'являється. Повторний перегляд — через `?` або «Як це працює».
- Mock NMT: launch-аудит збирає 5 повних варіантів по 22 питання та перевіряє слоти 1–22.
- Production debug прихований: `?debug=1` працює тільки на localhost/127.0.0.1.

## Перевірки цієї збірки

Engine audit:
- Core 41
- Visual 5
- Runtime 41
- 32 blueprints
- 1321 bank items
- 67 bank genomes
- 22/22 mock slots
- average quality 91.7

Launch audit:
- 1321/1321 concise explanations
- 474 visual items пройшли semantic + rendered-SVG validation
- 0 exact repeats у 200 training samples
- 0 immediate topic repeats
- 0 immediate skeleton repeats
- 5 mock runs × 22 questions

## Як накласти патч

1. Зроби копію своєї актуальної папки `D:\Downloads\nmt-miniapp` на випадок конфлікту.
2. Розпакуй цей ZIP.
3. Скопіюй **вміст** ZIP у `D:\Downloads\nmt-miniapp` зі збереженням структури та погодься на заміну однойменних файлів.
4. Не видаляй `.git`, `.env` та свої production secrets.
5. У CMD:

```bat
cd /d D:\Downloads\nmt-miniapp
npm install
npm run nmt:v4:audit
npm run nmt:launch:audit
git add -A
git commit -m "Launch polish v1.0"
git push origin main
```

## Перед публічним запуском

Автоматичні аудити пройдені, але реальний iPhone/Android Telegram тут фізично не емулювався. Перед релізом зроби 5-хвилинний smoke test у Telegram: одна правильна/неправильна відповідь, звук on/off, onboarding, profile, один повний/частковий mock, dark theme.

Банк у цій збірці — **1321**, не 5000+. Розширення до 5000+ залишено на post-launch контентне оновлення, щоб не набивати банк дублями шаблонів перед релізом.
