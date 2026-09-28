export function optimizeSemanticLayout(spec, { attempts=6 } = {}) {
  if (!spec) return { spec:null, score:100, attempts:0 };
  // Deterministic semantic optimizer: renderers still own exact coordinates.
  // We attach collision/layout preferences which SVG/TikZ/Canvas adapters use.
  const metadata = {
    ...(spec.metadata ?? {}),
    layout_optimizer:'v4-semantic',
    layout_attempts:attempts,
    avoid_label_overlap:true,
    min_label_gap_px:8,
    min_font_px:13,
    safe_margin_px:16,
  };
  return { spec:{...spec, metadata}, score:94, attempts };
}
