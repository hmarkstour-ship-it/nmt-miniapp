const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

function shell(inner, aria = 'Математична схема', viewBox = '0 0 480 320') {
  return `<svg viewBox="${viewBox}" role="img" aria-label="${esc(aria)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .frame{fill:rgba(127,127,127,.045);stroke:rgba(127,127,127,.16);stroke-width:1}
      .g{stroke:currentColor;stroke-width:2.35;fill:none;stroke-linecap:round;stroke-linejoin:round}
      .thin{stroke:currentColor;stroke-opacity:.55;stroke-width:1.35;fill:none}
      .d{stroke:currentColor;stroke-opacity:.45;stroke-width:1.55;fill:none;stroke-dasharray:6 6}
      .a{stroke:var(--accent-color,#4f7cff);stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}
      .fill{fill:color-mix(in srgb,var(--accent-color,#4f7cff) 16%,transparent);stroke:var(--accent-color,#4f7cff);stroke-width:1.6}
      .soft{fill:color-mix(in srgb,currentColor 6%,transparent);stroke:currentColor;stroke-opacity:.5;stroke-width:1.2}
      .t{font:700 15px system-ui,-apple-system,"Segoe UI",sans-serif;fill:currentColor}
      .m{font:600 13px system-ui,-apple-system,"Segoe UI",sans-serif;fill:currentColor}
      .s{font:500 11px system-ui,-apple-system,"Segoe UI",sans-serif;fill:currentColor;opacity:.62}
      .grid{stroke:currentColor;stroke-opacity:.10;stroke-width:1}
      .axis{stroke:currentColor;stroke-opacity:.72;stroke-width:1.7;fill:none}
      .dot{fill:var(--accent-color,#4f7cff);stroke:currentColor;stroke-width:.8}
    </style>
  </defs>
  <rect class="frame" x="8" y="8" width="464" height="304" rx="18"/>
  ${inner}
</svg>`;
}

function gridLines(x0=54,y0=250,x1=438,y1=42,xStep=48,yStep=40) {
  let out='';
  for(let x=x0;x<=x1;x+=xStep) out+=`<path class="grid" d="M${x} ${y1}V${y0}"/>`;
  for(let y=y0;y>=y1;y-=yStep) out+=`<path class="grid" d="M${x0} ${y}H${x1}"/>`;
  return out;
}

export function renderBarChart(spec) {
  const values = spec.data.values ?? [];
  const labels = spec.labels.categories ?? values.map((_, i) => String(i + 1));
  const max = Math.max(1, ...values);
  const x0=58,y0=244,w=360,h=172;
  const step=w/Math.max(1,values.length);
  const bars=values.map((value,index)=>{
    const bh=h*value/max;
    const bw=Math.min(48,step-14);
    const x=x0+index*step+(step-bw)/2;
    const y=y0-bh;
    return `<rect class="fill" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="7"/>
      <text class="m" x="${(x+bw/2).toFixed(1)}" y="${(y-8).toFixed(1)}" text-anchor="middle">${esc(value)}</text>
      <text class="s" x="${(x+bw/2).toFixed(1)}" y="268" text-anchor="middle">${esc(labels[index])}</text>`;
  }).join('');
  return shell(`${gridLines(58,244,418,52,60,48)}<path class="axis" d="M58 244H425 M58 45V244"/>${bars}<text class="s" x="58" y="293">NMT • дані</text>`, 'Стовпчаста діаграма');
}

export function renderLineChart(spec) {
  const values=spec.data.values ?? [];
  const labels=spec.labels.categories ?? values.map((_,i)=>String(i+1));
  const max=Math.max(1,...values), min=Math.min(0,...values);
  const x0=64,y0=244,w=350,h=168;
  const px=(i)=>x0+(values.length<=1?0:i*w/(values.length-1));
  const py=(v)=>y0-(v-min)/Math.max(1,max-min)*h;
  const points=values.map((v,i)=>`${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const dots=values.map((v,i)=>`<circle class="dot" cx="${px(i)}" cy="${py(v)}" r="5"/><text class="m" x="${px(i)}" y="${py(v)-10}" text-anchor="middle">${esc(v)}</text><text class="s" x="${px(i)}" y="268" text-anchor="middle">${esc(labels[i])}</text>`).join('');
  return shell(`${gridLines(58,244,426,52,46,48)}<path class="axis" d="M58 244H430 M58 45V244"/><polyline class="a" points="${points}"/>${dots}<text class="s" x="58" y="293">NMT • динаміка</text>`,'Лінійна діаграма');
}

export function renderFunctionGraph(spec) {
  const { kind='parabola', h=0,k=0,slope=1,intercept=0,xMin=-5,xMax=5 }=spec.data;
  const ox=240,oy=160,sx=36,sy=27;
  let grid='';
  for(let x=60;x<=420;x+=36) grid+=`<path class="grid" d="M${x} 38V282"/>`;
  for(let y=52;y<=268;y+=27) grid+=`<path class="grid" d="M45 ${y}H435"/>`;
  const fn=kind==='line'?(x)=>slope*x+intercept:(x)=>(x-h)**2+k;
  const pts=[];
  for(let x=xMin;x<=xMax;x+=.09){const y=fn(x);if(Number.isFinite(y)&&Math.abs(y)<10) pts.push(`${(ox+x*sx).toFixed(1)},${(oy-y*sy).toFixed(1)}`)}
  const focus=kind==='line'?`<circle class="dot" cx="${ox}" cy="${oy-intercept*sy}" r="5"/>`:`<circle class="dot" cx="${ox+h*sx}" cy="${oy-k*sy}" r="5"/>`;
  return shell(`${grid}<path class="axis" d="M45 ${oy}H438 M${ox} 32V286"/><path class="a" d="M430 ${oy-5}l8 5-8 5 M${ox-5} 40l5-8 5 8"/><polyline class="a" points="${pts.join(' ')}"/>${focus}<text class="m" x="440" y="${oy-8}">x</text><text class="m" x="${ox+8}" y="35">y</text><text class="s" x="56" y="294">NMT • координатна площина</text>`,'Графік функції');
}

export function renderTrapezoid(spec) {
  const {top=8,bottom=14,height=6,angle=null}=spec.data;
  const mirrored=Number(top+bottom+height)%2===0;
  const pts=mirrored?{a:[72,238],d:[405,238],b:[145,72],c:[344,72]}:{a:[72,238],d:[405,238],b:[118,72],c:[318,72]};
  return shell(`<path class="g" d="M${pts.a.join(' ')}L${pts.d.join(' ')}L${pts.c.join(' ')}L${pts.b.join(' ')}Z"/><path class="d" d="M${pts.b[0]} ${pts.b[1]}V238"/><path class="thin" d="M${pts.b[0]} 220h18v18"/><text class="t" x="55" y="260">A</text><text class="t" x="408" y="260">D</text><text class="t" x="${pts.b[0]-8}" y="60">B</text><text class="t" x="${pts.c[0]+5}" y="60">C</text><text class="m" x="235" y="265">${esc(bottom)}</text><text class="m" x="225" y="62">${esc(top)}</text><text class="m" x="${pts.b[0]+12}" y="158">${esc(height)}</text>${angle!=null?`<path class="a" d="M365 238 A40 40 0 0 0 381 202"/><text class="m" x="341" y="198">${esc(angle)}°</text>`:''}<text class="s" x="55" y="294">AD ∥ BC</text>`,'Трапеція');
}

export function renderParallelogramDiagonal(spec) {
  const {a=25,b=35}=spec.data;
  return shell(`<path class="g" d="M75 232L365 232L415 86L125 86Z"/><path class="a" d="M75 232L415 86"/><text class="t" x="58" y="254">A</text><text class="t" x="366" y="254">B</text><text class="t" x="420" y="82">C</text><text class="t" x="108" y="80">D</text><path class="thin" d="M109 215 A34 34 0 0 1 95 195"/><text class="m" x="112" y="191">${esc(a)}°</text><path class="thin" d="M384 99 A34 34 0 0 1 400 124"/><text class="m" x="354" y="132">${esc(b)}°</text><text class="s" x="56" y="292">AB ∥ CD, AD ∥ BC</text>`,'Паралелограм з діагоналлю');
}

export function renderParallelLines(spec) {
  const {angle=55}=spec.data;
  return shell(`<path class="g" d="M55 95H425 M55 235H425"/><path class="a" d="M145 282L325 48"/><path class="thin" d="M278 95 A36 36 0 0 1 299 124"/><text class="m" x="302" y="128">${esc(angle)}°</text><path class="thin" d="M185 235 A36 36 0 0 1 164 207"/><text class="m" x="125" y="205">?</text><text class="s" x="58" y="292">a ∥ b</text>`,'Паралельні прямі та січна');
}

export function renderTriangleSides(spec) {
  const {left=5,right=7,base=8,angle=null}=spec.data;
  const apexX=175+(Number(left)*13)%120;
  return shell(`<path class="g" d="M70 240L410 240L${apexX} 55Z"/><text class="t" x="54" y="262">A</text><text class="t" x="414" y="262">B</text><text class="t" x="${apexX-7}" y="44">C</text>${base!==''?`<text class="m" x="235" y="266">${esc(base)}</text>`:''}<text class="m" x="${Math.max(86,apexX-94)}" y="145">${esc(left)}</text><text class="m" x="${Math.min(350,apexX+88)}" y="145">${esc(right)}</text>${angle!=null?`<path class="a" d="M105 240 A38 38 0 0 0 91 207"/><text class="m" x="108" y="203">${esc(angle)}°</text>`:''}<text class="s" x="56" y="294">схема не в масштабі</text>`,'Трикутник');
}

export function renderRightTriangle(spec) {
  const {a=3,b=4,c='?'}=spec.data;
  return shell(`<path class="g" d="M90 242H396L90 72Z"/><path class="thin" d="M90 222h20v20"/><text class="m" x="230" y="268">${esc(a)}</text><text class="m" x="56" y="160">${esc(b)}</text><text class="m" x="260" y="142">${esc(c)}</text><text class="t" x="72" y="263">A</text><text class="t" x="401" y="263">B</text><text class="t" x="72" y="65">C</text>`,'Прямокутний трикутник');
}

export function renderCircleAngle(spec) {
  const {central=100}=spec.data;
  return shell(`<circle class="g" cx="240" cy="158" r="108"/><circle class="dot" cx="240" cy="158" r="4"/><path class="thin" d="M240 158L240 50 M240 158L334 212"/><path class="g" d="M240 50L138 212L334 212"/><path class="a" d="M240 111 A48 48 0 0 1 281 182"/><text class="m" x="288" y="116">${esc(central)}°</text><text class="t" x="232" y="40">A</text><text class="t" x="122" y="231">B</text><text class="t" x="340" y="231">C</text><text class="t" x="249" y="156">O</text>`,'Коло з кутами');
}

export function renderCircleDiameter(spec) {
  const {diameter=null,showPoint=false}=spec.data;
  return shell(`<circle class="g" cx="240" cy="160" r="108"/><path class="a" d="M132 160H348"/><circle class="dot" cx="240" cy="160" r="4"/>${showPoint?'<circle class="dot" cx="240" cy="52" r="5"/><path class="g" d="M132 160L240 52L348 160"/><text class="t" x="232" y="42">B</text>':''}<text class="t" x="113" y="166">A</text><text class="t" x="354" y="166">C</text><text class="t" x="248" y="155">O</text>${diameter!=null?`<text class="m" x="222" y="148">${esc(diameter)}</text>`:''}<text class="s" x="56" y="294">AC — діаметр</text>`,'Коло з діаметром');
}

export function renderSimilarTriangles(spec) {
  const {bigBase=9,smallBase=6}=spec.data;
  return shell(`<path class="g" d="M50 238L205 58L205 238Z M275 238L404 86L404 238Z"/><path class="thin" d="M185 218h20v20 M384 218h20v20"/><path class="a" d="M50 238H205 M275 238H404"/><text class="m" x="116" y="265">${esc(bigBase)}</text><text class="m" x="327" y="265">${esc(smallBase)}</text><text class="s" x="56" y="294">Δ₁ ∼ Δ₂</text>`,'Подібні трикутники');
}

export function renderRectPrism(spec) {
  const {a=2,b=2,h=1,showDiagonal=true}=spec.data;
  return shell(`<path class="g" d="M72 232L288 232L390 170L174 170Z M72 104L288 104L390 42L174 42Z M72 104V232 M288 104V232 M390 42V170 M174 42V170"/>${showDiagonal?'<path class="a" d="M72 232L390 42"/>':''}<path class="d" d="M72 104L174 42 M288 232L390 170"/><text class="m" x="174" y="260">${esc(a)}</text><text class="m" x="337" y="208">${esc(b)}</text><text class="m" x="46" y="170">${esc(h)}</text>`,'Прямокутний паралелепіпед');
}

export function renderCube(spec) {
  const {a=3}=spec.data;
  return shell(`<path class="g" d="M115 238L320 238L390 185L185 185Z M115 83L320 83L390 30L185 30Z M115 83V238 M320 83V238 M390 30V185 M185 30V185"/><path class="d" d="M115 83L185 30 M320 238L390 185"/><path class="a" d="M115 238H320"/><text class="m" x="207" y="265">a=${esc(a)}</text><text class="s" x="56" y="294">куб</text>`,'Куб');
}

export function renderLinkedSolids(spec) {
  const {radius='r',height='h'}=spec.data;
  return shell(`<ellipse class="g" cx="125" cy="232" rx="72" ry="22"/><ellipse class="g" cx="125" cy="78" rx="72" ry="22"/><path class="g" d="M53 78V232 M197 78V232"/><path class="a" d="M125 78V232"/><path class="g" d="M266 238L405 238L335 196Z M266 91L405 91L335 49Z M266 91V238 M405 91V238 M335 49V196"/><path class="d" d="M335 49V238"/><text class="m" x="68" y="282">r=${esc(radius)}</text><text class="m" x="295" y="282">h=${esc(height)}</text>`,'Пов’язані просторові тіла');
}

export function renderCircleRectangle(spec) {
  const {width=6,height=8}=spec.data;
  return shell(`<circle class="g" cx="240" cy="158" r="112"/><rect class="g" x="145" y="82" width="190" height="152" rx="2"/><path class="a" d="M145 82L335 234"/><circle class="dot" cx="240" cy="158" r="4"/><text class="m" x="226" y="258">${esc(width)}</text><text class="m" x="342" y="163">${esc(height)}</text><text class="s" x="56" y="294">діагональ прямокутника = діаметр кола</text>`,'Прямокутник у колі');
}
