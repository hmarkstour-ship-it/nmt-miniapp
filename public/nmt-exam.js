(() => {
  const tg = window.Telegram?.WebApp;
  const API_BASE = 'https://nmt-miniapp.onrender.com';
  const content = document.getElementById('nmtContent');
  const finishOverlay = document.getElementById('nmtFinishOverlay');
  const finishSummary = document.getElementById('nmtFinishSummary');
  const finishCancel = document.getElementById('nmtFinishCancel');
  const finishConfirm = document.getElementById('nmtFinishConfirm');
  const keyboardDone = document.getElementById('nmtKeyboardDone');

  const state = {
    checked: false,
    activeAttempt: null,
    questions: [],
    answers: {},
    index: 0,
    remainingSeconds: 3600,
    timer: null,
    result: null,
    finishing: false,
  };

  const LETTERS = ['А', 'Б', 'В', 'Г', 'Д'];

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
  }

  async function post(path, body, timeoutMs = 25000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ initData: tg?.initData || null, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Помилка сервера');
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function renderMath(root) {
    if (!root || typeof window.renderMathInElement !== 'function') return;
    try {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        strict: false,
      });
    } catch (err) {
      console.warn('NMT KaTeX error:', err);
    }
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const min = Math.floor(safe / 60);
    const sec = safe % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function answeredCount() {
    return state.questions.reduce((count, q, i) => isAnswered(q, state.answers[String(i)]) ? count + 1 : count, 0);
  }

  function isAnswered(q, answer) {
    if (q.type === 'choice') return Number.isInteger(Number(answer)) && answer !== null && answer !== '';
    if (q.type === 'matching') {
      return answer && typeof answer === 'object' && ['0', '1', '2'].every(k => typeof answer[k] === 'string' && answer[k]);
    }
    return typeof answer === 'string' ? answer.trim().length > 0 : answer !== null && answer !== undefined && String(answer).trim().length > 0;
  }

  function renderLanding(active = null) {
    clearTimer();
    state.result = null;
    const resume = active ? `
      <div class="nmt-resume-card">
        <div class="nmt-resume-dot"></div>
        <div class="nmt-resume-copy">
          <strong>Є незавершений тест</strong>
          <span>Залишилось ${escapeHtml(formatTime(active.remaining_seconds))}</span>
        </div>
        <button class="nmt-inline-btn" id="nmtResumeBtn" type="button">Продовжити</button>
      </div>` : '';

    content.innerHTML = `
      ${resume}
      <section class="nmt-hero-card">
        <div class="nmt-hero-badge">ФОРМАТ НМТ-2026</div>
        <h3>Пробний тест з математики</h3>
        <p>Максимально наближений формат: 15 завдань з вибором відповіді, 3 на встановлення відповідності та 4 з короткою відповіддю.</p>
        <div class="nmt-facts-grid">
          <div><strong>22</strong><span>завдання</span></div>
          <div><strong>60</strong><span>хвилин</span></div>
          <div><strong>32</strong><span>тестові бали</span></div>
          <div><strong>200</strong><span>максимум</span></div>
        </div>
        <div class="nmt-hero-note">
          <span>◉</span>
          <p>Під час тесту правильні відповіді не показуються. Після завершення побачиш бал 100–200, усі помилки й теми для повторення.</p>
        </div>
        <button class="nmt-start-btn" id="nmtStartBtn" type="button">${active ? 'Почати новий тест' : 'Почати пробний НМТ'}</button>
      </section>

      <section class="nmt-format-card">
        <div class="nmt-format-row"><span class="nmt-format-number">1–15</span><div><strong>Одна правильна відповідь</strong><p>5 варіантів · 1 бал за завдання</p></div></div>
        <div class="nmt-format-row"><span class="nmt-format-number">16–18</span><div><strong>Логічні пари</strong><p>3 пари · до 3 балів за завдання</p></div></div>
        <div class="nmt-format-row"><span class="nmt-format-number">19–22</span><div><strong>Коротка відповідь</strong><p>Число · 2 бали за правильну відповідь</p></div></div>
      </section>`;

    document.getElementById('nmtStartBtn')?.addEventListener('click', () => startExam(Boolean(active)));
    document.getElementById('nmtResumeBtn')?.addEventListener('click', () => activateAttempt(active));
  }

  async function checkActive() {
    if (state.checked) return;
    state.checked = true;
    try {
      const data = await post('/api/nmt/resume', {});
      state.activeAttempt = data.attempt || null;
      renderLanding(state.activeAttempt);
    } catch (err) {
      content.innerHTML = `<div class="nmt-error-card"><strong>Не вдалося відкрити пробний НМТ</strong><p>${escapeHtml(err.message)}</p><button class="secondary-btn" id="nmtRetryOpen">Спробувати ще раз</button></div>`;
      document.getElementById('nmtRetryOpen')?.addEventListener('click', () => { state.checked = false; checkActive(); });
    }
  }

  async function startExam(forceNew = false) {
    content.innerHTML = `<div class="nmt-loading-card"><div class="spinner"></div><strong>Збираємо твій варіант НМТ…</strong><span>22 завдання формуються локально на сервері — без очікування AI</span></div>`;
    try {
      const data = await post('/api/nmt/start', { forceNew }, 30000);
      activateAttempt(data.attempt);
    } catch (err) {
      renderLanding(state.activeAttempt);
      showLocalToast(err.message || 'Не вдалося почати тест');
    }
  }

  function activateAttempt(attempt) {
    if (!attempt) return renderLanding(null);
    state.activeAttempt = attempt;
    state.questions = attempt.questions || [];
    state.answers = attempt.answers || {};
    state.remainingSeconds = Math.max(0, Number(attempt.remaining_seconds) || 0);
    const firstUnanswered = state.questions.findIndex((q, i) => !isAnswered(q, state.answers[String(i)]));
    state.index = firstUnanswered >= 0 ? firstUnanswered : 0;
    renderExam();
    startTimer();
    if (state.remainingSeconds <= 0) finishExam(true);
  }

  function startTimer() {
    clearTimer();
    updateTimerDom();
    state.timer = setInterval(() => {
      state.remainingSeconds -= 1;
      updateTimerDom();
      if (state.remainingSeconds <= 0) {
        clearTimer();
        finishExam(true);
      }
    }, 1000);
  }

  function clearTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function updateTimerDom() {
    const el = document.getElementById('nmtTimer');
    if (!el) return;
    el.textContent = formatTime(state.remainingSeconds);
    el.classList.toggle('warning', state.remainingSeconds <= 600);
    el.classList.toggle('danger', state.remainingSeconds <= 120);
  }

  function renderExam() {
    const q = state.questions[state.index];
    if (!q) return;
    const answered = answeredCount();
    const progress = Math.round(((state.index + 1) / state.questions.length) * 100);

    content.innerHTML = `
      <div class="nmt-exam-topbar">
        <div>
          <span class="nmt-exam-label">ПРОБНИЙ НМТ</span>
          <strong>Завдання ${state.index + 1} з ${state.questions.length}</strong>
        </div>
        <div class="nmt-timer" id="nmtTimer">${formatTime(state.remainingSeconds)}</div>
      </div>

      <div class="nmt-progress-track"><span style="width:${progress}%"></span></div>

      <div class="nmt-exam-tools">
        <button type="button" id="nmtPaletteToggle">${answered}/22 відповідей</button>
        <button type="button" id="nmtReferenceBtn">ƒx Формули</button>
      </div>

      <div class="nmt-palette" id="nmtPalette" hidden>
        ${state.questions.map((item, i) => `<button type="button" class="nmt-palette-item ${i === state.index ? 'current' : ''} ${isAnswered(item, state.answers[String(i)]) ? 'answered' : ''}" data-nmt-index="${i}">${i + 1}</button>`).join('')}
      </div>

      <article class="nmt-question-card" data-type="${q.type}">
        <div class="nmt-question-meta"><span>${escapeHtml(q.topic_label || '')}</span><span>${typeLabel(q.type)}</span></div>
        <div class="nmt-question-text">${escapeHtml(q.question)}</div>
        ${q.diagram_svg ? `<div class="nmt-diagram">${q.diagram_svg}</div>` : ''}
        <div id="nmtAnswerArea">${answerMarkup(q, state.answers[String(state.index)])}</div>
      </article>

      <div class="nmt-navigation-row">
        <button class="nmt-nav-btn" id="nmtPrev" type="button" ${state.index === 0 ? 'disabled' : ''}>← Назад</button>
        ${state.index === state.questions.length - 1
          ? '<button class="nmt-finish-btn" id="nmtFinish" type="button">Завершити тест</button>'
          : '<button class="nmt-nav-btn primary" id="nmtNext" type="button">Далі →</button>'}
      </div>`;

    bindExamInteractions(q);
    renderMath(content);
    updateTimerDom();
  }

  function typeLabel(type) {
    if (type === 'matching') return 'Логічні пари';
    if (type === 'short') return 'Коротка відповідь';
    return 'Одна відповідь';
  }

  function answerMarkup(q, answer) {
    if (q.type === 'choice') {
      return `<div class="nmt-choice-list">${q.options.map((opt, i) => `
        <button class="nmt-choice ${Number(answer) === i ? 'selected' : ''}" data-choice="${i}" type="button">
          <span>${LETTERS[i]}</span><div>${escapeHtml(opt)}</div>
        </button>`).join('')}</div>`;
    }

    if (q.type === 'matching') {
      const current = answer && typeof answer === 'object' ? answer : {};
      return `<div class="nmt-matching-wrap">
        <div class="nmt-match-options-head">${q.match_options.map(opt => `<span><b>${escapeHtml(opt.code)}</b>${escapeHtml(opt.label)}</span>`).join('')}</div>
        ${q.left.map((left, row) => `<div class="nmt-match-row">
          <div class="nmt-match-left"><b>${row + 1}</b><span>${escapeHtml(left)}</span></div>
          <div class="nmt-match-buttons">${q.match_options.map(opt => `<button type="button" class="nmt-match-chip ${current[String(row)] === opt.code ? 'selected' : ''}" data-match-row="${row}" data-match-code="${opt.code}">${opt.code}</button>`).join('')}</div>
        </div>`).join('')}
        <p class="nmt-answer-help">Для кожного пункту вибери одну літеру. Одна літера не може використовуватися двічі.</p>
      </div>`;
    }

    const value = answer ?? '';
    return `<div class="nmt-short-wrap">
      <label for="nmtShortInput">Ваша відповідь</label>
      <div class="nmt-short-input-shell"><input id="nmtShortInput" class="nmt-short-input" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${escapeHtml(String(value))}" placeholder="${escapeHtml(q.answer_hint || 'Введіть число')}"><span>123</span></div>
      <p class="nmt-answer-help">Кома й крапка сприймаються однаково. Наприклад: <b>2,5</b> і <b>2.5</b>.</p>
    </div>`;
  }

  function bindExamInteractions(q) {
    document.getElementById('nmtPrev')?.addEventListener('click', () => goTo(state.index - 1));
    document.getElementById('nmtNext')?.addEventListener('click', () => goTo(state.index + 1));
    document.getElementById('nmtFinish')?.addEventListener('click', openFinishOverlay);
    document.getElementById('nmtPaletteToggle')?.addEventListener('click', () => {
      const palette = document.getElementById('nmtPalette');
      if (palette) palette.hidden = !palette.hidden;
    });
    document.querySelectorAll('[data-nmt-index]').forEach(btn => btn.addEventListener('click', () => goTo(Number(btn.dataset.nmtIndex))));
    document.getElementById('nmtReferenceBtn')?.addEventListener('click', () => document.querySelector('.liquid-nav-item[data-view="cheatsheet"]')?.click());

    if (q.type === 'choice') {
      document.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => {
        const value = Number(btn.dataset.choice);
        state.answers[String(state.index)] = value;
        tg?.HapticFeedback?.selectionChanged?.();
        saveCurrentAnswer(value);
        renderExam();
      }));
    } else if (q.type === 'matching') {
      document.querySelectorAll('[data-match-row]').forEach(btn => btn.addEventListener('click', () => {
        const row = String(btn.dataset.matchRow);
        const code = btn.dataset.matchCode;
        const current = { ...(state.answers[String(state.index)] || {}) };
        Object.keys(current).forEach(key => { if (key !== row && current[key] === code) delete current[key]; });
        current[row] = code;
        state.answers[String(state.index)] = current;
        tg?.HapticFeedback?.selectionChanged?.();
        saveCurrentAnswer(current);
        renderExam();
      }));
    } else {
      const input = document.getElementById('nmtShortInput');
      if (input) {
        input.addEventListener('focus', showKeyboardDone);
        const inputIndex = state.index;
        input.addEventListener('input', () => {
          state.answers[String(inputIndex)] = input.value;
          debounceSave(input.value, inputIndex);
        });
        input.addEventListener('blur', () => {
          hideKeyboardDone();
          saveCurrentAnswer(input.value, inputIndex);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });
      }
    }
  }

  function goTo(index) {
    const next = Math.max(0, Math.min(state.questions.length - 1, Number(index) || 0));
    document.activeElement?.blur?.();
    state.index = next;
    renderExam();
    content.closest('.nmt-view')?.scrollTo?.({ top: 0, behavior: 'auto' });
  }

  let saveTimer = null;
  function debounceSave(answer, index = state.index) {
    clearTimeout(saveTimer);
    const snapshotIndex = index;
    saveTimer = setTimeout(() => saveCurrentAnswer(answer, snapshotIndex), 450);
  }

  async function saveCurrentAnswer(answer, index = state.index) {
    if (!state.activeAttempt?.id) return;
    try {
      await post('/api/nmt/save-answer', { attemptId: state.activeAttempt.id, index, answer }, 12000);
    } catch (err) {
      console.warn('NMT autosave:', err.message);
    }
  }

  function openFinishOverlay() {
    const answered = answeredCount();
    finishSummary.textContent = answered === 22
      ? 'Ти відповів на всі 22 завдання. Після завершення змінити відповіді вже не можна.'
      : `Відповіді є на ${answered} із 22 завдань. ${22 - answered} залишено без відповіді.`;
    finishOverlay.classList.add('show');
    finishOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeFinishOverlay() {
    finishOverlay.classList.remove('show');
    finishOverlay.setAttribute('aria-hidden', 'true');
  }

  async function finishExam(auto = false) {
    if (state.finishing || !state.activeAttempt?.id) return;
    state.finishing = true;
    closeFinishOverlay();
    clearTimer();
    content.innerHTML = `<div class="nmt-loading-card"><div class="spinner"></div><strong>${auto ? 'Час вийшов — підраховуємо результат…' : 'Підраховуємо результат…'}</strong><span>Перевіряємо 22 відповіді та визначаємо теми для повторення</span></div>`;
    try {
      const data = await post('/api/nmt/finish', { attemptId: state.activeAttempt.id, answers: state.answers }, 30000);
      state.result = data.result;
      state.activeAttempt = null;
      renderResult(data.result);
    } catch (err) {
      content.innerHTML = `<div class="nmt-error-card"><strong>Не вдалося завершити тест</strong><p>${escapeHtml(err.message)}</p><button class="primary-btn" id="nmtRetryFinish">Повторити</button></div>`;
      document.getElementById('nmtRetryFinish')?.addEventListener('click', () => finishExam(auto));
    } finally {
      state.finishing = false;
    }
  }

  function renderResult(result) {
    const scoreText = result.scaled_score ? String(result.scaled_score) : '<100';
    const weak = Array.isArray(result.weak_topics) ? result.weak_topics : [];
    content.innerHTML = `
      <section class="nmt-result-hero">
        <div class="nmt-result-kicker">ТВІЙ РЕЗУЛЬТАТ</div>
        <div class="nmt-result-score"><strong>${escapeHtml(scoreText)}</strong><span>/ 200</span></div>
        <div class="nmt-result-raw">${result.raw_score} / 32 тестових балів</div>
        <div class="nmt-result-status ${result.passed_threshold ? 'ok' : 'low'}">${result.passed_threshold ? 'Пороговий бал набрано' : 'Потрібно щонайменше 5 тестових балів для шкали 100–200'}</div>
      </section>

      <section class="nmt-result-card">
        <div class="nmt-result-card-head"><h3>Що повторити</h3><span>${weak.length ? `${weak.length} тем` : 'Все добре'}</span></div>
        ${weak.length ? `<div class="nmt-weak-list">${weak.slice(0, 6).map(item => `<div class="nmt-weak-row"><div><strong>${escapeHtml(item.label)}</strong><span>${item.count} проблемн${item.count === 1 ? 'е завдання' : 'их завдання'}</span></div><b>−${item.lost} б.</b></div>`).join('')}</div>` : '<p class="nmt-perfect-copy">Жодної теми для обов’язкового повторення — сильна робота.</p>'}
      </section>

      <section class="nmt-review-section">
        <div class="nmt-review-head"><h3>Розбір завдань</h3><p>Натисни на завдання, щоб побачити відповідь і пояснення.</p></div>
        <div class="nmt-review-list">${result.review.map(item => reviewMarkup(item)).join('')}</div>
      </section>

      <button class="nmt-start-btn" id="nmtNewAfterResult" type="button">Пройти ще один варіант</button>`;

    content.querySelectorAll('.nmt-review-toggle').forEach(btn => btn.addEventListener('click', () => {
      const item = btn.closest('.nmt-review-item');
      item?.classList.toggle('open');
      renderMath(item);
    }));
    document.getElementById('nmtNewAfterResult')?.addEventListener('click', () => startExam(true));
    renderMath(content);
  }

  function reviewMarkup(item) {
    return `<article class="nmt-review-item ${item.score_awarded === item.max_score ? 'correct' : 'wrong'}">
      <button class="nmt-review-toggle" type="button">
        <span class="nmt-review-number">${item.number}</span>
        <div><strong>${escapeHtml(item.topic_label)}</strong><small>${item.score_awarded}/${item.max_score} б.</small></div>
        <span class="nmt-review-state">${item.score_awarded === item.max_score ? '✓' : '!'}</span>
      </button>
      <div class="nmt-review-body">
        <div class="nmt-review-question">${escapeHtml(item.question)}</div>
        ${item.diagram_svg ? `<div class="nmt-diagram compact">${item.diagram_svg}</div>` : ''}
        <div class="nmt-review-answer"><span>Твоя відповідь</span><strong>${escapeHtml(item.user_answer)}</strong></div>
        <div class="nmt-review-answer correct"><span>Правильна відповідь</span><strong>${escapeHtml(item.correct_answer)}</strong></div>
        <div class="nmt-review-explanation"><span>Розв’язання</span>${stepsMarkup(item.explanation)}</div>
      </div>
    </article>`;
  }

  function stepsMarkup(explanation) {
    const steps = String(explanation || '').split(/\n+/).map(x => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
    return `<ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`;
  }

  function showKeyboardDone() {
    keyboardDone.classList.add('show');
    positionKeyboardDone();
  }

  function hideKeyboardDone() {
    keyboardDone.classList.remove('show');
  }

  function positionKeyboardDone() {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    keyboardDone.style.bottom = `${Math.max(94, keyboardHeight + 10)}px`;
  }

  function showLocalToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  finishCancel?.addEventListener('click', closeFinishOverlay);
  finishConfirm?.addEventListener('click', () => finishExam(false));
  finishOverlay?.addEventListener('click', (e) => { if (e.target === finishOverlay) closeFinishOverlay(); });
  keyboardDone?.addEventListener('click', () => document.activeElement?.blur?.());
  window.visualViewport?.addEventListener('resize', positionKeyboardDone);
  window.visualViewport?.addEventListener('scroll', positionKeyboardDone);

  document.addEventListener('pointerdown', (event) => {
    const active = document.activeElement;
    if (active?.classList?.contains('nmt-short-input') && event.target !== active && event.target !== keyboardDone) {
      if (!event.target.closest('.nmt-short-input-shell')) active.blur();
    }
  }, { passive: true });

  window.NMTExamController = {
    onViewOpen() {
      if (!state.checked) checkActive();
    },
  };
})();
