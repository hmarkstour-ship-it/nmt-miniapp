(() => {
  const tg = window.Telegram?.WebApp;
  const API_BASE = 'https://nmt-miniapp.onrender.com';
  const content = document.getElementById('nmtContent');
  const finishOverlay = document.getElementById('nmtFinishOverlay');
  const finishSummary = document.getElementById('nmtFinishSummary');
  const finishCancel = document.getElementById('nmtFinishCancel');
  const finishConfirm = document.getElementById('nmtFinishConfirm');
  const nmtView = document.getElementById('nmtView');

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
    hideKeyboardDone();
    nmtView?.classList.remove('exam-running');
    state.result = null;
    const resume = active ? `
      <div class="nmt-resume-card">
        <div class="nmt-resume-dot"></div>
        <div class="nmt-resume-copy">
          <strong>Є незавершений тест</strong>
          <span>Залишилося ${escapeHtml(formatTime(active.remaining_seconds))}</span>
        </div>
        <button class="nmt-inline-btn" id="nmtResumeBtn" type="button">Продовжити</button>
      </div>` : '';

    content.innerHTML = `
      ${resume}
      <section class="nmt-hero-card">
        <div class="nmt-hero-topline">
          <div class="nmt-hero-badge">НМТ 2026</div>
          <div class="nmt-hero-emblem" aria-hidden="true"><span>22</span><small>завд.</small></div>
        </div>
        <h3>Повний пробний варіант</h3>
        <p>60 хвилин у режимі, максимально наближеному до тесту: без підказок і перевірки до завершення.</p>
        <div class="nmt-facts-grid">
          <div><strong>22</strong><span>завдання</span></div>
          <div><strong>60</strong><span>хвилин</span></div>
          <div><strong>32</strong><span>тестові бали</span></div>
          <div><strong>200</strong><span>максимум</span></div>
        </div>
        <div class="nmt-hero-note">
          <span>i</span>
          <p>Після завершення побачиш результат, короткий висновок і розбір кожного завдання.</p>
        </div>
        <button class="nmt-start-btn" id="nmtStartBtn" type="button"><span>${active ? 'Новий варіант' : 'Почати тест'}</span><i>↗</i></button>
      </section>

      <section class="nmt-format-card">
        <div class="nmt-format-head"><span>Структура</span><small>22 завдання</small></div>
        <div class="nmt-format-row"><span class="nmt-format-number">01</span><div><strong>Одна правильна відповідь</strong><p>Завдання 1–15 · по 1 балу</p></div><i>15</i></div>
        <div class="nmt-format-row"><span class="nmt-format-number">02</span><div><strong>Встановлення відповідності</strong><p>Завдання 16–18 · до 3 балів</p></div><i>3</i></div>
        <div class="nmt-format-row"><span class="nmt-format-number">03</span><div><strong>Коротка відповідь</strong><p>Завдання 19–22 · числова відповідь</p></div><i>4</i></div>
      </section>`;

    requestAnimationFrame(() => { if (nmtView) nmtView.scrollTop = 0; });
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
    content.innerHTML = `<div class="nmt-loading-card"><div class="spinner"></div><strong>Збираємо твій варіант НМТ…</strong><span>Готуємо 22 завдання за структурою НМТ</span></div>`;
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
    nmtView?.classList.add('exam-running');
    const q = state.questions[state.index];
    if (!q) return;
    const answered = answeredCount();
    const progress = Math.round(((state.index + 1) / state.questions.length) * 100);

    content.innerHTML = `
      <div class="nmt-exam-topbar">
        <div>
          <span class="nmt-exam-label">НМТ · математика</span>
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
        <button class="nmt-nav-btn" id="nmtPrev" type="button" ${state.index === 0 ? 'disabled' : ''}>Назад</button>
        ${state.index === state.questions.length - 1
          ? '<button class="nmt-finish-btn" id="nmtFinish" type="button">Завершити тест</button>'
          : '<button class="nmt-nav-btn primary" id="nmtNext" type="button">Далі</button>'}
      </div>`;

    bindExamInteractions(q);
    renderMath(content);
    updateTimerDom();
  }

  function typeLabel(type) {
    if (type === 'matching') return 'Встановлення відповідності';
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
        <div class="nmt-match-options-preview">
          <div class="nmt-match-options-title">Варіанти відповідей</div>
          ${q.match_options.map(opt => `<div class="nmt-match-option-preview"><b>${escapeHtml(opt.code)}</b><span>${escapeHtml(opt.label)}</span></div>`).join('')}
        </div>
        <div class="nmt-match-rows-v2">
          ${q.left.map((left, row) => {
            const code = current[String(row)] || '';
            const selected = q.match_options.find(opt => opt.code === code);
            return `<button type="button" class="nmt-match-row-v2 ${code ? 'selected' : ''}" data-match-open="${row}">
              <span class="nmt-match-row-number">${row + 1}</span>
              <span class="nmt-match-row-copy"><strong>${escapeHtml(left)}</strong><small>${selected ? `${escapeHtml(selected.code)} · ${escapeHtml(selected.label)}` : 'Натисни, щоб обрати відповідність'}</small></span>
              <span class="nmt-match-row-action">${code ? escapeHtml(code) : 'Обрати'} <i>›</i></span>
            </button>`;
          }).join('')}
        </div>
        <p class="nmt-answer-help">Обери відповідь для кожного пункту. Уже використана літера автоматично перенесеться, якщо вибрати її для іншого пункту.</p>
      </div>`;
    }

    const value = answer ?? '';
    return `<div class="nmt-short-wrap">
      <label for="nmtShortInput">Твоя відповідь</label>
      <div class="nmt-short-input-shell"><input id="nmtShortInput" class="nmt-short-input" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="${escapeHtml(String(value))}" placeholder="${escapeHtml(q.answer_hint || 'Введи число')}"><span>123</span></div>
      <div class="nmt-short-actions" aria-hidden="true">
        <span>Кома або крапка — однаково</span>
        <button class="nmt-inline-done" id="nmtInlineDone" type="button">Готово <b>✓</b></button>
      </div>
      <p class="nmt-answer-help">Наприклад: <b>2,5</b> і <b>2.5</b> — однакова відповідь.</p>
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
      document.querySelectorAll('[data-match-open]').forEach(btn => btn.addEventListener('click', () => {
        openMatchingSheet(q, Number(btn.dataset.matchOpen));
      }));
    } else {
      const input = document.getElementById('nmtShortInput');
      if (input) {
        const shortWrap = input.closest('.nmt-short-wrap');
        const done = document.getElementById('nmtInlineDone');
        input.addEventListener('focus', () => {
          showKeyboardDone(shortWrap);
          setTimeout(() => ensureShortAnswerVisible(input), 120);
        });
        const inputIndex = state.index;
        input.addEventListener('input', () => {
          state.answers[String(inputIndex)] = input.value;
          debounceSave(input.value, inputIndex);
        });
        input.addEventListener('blur', () => {
          hideKeyboardDone(shortWrap);
          saveCurrentAnswer(input.value, inputIndex);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });
        done?.addEventListener('pointerdown', (event) => event.preventDefault());
        done?.addEventListener('click', () => input.blur());
      }
    }
  }

  function closeMatchingSheet() {
    const overlay = document.getElementById('nmtMatchOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 180);
  }

  function openMatchingSheet(q, row) {
    closeMatchingSheet();
    const current = { ...(state.answers[String(state.index)] || {}) };
    const overlay = document.createElement('div');
    overlay.id = 'nmtMatchOverlay';
    overlay.className = 'nmt-match-overlay';
    const usedBy = Object.fromEntries(Object.entries(current).map(([key, code]) => [code, Number(key) + 1]));

    overlay.innerHTML = `
      <section class="nmt-match-sheet" role="dialog" aria-modal="true" aria-label="Обери відповідність">
        <div class="nmt-match-sheet-handle"></div>
        <div class="nmt-match-sheet-head">
          <div><small>ПУНКТ ${row + 1}</small><strong>${escapeHtml(q.left[row])}</strong></div>
          <button type="button" class="nmt-match-sheet-close" aria-label="Закрити">×</button>
        </div>
        <div class="nmt-match-sheet-options">
          ${q.match_options.map(opt => {
            const selected = current[String(row)] === opt.code;
            const occupied = usedBy[opt.code] && usedBy[opt.code] !== row + 1;
            return `<button type="button" class="nmt-match-sheet-option ${selected ? 'selected' : ''}" data-match-select="${escapeHtml(opt.code)}">
              <span class="nmt-match-sheet-letter">${escapeHtml(opt.code)}</span>
              <span class="nmt-match-sheet-copy"><strong>${escapeHtml(opt.label)}</strong>${occupied ? `<small>Зараз обрано для пункту ${usedBy[opt.code]}</small>` : '<small>Натисни, щоб обрати</small>'}</span>
              <span class="nmt-match-sheet-check">${selected ? '✓' : ''}</span>
            </button>`;
          }).join('')}
        </div>
      </section>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    renderMath(overlay);

    overlay.querySelector('.nmt-match-sheet-close')?.addEventListener('click', closeMatchingSheet);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeMatchingSheet(); });
    overlay.querySelectorAll('[data-match-select]').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.matchSelect;
      const updated = { ...(state.answers[String(state.index)] || {}) };
      Object.keys(updated).forEach(key => { if (key !== String(row) && updated[key] === code) delete updated[key]; });
      updated[String(row)] = code;
      state.answers[String(state.index)] = updated;
      tg?.HapticFeedback?.selectionChanged?.();
      saveCurrentAnswer(updated);
      closeMatchingSheet();
      setTimeout(renderExam, 110);
    }));
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
    content.innerHTML = `<div class="nmt-loading-card"><div class="spinner"></div><strong>${auto ? 'Час вийшов — підраховуємо результат…' : 'Підраховуємо результат…'}</strong><span>Перевіряємо відповіді та готуємо короткий розбір</span></div>`;
    try {
      const data = await post('/api/nmt/finish', { attemptId: state.activeAttempt.id, answers: state.answers }, 30000);
      state.result = data.result;
      state.activeAttempt = null;
      window.dispatchEvent(new CustomEvent('nmt:finished', { detail: data.result }));
      renderResult(data.result);
    } catch (err) {
      content.innerHTML = `<div class="nmt-error-card"><strong>Не вдалося завершити тест</strong><p>${escapeHtml(err.message)}</p><button class="primary-btn" id="nmtRetryFinish">Повторити</button></div>`;
      document.getElementById('nmtRetryFinish')?.addEventListener('click', () => finishExam(auto));
    } finally {
      state.finishing = false;
    }
  }

  function joinTopics(labels) {
    const clean = labels.filter(Boolean).slice(0, 3);
    if (!clean.length) return '';
    if (clean.length === 1) return `«${clean[0]}»`;
    if (clean.length === 2) return `«${clean[0]}» та «${clean[1]}»`;
    return `«${clean[0]}», «${clean[1]}» та «${clean[2]}»`;
  }

  function buildResultConclusion(result) {
    const weak = Array.isArray(result.weak_topics) ? result.weak_topics : [];
    const topics = weak.map(item => item?.label).filter(Boolean);
    const focus = joinTopics(topics);
    const raw = Number(result.raw_score) || 0;

    if (!weak.length) {
      return {
        title: 'Дуже сильна робота',
        text: 'У цьому варіанті немає тем, які потребують обов’язкового повторення. Переглянь розбір нижче й переходь до наступного пробного тесту, коли будеш готовий.',
        topics: [],
      };
    }

    let opening = 'Є кілька тем, які варто підтягнути.';
    if (raw >= 28) opening = 'Результат дуже сильний, але кілька неточностей ще можна прибрати.';
    else if (raw >= 22) opening = 'База вже впевнена, однак є теми, на яких можна добрати результат.';
    else if (raw >= 16) opening = 'Основу ти тримаєш, але частину тем варто системно повторити.';
    else if (raw >= 10) opening = 'Є помітні прогалини, тому краще спочатку закріпити ключові теми.';
    else opening = 'Зараз найкраще зосередитися на базових темах і рухатися поступово.';

    return {
      title: 'Короткий висновок',
      text: `${opening} Найбільше уваги варто приділити ${focus}. Перед наступною спробою повтори основні правила й розбери завдання з помилками нижче.`,
      topics: topics.slice(0, 3),
    };
  }

  function renderResult(result) {
    nmtView?.classList.remove('exam-running');
    hideKeyboardDone();
    const scoreText = result.scaled_score ? String(result.scaled_score) : '<100';
    const conclusion = buildResultConclusion(result);
    content.innerHTML = `
      <section class="nmt-result-hero">
        <div class="nmt-result-kicker">Твій результат</div>
        <div class="nmt-result-score"><strong>${escapeHtml(scoreText)}</strong><span>/ 200</span></div>
        <div class="nmt-result-raw">Тестові бали: ${result.raw_score} із 32</div>
        <div class="nmt-result-status ${result.passed_threshold ? 'ok' : 'low'}">${result.passed_threshold ? 'Поріг подолано' : 'Для шкали 100–200 потрібно щонайменше 5 тестових балів'}</div>
      </section>

      <section class="nmt-result-card nmt-result-summary-card">
        <div class="nmt-result-card-head"><h3>${escapeHtml(conclusion.title)}</h3><span>за твоїми відповідями</span></div>
        <p class="nmt-result-summary-copy">${escapeHtml(conclusion.text)}</p>
        ${conclusion.topics.length ? `<div class="nmt-result-focus-topics">${conclusion.topics.map(topic => `<span>${escapeHtml(topic)}</span>`).join('')}</div>` : ''}
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
        <div><strong>${escapeHtml(item.topic_label)}</strong><small>${item.is_correct ? 'Правильно' : (item.user_answer === 'Не відповіли' ? 'Без відповіді' : 'Є помилка')}</small></div>
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

  function showKeyboardDone(shortWrap = null) {
    document.body.classList.add('keyboard-open');
    shortWrap?.classList.add('is-active');
    shortWrap?.querySelector('.nmt-short-actions')?.setAttribute('aria-hidden', 'false');
  }

  function hideKeyboardDone(shortWrap = null) {
    document.body.classList.remove('keyboard-open');
    shortWrap?.classList.remove('is-active');
    shortWrap?.querySelector('.nmt-short-actions')?.setAttribute('aria-hidden', 'true');
  }

  function ensureShortAnswerVisible(input) {
    if (!input?.classList?.contains('nmt-short-input')) return;
    const wrap = input.closest('.nmt-short-wrap');
    const scroller = content?.closest('.nmt-view');
    if (!wrap || !scroller) return;
    requestAnimationFrame(() => {
      const vv = window.visualViewport;
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const rect = wrap.getBoundingClientRect();
      const overflow = rect.bottom - (visibleBottom - 14);
      if (overflow > 0) scroller.scrollBy({ top: overflow + 16, behavior: 'smooth' });
    });
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
  window.visualViewport?.addEventListener('resize', () => {
    const active = document.activeElement;
    if (active?.classList?.contains('nmt-short-input')) ensureShortAnswerVisible(active);
  });

  document.addEventListener('pointerdown', (event) => {
    const active = document.activeElement;
    if (active?.classList?.contains('nmt-short-input') && event.target !== active && !event.target.closest?.('.nmt-inline-done')) {
      if (!event.target.closest('.nmt-short-input-shell') && !event.target.closest('.nmt-short-actions')) active.blur();
    }
  }, { passive: true });

  window.NMTExamController = {
    onViewOpen() {
      if (!state.checked) checkActive();
      if (!state.activeAttempt && !state.result) requestAnimationFrame(() => { if (nmtView) nmtView.scrollTop = 0; });
    },
  };
})();
