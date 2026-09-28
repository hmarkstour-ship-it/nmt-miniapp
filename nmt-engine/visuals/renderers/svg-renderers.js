const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

function shell(inner, aria = 'Математична схема', viewBox = '0 0 440 290') {
  return `<svg viewBox="${viewBox}" role="img" aria-label="${esc(aria)}" xmlns="http://www.w3.org/2000/svg"><defs><style>.g{stroke:currentColor;stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round}.d{stroke:#777;stroke-width:1.7;fill:none;stroke-dasharray:6 6}.a{stroke:#9b6b1d;stroke-width:2.5;fill:none}.fill{fill:rgba(155,107,29,.08);stroke:#9b6b1d;stroke-width:1.5}.t{font:700 15px system-ui,sans-serif;fill:currentColor}.m{font:600 13px system-ui,sans-serif;fill:currentColor}.s{font:500 11px system-ui,sans-serif;fill:#777}.grid{stroke:#aaa;stroke-opacity:.22;stroke-width:1}</style></defs>${inner}</svg>`;
}

export function renderBarChart(spec) {
  const values = spec.data.values ?? [];
  const labels = spec.labels.categories ?? values.map((_, i) => String(i + 1));
  const max = Math.max(1, ...values);
  let grid = '';
  for (let i = 0; i <= 4; i += 1) {
    const y = 220 - i * 42;
    grid += `<path class="grid" d="M48 ${y}H410"/>`;
  }
  const step = 320 / Math.max(1, values.length);
  const bars = values.map((value, index) => {
    const height = 150 * value / max;
    const x = 65 + index * step;
    const y = 220 - height;
    return `<rect class="fill" x="${x}" y="${y}" width="${Math.min(44, step - 12)}" height="${height}" rx="4"/><text class="m" x="${x + Math.min(44, step - 12)/2}" y="${y - 8}" text-anchor="middle">${esc(value)}</text><text class="s" x="${x + Math.min(44, step - 12)/2}" y="244" text-anchor="middle">${esc(labels[index])}</text>`;
  }).join('');
  return shell(`${grid}<path class="g" d="M48 220H410 M48 45V220"/>${bars}`, 'Стовпчаста діаграма');
}

export function renderFunctionGraph(spec) {
  const { kind = 'parabola', h = 0, k = 0, slope = 1, intercept = 0, xMin = -5, xMax = 5 } = spec.data;
  const width = 440, height = 290, ox = 220, oy = 145, sx = 34, sy = 24;
  let grid = '';
  for (let x = 50; x <= 390; x += 34) grid += `<path class="grid" d="M${x} 30V260"/>`;
  for (let y = 49; y <= 241; y += 24) grid += `<path class="grid" d="M40 ${y}H405"/>`;
  const fn = kind === 'line' ? (x) => slope * x + intercept : (x) => (x - h) ** 2 + k;
  const points = [];
  for (let x = xMin; x <= xMax; x += 0.12) {
    const y = fn(x);
    if (Number.isFinite(y) && Math.abs(y) < 10) points.push(`${(ox + x*sx).toFixed(1)},${(oy - y*sy).toFixed(1)}`);
  }
  return shell(`${grid}<path class="g" d="M40 ${oy}H410 M${ox} 25V265"/><polyline class="a" points="${points.join(' ')}"/><text class="m" x="412" y="${oy-7}">x</text><text class="m" x="${ox+8}" y="30">y</text>`, 'Графік функції');
}

export function renderTrapezoid(spec) {
  const { top = 8, bottom = 14, height = 6, angle = null } = spec.data;
  return shell(`<path class="g" d="M62 225L378 225L322 66L118 66Z"/><path class="d" d="M118 66V225"/><path class="g" d="M118 207h18v18"/><text class="t" x="48" y="248">A</text><text class="t" x="382" y="248">D</text><text class="t" x="108" y="55">B</text><text class="t" x="326" y="55">C</text><text class="m" x="208" y="252">${esc(bottom)}</text><text class="m" x="208" y="55">${esc(top)}</text><text class="m" x="130" y="150">${esc(height)}</text>${angle != null ? `<path class="a" d="M335 225 A40 40 0 0 0 349 190"/><text class="m" x="315" y="185">${esc(angle)}°</text>` : ''}`, 'Трапеція');
}

export function renderTriangleSides(spec) {
  const { left = 5, right = 7, base = 8, angle = null } = spec.data;
  return shell(`<path class="g" d="M62 225L378 225L155 52Z"/><text class="t" x="48" y="248">A</text><text class="t" x="382" y="248">B</text><text class="t" x="147" y="43">C</text><text class="m" x="210" y="250">${esc(base)}</text><text class="m" x="92" y="135">${esc(left)}</text><text class="m" x="282" y="135">${esc(right)}</text>${angle != null ? `<path class="a" d="M94 225 A34 34 0 0 0 83 199"/><text class="m" x="94" y="194">${esc(angle)}°</text>` : ''}`, 'Трикутник');
}

export function renderCircleAngle(spec) {
  const { central = 100 } = spec.data;
  return shell(`<circle class="g" cx="220" cy="145" r="100"/><circle cx="220" cy="145" r="4" fill="currentColor"/><path class="g" d="M220 145L220 45 M220 145L307 195 M220 45L133 195L307 195"/><path class="a" d="M220 98 A48 48 0 0 1 260 169"/><text class="m" x="261" y="116">${esc(central)}°</text><text class="t" x="212" y="35">A</text><text class="t" x="119" y="215">B</text><text class="t" x="313" y="215">C</text><text class="t" x="229" y="143">O</text>`, 'Коло з центральним і вписаним кутами');
}

export function renderSimilarTriangles(spec) {
  const { bigBase = 9, smallBase = 6 } = spec.data;
  return shell(`<path class="g" d="M48 225L190 52L190 225Z M250 225L370 80L370 225Z"/><path class="g" d="M172 207h18v18 M352 207h18v18"/><text class="m" x="105" y="250">${esc(bigBase)}</text><text class="m" x="296" y="250">${esc(smallBase)}</text><text class="s" x="90" y="32">подібні трикутники</text>`, 'Подібні прямокутні трикутники');
}

export function renderRectPrism(spec) {
  const { a = 2, b = 2, h = 1, showDiagonal = true } = spec.data;
  return shell(`<path class="g" d="M70 220L278 220L358 164L150 164Z M70 100L278 100L358 44L150 44Z M70 100V220 M278 100V220 M358 44V164 M150 44V164"/>${showDiagonal ? '<path class="d" d="M70 220L358 44"/>' : ''}<text class="m" x="165" y="248">${esc(a)}</text><text class="m" x="320" y="198">${esc(b)}</text><text class="m" x="48" y="164">${esc(h)}</text>`, 'Прямокутний паралелепіпед');
}

export function renderLinkedSolids(spec) {
  const { radius = 'r', height = 'h' } = spec.data;
  return shell(`<ellipse class="g" cx="115" cy="220" rx="70" ry="20"/><ellipse class="g" cx="115" cy="78" rx="70" ry="20"/><path class="g" d="M45 78V220 M185 78V220"/><path class="g" d="M245 228L382 228L313 188Z M245 88L382 88L313 48Z M245 88V228 M382 88V228 M313 48V188"/><path class="d" d="M313 48V228"/><text class="m" x="72" y="267">r=${esc(radius)}</text><text class="m" x="280" y="267">h=${esc(height)}</text>`, 'Два просторові тіла');
}

export function renderCircleRectangle(spec) {
  const { width = 6, height = 8 } = spec.data;
  return shell(`<circle class="g" cx="220" cy="145" r="108"/><rect class="g" x="130" y="73" width="180" height="144"/><path class="d" d="M130 73L310 217"/><text class="m" x="207" y="242">${esc(width)}</text><text class="m" x="315" y="150">${esc(height)}</text><circle cx="220" cy="145" r="4" fill="currentColor"/>`, 'Прямокутник, вписаний у коло');
}

export function renderLegacy(spec) {
  return spec.data.markup;
}
