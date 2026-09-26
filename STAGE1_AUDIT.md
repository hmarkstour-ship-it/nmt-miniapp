# NMT Reference Dataset — Stage 1 Audit

**Records:** 462  
**Psychometric records:** 44  
**Visual records:** 132  
**Missing answer keys:** 0  
**Exact-skeleton duplicate groups:** 1

## Source coverage

- 2025_mat-2.pdf: 22
- 2025_mat-1.pdf: 22
- НМТ_2026_Варіант_2_Математика_@abitdocs.pdf: 22
- НМТ_2026_Варіант_1_Математика_@abitdocs.pdf: 22
- НМТ 2026 основна сесія.pdf: 374

## Content-line distribution

- Елементи комбінаторики, теорії ймовірностей та статистики: 24
- Планіметрія: 90
- Рівняння і нерівності: 89
- Числа і вирази: 125
- Стереометрія: 63
- Функції, прогресії: 71

## Representation distribution

- chart: 15
- text: 330
- spatial_diagram: 27
- graph: 51
- geometry_diagram: 33
- scheme: 2
- table: 4

## Stage-1 quality rules

- This is a **reference corpus**, not a user-facing bank.
- Every visual item remains flagged for source-image inspection before it becomes a production blueprint.
- Garbled formulas are retained rather than silently corrected.
- Empirical difficulty is used when a P-value was extractable; otherwise only a weak position-based prior is stored.
- The reconstructed 2026 collection is tagged separately with lower source confidence.
- Duplicate detection is deliberately conservative: identical normalized skeletons are grouped, but no records are deleted yet.

## Next Stage
Convert audited references into atomic problem families / item grammar. Start with the highest-frequency families and visually inspect all diagram-dependent references before encoding constraints.
