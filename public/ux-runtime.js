(() => {
  const SOUND_KEY = 'nmt_sound_enabled_v1';
  let audioContext = null;

  function getSoundEnabled() {
    try {
      const stored = localStorage.getItem(SOUND_KEY);
      return stored == null ? true : stored === '1';
    } catch (_) {
      return true;
    }
  }

  function setSoundEnabled(enabled) {
    try { localStorage.setItem(SOUND_KEY, enabled ? '1' : '0'); } catch (_) {}
    window.dispatchEvent(new CustomEvent('nmt:sound-setting', { detail: { enabled: !!enabled } }));
    return !!enabled;
  }

  function ensureAudio() {
    if (!getSoundEnabled()) return null;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioContext ||= new Ctx();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return audioContext;
    } catch (_) {
      return null;
    }
  }

  function tone(freq, start, duration, gain = 0.035, type = 'sine') {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const t0 = ctx.currentTime + start;
    const t1 = t0 + duration;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + 0.018);
    amp.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.025);
  }

  function playSound(kind) {
    if (!getSoundEnabled()) return;
    // Deliberately subtle: feedback, not a mobile game soundtrack.
    if (kind === 'correct') {
      tone(660, 0, 0.10, 0.030, 'sine');
      tone(880, 0.075, 0.13, 0.024, 'sine');
    } else if (kind === 'wrong') {
      tone(300, 0, 0.12, 0.025, 'sine');
      tone(240, 0.08, 0.12, 0.018, 'sine');
    } else if (kind === 'finish') {
      tone(523.25, 0, 0.11, 0.025, 'sine');
      tone(659.25, 0.09, 0.12, 0.026, 'sine');
      tone(783.99, 0.19, 0.17, 0.028, 'sine');
    }
  }

  function haptic(kind = 'light') {
    const tg = window.Telegram?.WebApp;
    try {
      if (kind === 'success' || kind === 'error' || kind === 'warning') {
        tg?.HapticFeedback?.notificationOccurred?.(kind);
      } else if (kind === 'selection') {
        tg?.HapticFeedback?.selectionChanged?.();
      } else {
        tg?.HapticFeedback?.impactOccurred?.(kind);
      }
    } catch (_) {}
  }

  function stripDelimitedMath(value) {
    return String(value ?? '')
      .replace(/\\\([\s\S]*?\\\)/g, ' ')
      .replace(/\\\[[\s\S]*?\\\]/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' ');
  }

  function delimitersBalanced(value) {
    const text = String(value ?? '');
    const pairs = [
      [/\\\(/g, /\\\)/g],
      [/\\\[/g, /\\\]/g],
    ];
    for (const [openRe, closeRe] of pairs) {
      const opens = text.match(openRe)?.length ?? 0;
      const closes = text.match(closeRe)?.length ?? 0;
      if (opens !== closes) return false;
    }
    const dollars = text.match(/\$\$/g)?.length ?? 0;
    return dollars % 2 === 0;
  }

  function mathSegments(value) {
    const text = String(value ?? '');
    const segments = [];
    const re = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
    let match;
    while ((match = re.exec(text))) {
      segments.push(match[1] ?? match[2] ?? match[3] ?? '');
    }
    return segments;
  }

  function hasRawMathOutsideDelimiters(value) {
    const outside = stripDelimitedMath(value);
    const rawLatex = /\\(?:frac|dfrac|tfrac|sqrt|left|right|cdot|times|div|log|ln|sin|cos|tan|cot|le|ge|neq|approx|pi|infty|sum|prod|overline|vec|begin|end)\b/;
    const legacy = /\bsqrt\s*\(|\blog_[A-Za-z0-9]+\s*\(?|\b[A-Za-z]\s*[+−\-*/^]\s*\(?-?\d|\d\s*\^\s*\d/;
    const compactMath = /[A-Za-zА-Яа-яІіЇїЄєҐґ0-9₀-₉ₙₐₑₒₓ][A-Za-zА-Яа-яІіЇїЄєҐґ0-9₀-₉ₙₐₑₒₓ_(){}\[\]+−\-*/·×^=<>≤≥≠:%.,]{1,100}/gu;
    const hasCompactMath = [...outside.matchAll(compactMath)].some(([token]) => {
      const hasRelationOrPower = /[=<>≤≥≠^√]/u.test(token);
      const hasNumericOperation = /(?:\d[^\s]{0,30}[+−*/·×]|[+−*/·×][^\s]{0,30}\d)/u.test(token);
      const hasSubscriptFormula = /[A-Za-zА-Яа-яІіЇїЄєҐґ][₀-₉ₙₐₑₒₓ]/u.test(token) && /[=+−*/·×^]/u.test(token);
      return hasRelationOrPower || hasNumericOperation || hasSubscriptFormula;
    });
    return rawLatex.test(outside) || legacy.test(outside) || hasCompactMath;
  }

  function validateText(value) {
    if (value == null || value === '') return true;
    if (typeof value !== 'string') return true;
    if (!delimitersBalanced(value) || hasRawMathOutsideDelimiters(value)) return false;
    if (typeof window.katex?.renderToString !== 'function') return true;
    try {
      for (const segment of mathSegments(value)) {
        window.katex.renderToString(segment, { throwOnError: true, strict: false, output: 'html' });
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function validateQuestion(q) {
    if (!q || typeof q !== 'object') return false;
    const fields = [
      q.question,
      ...(Array.isArray(q.options) ? q.options : []),
      q.explanation,
      ...(Array.isArray(q.explanation_steps) ? q.explanation_steps : []),
      ...(Array.isArray(q.left) ? q.left : []),
      ...(Array.isArray(q.match_options) ? q.match_options.map((x) => x?.label) : []),
    ];
    if (q.solution && typeof q.solution === 'object') {
      fields.push(q.solution.given, q.solution.find, q.solution.method, q.solution.why, q.solution.answer);
      if (Array.isArray(q.solution.steps)) fields.push(...q.solution.steps);
    }
    return fields.every(validateText);
  }

  function renderMath(root) {
    if (!root) return false;
    if (typeof window.renderMathInElement !== 'function') return false;
    try {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: true,
        strict: false,
        errorCallback: (message) => { throw new Error(message); },
      });
      return !root.querySelector?.('.katex-error');
    } catch (err) {
      console.warn('Math render rejected:', err?.message || err);
      return false;
    }
  }

  window.NMTUX = Object.freeze({
    getSoundEnabled,
    setSoundEnabled,
    playSound,
    haptic,
    unlockAudio: ensureAudio,
  });

  window.NMTMath = Object.freeze({
    validateText,
    validateQuestion,
    render: renderMath,
  });
})();
