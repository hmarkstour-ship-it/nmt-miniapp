NMT v1.0.4 — Anti-repeat + Visual/UX

Це DROP-IN patch поверх твоєї актуальної v1.0.3.
Скопіюй ВЕСЬ вміст цієї папки в:
D:\Downloads\nmt-miniapp
і погодься на заміну файлів.

Що змінено:
- Anti-repeat 2.0 для пробного НМТ: пам'ятає до 8 попередніх спроб і враховує item, skeleton, genome, solution path, concept та structural similarity.
- Розширено matching-пули 16–18: тепер це не по одному завданню; є 3 різні structural variants у кожному family.
- Банк після rebuild: 1529 verified items, 115 skeletons, 74 genome signatures.
- До завдань 16–18 у результатах є 3 окремі пояснення: для 1, 2 і 3 відповідності.
- Виправлено сумісність matching-кодів A–E / А–Д під час оцінювання.
- Visual cards переведені на темний Obsidian Gold; прибрана біла/молочна "paper" підкладка.
- SVG lines, labels, grid, accents отримали стабільний contrast у темній темі.
- Liquid Glass 2.0: dark translucent glass + blur + moving specular sheen + inner edge.
- Прибрано криву зовнішню обводку кнопок; press/selected states стали чистішими.
- Більше плавних анімацій питання/розбору/nav/buttons.
- Версія: v1.0.4.

Перевірки перед упаковкою:
- npm run nmt:launch:audit — PASS
- npm run nmt:v4:audit — PASS
- 4 послідовні mock NMT у тесті: 0 exact repeats між сусідніми тестами
- perfect grading test: 32/32
- matching explanations: 3/3 для завдань 16, 17, 18

Після копіювання:
cd /d D:\Downloads\nmt-miniapp
npm run nmt:launch:audit
npm run nmt:v4:audit
git add -A
git commit -m "NMT v1.0.4 anti-repeat visual UX"
git push origin main
