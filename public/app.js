const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();

  // Frontend працює окремо як Render Static Site.
  // API лишається на Web Service, який може засинати на Free-плані.
  const API_BASE = 'https://nmt-miniapp.onrender.com';
  const FETCH_TIMEOUT_MS = 30000;
  const QUESTION_TIMEOUT_MS = 55000;
  const BACKEND_WAKE_MAX_MS = 75000;
  const BUILD_VERSION = 'nmt-mode-v1.0.0';
  console.log('[NMT build]', BUILD_VERSION);

  async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  function setStartupStatus(title, subtitle) {
    const titleEl = document.querySelector('.startup-title');
    const subtitleEl = document.querySelector('.startup-subtitle');

    if (titleEl && title) titleEl.textContent = title;
    if (subtitleEl && subtitle) subtitleEl.textContent = subtitle;
  }

  async function waitForBackend() {
    const startedAt = Date.now();
    let attempt = 0;

    setStartupStatus('НМТ запускається…', 'Готуємо завдання для тебе ✨');

    while (Date.now() - startedAt < BACKEND_WAKE_MAX_MS) {
      attempt += 1;

      try {
        const res = await fetchWithTimeout(
          `${API_BASE}/api/topics?wake=${Date.now()}`,
          { cache: 'no-store' },
          12000
        );

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setStartupStatus('Майже готово…', 'Завантажуємо твою підготовку');
            return true;
          }
        }
      } catch (err) {
        // Поки Render прокидається, короткі тайм-аути — нормальні.
      }

      const elapsed = Date.now() - startedAt;

      if (elapsed > 8000) {
        setStartupStatus(
          'Сервер прокидається…',
          'Після перерви це може зайняти до хвилини'
        );
      }

      await new Promise((resolve) => setTimeout(resolve, Math.min(1200 + attempt * 250, 2500)));
    }

    throw new Error('Сервер не встиг запуститися. Спробуйте ще раз.');
  }

  const state = {
    correct: 0,
    wrong: 0,
    currentQuestion: null,
    selectedIndex: null,
    answered: false,
    questionQueue: [],
    batchPromise: null,
    batchTopic: null,
    batchToken: 0,
    currentView: 'tests',
    viewScroll: { tests: 0, nmt: 0, cheatsheet: 0, profile: 0 },
  };

  let profileLoaded = false;
  let profileDirty = true;

  const cardArea = document.getElementById('cardArea');
  const streakEl = document.getElementById('streak');
  const topicSelect = document.getElementById('topicSelect');
  const topicPicker = document.getElementById('topicPicker');
  const topicPickerIcon = document.getElementById('topicPickerIcon');
  const topicPickerTitle = document.getElementById('topicPickerTitle');
  const topicPickerSubtitle = document.getElementById('topicPickerSubtitle');
  const topicOverlay = document.getElementById('topicOverlay');
  const topicList = document.getElementById('topicList');
  const topicSheetClose = document.getElementById('topicSheetClose');
  const startupScreen = document.getElementById('startupScreen');
  const testView = document.getElementById('testView');
  const nmtView = document.getElementById('nmtView');
  const cheatView = document.getElementById('cheatView');
  const profileView = document.getElementById('profileView');
  const cheatList = document.getElementById('cheatList');
  const openOfficialPdf = document.getElementById('openOfficialPdf');
  const profileContent = document.getElementById('profileContent');
  const navIndicator = document.getElementById('navIndicator');
  const navItems = Array.from(document.querySelectorAll('.liquid-nav-item'));
  const appViewport = document.getElementById('appViewport');
  const VIEW_ORDER = ['tests', 'nmt', 'cheatsheet', 'profile'];
  const VIEW_MAP = { tests: testView, nmt: nmtView, cheatsheet: cheatView, profile: profileView };
  const reportOverlay = document.getElementById('reportOverlay');
  const reportClose = document.getElementById('reportClose');
  const reportReasons = document.getElementById('reportReasons');
  const toast = document.getElementById('toast');
  let startupHidden = false;

  applyInitialViewState();

  function applyInitialViewState() {
    applyViewPositions?.('tests');
    updateNavIndicator?.('tests');
  }

  function hideStartupScreen() {
    if (startupHidden || !startupScreen) return;
    startupHidden = true;
    startupScreen.classList.add('hide');
    setTimeout(() => startupScreen.remove(), 520);
  }

  function renderMathSafely(root, attempt = 0) {
    if (!root) return;

    if (typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(root, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false,
          strict: false,
        });
        return;
      } catch (err) {
        console.warn('KaTeX render error:', err);
      }
    }

    // CDN може завантажитися на долю секунди пізніше за основний HTML.
    if (attempt < 20) {
      setTimeout(() => renderMathSafely(root, attempt + 1), 120);
    }
  }


  const FALLBACK_TOPICS = [
    { key: 'mixed', label: '🎯 Змішані завдання НМТ' },
    { key: 'numbers', label: 'Числа та дроби' },
    { key: 'percents', label: 'Відсотки та пропорції' },
    { key: 'powers_roots', label: 'Степені та корені' },
    { key: 'logarithms', label: 'Логарифми' },
    { key: 'equations', label: 'Рівняння' },
    { key: 'inequalities', label: 'Нерівності' },
    { key: 'systems', label: 'Системи рівнянь і нерівностей' },
    { key: 'functions', label: 'Функції та графіки' },
    { key: 'progressions', label: 'Прогресії' },
    { key: 'trigonometry', label: 'Тригонометрія' },
    { key: 'calculus', label: 'Похідна та інтеграл' },
    { key: 'probability_stats', label: 'Ймовірність, комбінаторика та статистика' },
    { key: 'planimetry', label: 'Планіметрія' },
    { key: 'stereometry', label: 'Стереометрія' },
    { key: 'word_problems', label: 'Текстові задачі' },
  ];

  const TOPIC_UI = {
    mixed: { icon: '🎯', subtitle: 'Завдання з усіх тем НМТ' },
    numbers: { icon: '123', subtitle: 'Числа, дроби та обчислення' },
    percents: { icon: '%', subtitle: 'Відсотки, пропорції та практичні задачі' },
    powers_roots: { icon: '√', subtitle: 'Степені, корені та перетворення' },
    logarithms: { icon: 'log', subtitle: 'Логарифми, властивості та рівняння' },
    equations: { icon: 'x=', subtitle: 'Лінійні, квадратні та інші рівняння' },
    inequalities: { icon: '≠', subtitle: 'Нерівності та метод інтервалів' },
    systems: { icon: '{}', subtitle: 'Системи рівнянь і нерівностей' },
    functions: { icon: 'f(x)', subtitle: 'Функції, графіки та їх властивості' },
    progressions: { icon: 'Σ', subtitle: 'Арифметична та геометрична прогресії' },
    trigonometry: { icon: 'sin', subtitle: 'sin, cos, tg і задачі з трикутниками' },
    calculus: { icon: "f′", subtitle: 'Похідна, первісна та інтеграл' },
    probability_stats: { icon: 'P', subtitle: 'Ймовірність, комбінаторика та статистика' },
    planimetry: { icon: '△', subtitle: 'Геометрія на площині' },
    stereometry: { icon: '◇', subtitle: 'Об’єми та геометрія у просторі' },
    word_problems: { icon: '→', subtitle: 'Рух, робота, суміші та моделювання' },
  };

  let loadedTopics = [];

  function updateStreak() {
    streakEl.textContent = `✅ ${state.correct} · ❌ ${state.wrong}`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function formatJoinDate(value) {
    if (!value) return 'Профіль НМТ';
    try {
      return 'З нами з ' + new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date(value));
    } catch (_) {
      return 'Профіль НМТ';
    }
  }

  function applyViewPositions(target) {
    const targetIndex = VIEW_ORDER.indexOf(target);
    VIEW_ORDER.forEach((name, index) => {
      const page = VIEW_MAP[name];
      if (!page) return;
      page.classList.toggle('is-left', index < targetIndex);
      page.classList.toggle('is-center', index === targetIndex);
      page.classList.toggle('is-right', index > targetIndex);
      page.classList.toggle('active', index === targetIndex);
      page.setAttribute('aria-hidden', index === targetIndex ? 'false' : 'true');
    });
  }

  function updateNavIndicator(target) {
    const activeBtn = navItems.find((btn) => btn.dataset.view === target) || navItems[0];

    navItems.forEach((btn) => {
      const active = btn === activeBtn;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    if (navIndicator && activeBtn) {
      requestAnimationFrame(() => {
        const track = activeBtn.parentElement;
        const baseLeft = 6;
        const x = Math.max(0, activeBtn.offsetLeft - baseLeft);
        navIndicator.style.width = `${activeBtn.offsetWidth}px`;
        navIndicator.style.transform = `translate3d(${x}px,0,0)`;
      });
    }
  }

  function switchView(viewName) {
    const target = VIEW_ORDER.includes(viewName) ? viewName : 'tests';
    if (target === state.currentView) return;

    const currentPage = VIEW_MAP[state.currentView];
    if (currentPage) state.viewScroll[state.currentView] = currentPage.scrollTop || 0;

    applyViewPositions(target);
    updateNavIndicator(target);
    state.currentView = target;
    tg?.HapticFeedback?.selectionChanged?.();

    const targetPage = VIEW_MAP[target];
    requestAnimationFrame(() => {
      if (targetPage) targetPage.scrollTop = state.viewScroll[target] || 0;
    });

    if (target === 'profile') loadProfilePage();
    if (target === 'nmt') window.NMTExamController?.onViewOpen?.();
  }

  async function loadProfilePage() {
    if (profileLoaded && !profileDirty) return;
    if (!profileLoaded) {
      profileContent.innerHTML = `<div class="profile-page-loading"><div class="spinner"></div><span>Завантажуємо профіль…</span></div>`;
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg?.initData || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося завантажити профіль');

      const initial = (data.first_name || 'У').trim().charAt(0).toUpperCase();
      const photoUrl = tg?.initDataUnsafe?.user?.photo_url || '';
      const avatarMarkup = photoUrl
        ? `<img src="${escapeHtml(photoUrl)}" alt="" referrerpolicy="no-referrer">`
        : escapeHtml(initial);

      const accuracy = Math.max(0, Math.min(100, Number(data.accuracy) || 0));
      const streak = Math.max(0, Number(data.streak) || 0);
      const bestStreak = Math.max(streak, Number(data.best_streak) || 0);

      const topicRows = Array.isArray(data.topic_stats) && data.topic_stats.length
        ? data.topic_stats.map((row) => {
            const rowAccuracy = Math.max(0, Math.min(100, Number(row.accuracy) || 0));
            const rowTotal = Number(row.total) || 0;
            const rowCorrect = Number(row.correct) || 0;
            return `
              <div class="topic-stat-row-new">
                <div class="topic-stat-top-new">
                  <span>${escapeHtml(stripLeadingEmoji(row.label || row.topic))}</span>
                  <strong>${rowAccuracy}%</strong>
                </div>
                <div class="topic-stat-meta">${rowCorrect} правильних із ${rowTotal}</div>
                <div class="topic-stat-bar-new"><div class="topic-stat-fill-new" style="width:${rowAccuracy}%"></div></div>
              </div>`;
          }).join('')
        : `<div class="topic-stat-row-new"><div class="topic-stat-top-new"><span>Статистика по темах</span><strong>—</strong></div><div class="topic-stat-meta">З’явиться після кількох відповідей</div></div>`;

      profileContent.innerHTML = `
        <div class="profile-hero-new glass-card">
          <div class="profile-avatar-new">${avatarMarkup}</div>
          <div class="profile-identity">
            <div class="profile-name-new">${escapeHtml(data.first_name || 'Учень')}</div>
            <div class="profile-since-new">${escapeHtml(formatJoinDate(data.created_at))}</div>
            <div class="profile-streak-pill">🔥 ${streak} ${streak === 1 ? 'день' : 'днів'} поспіль</div>
          </div>
        </div>

        <div class="profile-highlight-grid">
          <div class="profile-highlight glass-card">
            <div class="highlight-kicker">Поточна серія</div>
            <div class="streak-number">${streak}<span> днів</span></div>
            <div class="highlight-note">Найкраща серія: ${bestStreak} дн.</div>
          </div>
          <div class="profile-highlight glass-card">
            <div class="highlight-kicker">Точність</div>
            <div class="accuracy-ring" style="--accuracy:${accuracy}"><strong>${accuracy}%</strong></div>
          </div>
        </div>

        <div class="profile-stat-grid-new">
          <div class="profile-stat-new glass-card"><strong>${Number(data.total) || 0}</strong><span>завдань</span></div>
          <div class="profile-stat-new glass-card"><strong>${Number(data.correct) || 0}</strong><span>правильно</span></div>
          <div class="profile-stat-new glass-card"><strong>${Number(data.wrong) || 0}</strong><span>помилок</span></div>
        </div>

        <div class="profile-topic-section glass-card">
          <div class="profile-topic-head"><h3>Результати за темами</h3><span>${Array.isArray(data.topic_stats) ? data.topic_stats.length : 0} тем</span></div>
          <div class="topic-stat-list-new">${topicRows}</div>
        </div>`;
      profileLoaded = true;
      profileDirty = false;
    } catch (err) {
      if (!profileLoaded) profileContent.innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
    }
  }

  function openReport() {
    reportOverlay.classList.add('show');
    reportOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeReport() {
    reportOverlay.classList.remove('show');
    reportOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function submitReport(reason) {
    if (!state.currentQuestion) return;
    closeReport();
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/report-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg?.initData || null,
          questionBankId: state.currentQuestion.bank_id || null,
          reason,
          question: state.currentQuestion,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.saved) throw new Error(data.error || 'Не вдалося надіслати');
      showToast('Дякуємо — перевіримо це завдання');
      tg?.HapticFeedback?.notificationOccurred?.('success');
    } catch (err) {
      showToast('Не вдалося надіслати скаргу');
    }
  }

  async function requestAiHelp(mode) {
    const q = state.currentQuestion;
    if (!q) return;
    const buttons = cardArea.querySelectorAll('.ai-chip');
    buttons.forEach((b) => b.disabled = true);
    const result = document.getElementById('aiHelpResult');
    if (result) {
      result.classList.add('show');
      result.innerHTML = `<div class="status" style="min-height:90px"><div class="spinner"></div><span>AI готує пояснення…</span></div>`;
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/explain-more`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg?.initData || null,
          mode,
          topic: q.topic || topicSelect.value,
          difficulty: q.difficulty || 'середній',
          question: {
            question: q.question,
            options: q.options,
            correct_index: q.correct_index,
            selected_index: state.selectedIndex,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка AI');

      if (mode === 'similar' && data.question) {
        clearPrefetch();
        await showQuestionSmooth(data.question);
        return;
      }

      const steps = Array.isArray(data.steps) ? data.steps : [];
      result.innerHTML = `<h4>${escapeHtml(data.title || 'Пояснення')}</h4><ol>${steps.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ol>`;
      renderMathSafely(result);
    } catch (err) {
      if (result) result.innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
    } finally {
      cardArea.querySelectorAll('.ai-chip').forEach((b) => b.disabled = false);
    }
  }

  function renderLoading(message) {
    cardArea.innerHTML = `
      <div class="question-skeleton" aria-busy="true">
        <div class="skeleton-line kicker"></div>
        <div class="skeleton-line q1"></div>
        <div class="skeleton-line q2"></div>
        <div class="skeleton-option"></div>
        <div class="skeleton-option"></div>
        <div class="skeleton-option"></div>
        <div class="skeleton-option"></div>
        <div class="skeleton-status" id="questionLoadingText">${escapeHtml(message)}</div>
      </div>`;
  }

  function beginQuestionLoadingMessages(forceFresh = false) {
    const timers = [];
    const update = (text) => {
      const el = document.getElementById('questionLoadingText');
      if (el) el.textContent = text;
    };

    timers.push(setTimeout(() => update('Перевіряємо правильність завдання…'), 5500));
    timers.push(setTimeout(() => update('Підбираємо найточніший варіант…'), 12500));
    timers.push(setTimeout(() => update(forceFresh ? 'Створюємо інше перевірене завдання…' : 'Ще кілька секунд — завершуємо перевірку…'), 24000));

    return () => timers.forEach(clearTimeout);
  }

  function renderError(message) {
    hideStartupScreen();
    cardArea.innerHTML = `
      <div class="card">
        <div class="error-box">${message}</div>
        <button class="primary-btn" id="retryBtn">Спробувати ще раз</button>
      </div>`;
    document.getElementById('retryBtn').addEventListener('click', loadQuestion);
  }

  function getExplanationSteps(q) {
    if (Array.isArray(q?.explanation_steps) && q.explanation_steps.length) {
      return q.explanation_steps;
    }

    if (typeof q?.explanation === 'string' && q.explanation.trim()) {
      const parts = q.explanation
        .split(/\n+|(?=\s*\d+[.)]\s+)/)
        .map((part) => part.replace(/^\s*\d+[.)]\s*/, '').trim())
        .filter(Boolean);

      return parts.length ? parts : [q.explanation.trim()];
    }

    return ['Розв’язання для цього завдання не надійшло.'];
  }

  function showQuestionSmooth(q, { immediate = false } = {}) {
    const currentCard = cardArea.querySelector('.card');
    if (immediate || !currentCard) {
      renderQuestion(q);
      return Promise.resolve();
    }

    currentCard.classList.add('card-exit-v2');
    return new Promise((resolve) => {
      setTimeout(() => {
        renderQuestion(q);
        resolve();
      }, 105);
    });
  }

  function setCurrentCardWaiting(waiting, text = 'Готуємо наступне…') {
    const card = cardArea.querySelector('.card');
    const btn = document.getElementById('checkBtn');
    if (card) card.classList.toggle('card-soft-wait', !!waiting);
    if (btn && state.answered) {
      btn.disabled = !!waiting;
      btn.textContent = waiting ? text : 'Наступне завдання →';
    }
  }

  function renderQuestion(q) {
    hideStartupScreen();
    state.currentQuestion = q;
    state.selectedIndex = null;
    state.answered = false;

    if (q.progress) {
      state.correct = Number(q.progress.correct) || 0;
      state.wrong = Number(q.progress.wrong) || 0;
      updateStreak();
      console.log('PROGRESS LOADED:', q.progress);
    }

    const letters = ['А', 'Б', 'В', 'Г', 'Д'];
    const explanationSteps = getExplanationSteps(q);

    cardArea.innerHTML = `
      <div class="card card-enter">
        <div class="card-top">
          <div class="card-label">${topicSelect.options[topicSelect.selectedIndex]?.text || ''}</div>
          <button class="report-btn" id="reportBtn" type="button" aria-label="Повідомити про проблему">⚑</button>
        </div>
        <div class="question-text">${escapeHtml(q.question)}</div>
        <div class="options">
          ${q.options.map((opt, i) => `
            <button class="option" data-index="${i}" type="button">
              <span class="option-letter">${letters[i]}</span>
              <span>${escapeHtml(opt)}</span>
            </button>
          `).join('')}
        </div>
        <div class="explanation" id="explanation">
          <div class="explanation-title">
            <span class="explanation-title-icon">✦</span>
            <span>Розв’язання</span>
          </div>
          <ol class="explanation-steps">
            ${explanationSteps.map((step) => `
              <li class="explanation-step">${escapeHtml(step)}</li>
            `).join('')}
          </ol>
          <div class="ai-help" id="aiHelp">
            <div class="ai-help-title">Потрібна ще допомога?</div>
            <div class="ai-help-actions">
              <button class="ai-chip" type="button" data-ai-mode="simple">✨ Поясни простіше</button>
              <button class="ai-chip" type="button" data-ai-mode="why_wrong">💬 Чому моя відповідь неправильна?</button>
              <button class="ai-chip" type="button" data-ai-mode="similar">↗ Дай схоже завдання</button>
            </div>
            <div class="ai-help-result" id="aiHelpResult"></div>
          </div>
        </div>
        <div class="action-stack">
          <button class="primary-btn" id="checkBtn" type="button" disabled>Перевірити відповідь</button>
          <button class="secondary-btn" id="regenerateBtn" type="button">↻ Перегенерувати завдання</button>
        </div>
      </div>`;

    renderMathSafely(cardArea);

    cardArea.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => selectAnswer(Number(btn.dataset.index)));
    });

    document.getElementById('checkBtn').addEventListener('click', () => {
      if (state.answered) loadQuestion();
      else submitAnswer();
    });

    document.getElementById('regenerateBtn').addEventListener('click', () => {
      tg?.HapticFeedback?.impactOccurred?.('light');
      clearPrefetch();
      loadQuestion({ forceFresh: true });
    });

    document.getElementById('reportBtn')?.addEventListener('click', openReport);

    cardArea.querySelectorAll('.ai-chip').forEach((btn) => {
      btn.addEventListener('click', () => requestAiHelp(btn.dataset.aiMode));
    });

    // V2: починаємо готувати наступне питання одразу, поки учень думає над поточним.
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 180));
    idle(() => prefetchNextQuestion(), { timeout: 900 });
  }

  function selectAnswer(selectedIndex) {
    if (state.answered) return;

    state.selectedIndex = selectedIndex;
    const options = cardArea.querySelectorAll('.option');

    options.forEach((btn) => {
      btn.classList.toggle('selected', Number(btn.dataset.index) === selectedIndex);
    });

    const checkBtn = document.getElementById('checkBtn');
    checkBtn.disabled = false;
    checkBtn.textContent = 'Перевірити відповідь';

    tg?.HapticFeedback?.selectionChanged?.();
  }

  async function submitAnswer() {
    if (state.answered || state.selectedIndex === null) return;

    state.answered = true;

    const selectedIndex = state.selectedIndex;
    const q = state.currentQuestion;
    const options = cardArea.querySelectorAll('.option');
    const checkBtn = document.getElementById('checkBtn');
    const regenerateBtn = document.getElementById('regenerateBtn');

    checkBtn.disabled = true;
    regenerateBtn.disabled = true;
    options.forEach((btn) => {
      btn.disabled = true;
      btn.classList.remove('selected');
    });

    const isCorrect = selectedIndex === q.correct_index;

    options[selectedIndex].classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) options[q.correct_index].classList.add('correct');

    if (isCorrect) {
      tg?.HapticFeedback?.notificationOccurred('success');
    } else {
      tg?.HapticFeedback?.notificationOccurred('error');
    }

    profileDirty = true;
    prefetchNextQuestion();

    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg?.initData || null,
          isCorrect,
          topic: q.topic || topicSelect.value,
          questionBankId: q.bank_id || null
        }),
      });

      const data = await res.json();

      if (data.saved) {
        state.correct = Number(data.correct_count) || 0;
        state.wrong = Number(data.wrong_count) || 0;
      } else {
        if (isCorrect) state.correct++;
        else state.wrong++;
      }
    } catch (err) {
      console.warn('Не вдалося зберегти відповідь:', err);
      if (isCorrect) state.correct++;
      else state.wrong++;
    }

    updateStreak();

    document.getElementById('explanation').classList.add('show');
    document.getElementById('aiHelp')?.classList.add('show');
    const whyWrongBtn = cardArea.querySelector('[data-ai-mode="why_wrong"]');
    if (whyWrongBtn && isCorrect) whyWrongBtn.style.display = 'none';
    renderMathSafely(document.getElementById('explanation'));

    checkBtn.disabled = false;
    checkBtn.textContent = 'Наступне завдання →';
    regenerateBtn.disabled = false;
    regenerateBtn.textContent = '↻ Інше завдання';
  }

  function clearQuestionQueue() {
    state.batchToken += 1;
    state.questionQueue = [];
    state.batchPromise = null;
    state.batchTopic = null;
  }

  // Compatibility with older handlers in this file.
  function clearPrefetch() { clearQuestionQueue(); }

  async function requestQuestionBatch(count = 4) {
    const topic = topicSelect.value;
    const res = await fetchWithTimeout(`${API_BASE}/api/questions-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        difficulty: 'середній',
        initData: tg?.initData || null,
        count: Math.max(1, Math.min(5, Number(count) || 4)),
      }),
    }, QUESTION_TIMEOUT_MS);

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не вдалося підготувати завдання.');
    return data;
  }

  function ensureQuestionQueue(targetSize = 4) {
    const topic = topicSelect.value;
    if (state.batchTopic && state.batchTopic !== topic) clearQuestionQueue();
    if (state.questionQueue.length >= targetSize) return Promise.resolve(state.questionQueue);
    if (state.batchPromise && state.batchTopic === topic) return state.batchPromise;

    const token = ++state.batchToken;
    state.batchTopic = topic;
    const need = Math.max(1, Math.min(5, targetSize - state.questionQueue.length));

    state.batchPromise = requestQuestionBatch(need)
      .then((payload) => {
        if (token !== state.batchToken || topic !== topicSelect.value) return state.questionQueue;
        const questions = Array.isArray(payload?.questions) ? payload.questions : [];
        const seen = new Set(state.questionQueue.map((q) => q.question));
        for (const q of questions) {
          if (!q?.question || seen.has(q.question)) continue;
          q.progress = payload.progress || q.progress || { correct: state.correct, wrong: state.wrong };
          state.questionQueue.push(q);
          seen.add(q.question);
        }
        return state.questionQueue;
      })
      .catch((err) => {
        console.warn('Batch prefetch skipped:', err.message);
        throw err;
      })
      .finally(() => {
        if (token === state.batchToken) state.batchPromise = null;
      });

    return state.batchPromise;
  }

  function prefetchNextQuestion() {
    if (state.questionQueue.length < 3) {
      ensureQuestionQueue(5).catch(() => {});
    }
  }

  async function loadQuestion(options = {}) {
    const hasVisibleCard = !!cardArea.querySelector('.card') && !!state.currentQuestion;

    if (options.forceFresh) {
      clearQuestionQueue();
    }

    if (state.questionQueue.length) {
      const ready = state.questionQueue.shift();
      ready.progress = { correct: state.correct, wrong: state.wrong };
      await showQuestionSmooth(ready, { immediate: !hasVisibleCard });
      prefetchNextQuestion();
      return;
    }

    if (hasVisibleCard) {
      setCurrentCardWaiting(true, options.forceFresh ? 'Створюємо інше…' : 'Готуємо наступне…');
    } else {
      renderLoading(options.forceFresh ? 'Створюємо інше завдання…' : 'Готуємо завдання…');
    }

    const stopLoadingMessages = hasVisibleCard ? (() => {}) : beginQuestionLoadingMessages(!!options.forceFresh);

    try {
      await ensureQuestionQueue(options.forceFresh ? 3 : 4);
      const ready = state.questionQueue.shift();
      if (!ready) throw new Error('Сервер не повернув готового завдання.');
      ready.progress = { correct: state.correct, wrong: state.wrong };
      setCurrentCardWaiting(false);
      await showQuestionSmooth(ready, { immediate: !hasVisibleCard });
      prefetchNextQuestion();
    } catch (err) {
      setCurrentCardWaiting(false);
      renderError(err?.name === 'AbortError'
        ? 'Підготовка зайняла надто довго. Натисни «Спробувати ще раз».'
        : (err?.message || 'Немає з’єднання з сервером. Спробуйте ще раз.'));
    } finally {
      stopLoadingMessages();
    }
  }



  const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function getTelegramInitData() {
    // Чекаємо до 3 секунд, поки Telegram віддасть initData
    for (let i = 0; i < 30; i++) {
      const initData = tg?.initData || '';

      if (initData.length > 0) {
        console.log('Telegram initData ready:', initData.length);
        return initData;
      }

      await sleepMs(100);
    }

    return tg?.initData || '';
  }

  async function loadProgress() {
    try {
      const initData = await getTelegramInitData();

      console.log('LOAD PROGRESS initData:', initData.length);

      if (!initData) {
        console.warn('Telegram initData порожній — прогрес поки не завантажено');
        return false;
      }

      const res = await fetchWithTimeout(`${API_BASE}/api/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initData
        }),
      });

      const data = await res.json();

      console.log('PROGRESS FROM SERVER:', data);

      if (!res.ok) {
        throw new Error('Помилка /api/progress');
      }

      state.correct = Number(data.correct ?? 0);
      state.wrong = Number(data.wrong ?? 0);

      updateStreak();

      return true;

    } catch (err) {
      console.error('Помилка завантаження прогресу:', err);
      return false;
    }
  }

  function getTopicUi(key) {
    return TOPIC_UI[key] || { icon: '•', subtitle: 'Тренування в межах програми НМТ' };
  }

  function stripLeadingEmoji(label = '') {
    return label.replace(/^🎯\s*/, '').trim();
  }

  function syncTopicPicker() {
    const selected = loadedTopics.find((t) => t.key === topicSelect.value) || loadedTopics[0];
    if (!selected) return;

    const ui = getTopicUi(selected.key);
    topicPickerIcon.textContent = ui.icon;
    topicPickerTitle.textContent = stripLeadingEmoji(selected.label);
    topicPickerSubtitle.textContent = ui.subtitle;

    topicList.querySelectorAll('.topic-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.key === selected.key);
    });
  }

  function renderTopicList() {
    topicList.innerHTML = loadedTopics.map((t) => {
      const ui = getTopicUi(t.key);
      return `
        <button class="topic-item" type="button" data-key="${escapeHtml(t.key)}">
          <span class="topic-item-icon">${escapeHtml(ui.icon)}</span>
          <span class="topic-item-copy">
            <span class="topic-item-title">${escapeHtml(stripLeadingEmoji(t.label))}</span>
            <span class="topic-item-subtitle">${escapeHtml(ui.subtitle)}</span>
          </span>
          <span class="topic-item-check">✓</span>
        </button>`;
    }).join('');

    topicList.querySelectorAll('.topic-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.key === topicSelect.value) {
          closeTopicSheet();
          return;
        }

        topicSelect.value = btn.dataset.key;
        clearPrefetch();
        try { localStorage.setItem('nmt_topic', topicSelect.value); } catch (_) {}
        syncTopicPicker();
        closeTopicSheet();
        tg?.HapticFeedback?.selectionChanged?.();
        await loadQuestion();
      });
    });

    syncTopicPicker();
  }

  function openTopicSheet() {
    topicOverlay.classList.add('show');
    topicOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    syncTopicPicker();
  }

  function closeTopicSheet() {
    topicOverlay.classList.remove('show');
    topicOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  topicPicker.addEventListener('click', openTopicSheet);
  topicSheetClose.addEventListener('click', closeTopicSheet);
  topicOverlay.addEventListener('click', (event) => {
    if (event.target === topicOverlay) closeTopicSheet();
  });


  function primeCheatMath() {
    const sections = Array.from(document.querySelectorAll('.cheat-section'));
    let index = 0;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 120));

    const renderNext = (deadline) => {
      while (index < sections.length && (deadline?.timeRemaining?.() > 3 || !window.requestIdleCallback)) {
        const inner = sections[index++].querySelector('.cheat-formulas-inner');
        if (inner && inner.dataset.mathReady !== '1') {
          renderMathSafely(inner);
          inner.dataset.mathReady = '1';
        }
        // На fallback рендеримо лише одну секцію за тик.
        if (!window.requestIdleCallback) break;
      }
      if (index < sections.length) idle(renderNext, { timeout: 900 });
    };

    idle(renderNext, { timeout: 1200 });
  }

  function closeCheatSection(section) {
    if (!section?.classList.contains('open')) return;
    section.classList.remove('open');
    section.querySelector('.cheat-section-btn')?.setAttribute('aria-expanded', 'false');
  }

  function openCheatSection(section) {
    if (!section || section.classList.contains('open')) return;

    cheatList?.querySelectorAll('.cheat-section.open').forEach((other) => {
      if (other !== section) closeCheatSection(other);
    });

    const btn = section.querySelector('.cheat-section-btn');
    const inner = section.querySelector('.cheat-formulas-inner');
    if (!inner) return;

    // Спочатку відкриваємо секцію — UI реагує миттєво. KaTeX доганяє в наступному кадрі.
    section.classList.add('open');
    btn?.setAttribute('aria-expanded', 'true');

    if (inner.dataset.mathReady !== '1') {
      requestAnimationFrame(() => {
        renderMathSafely(inner);
        inner.dataset.mathReady = '1';
      });
    }
  }

  document.querySelectorAll('.cheat-section-btn').forEach((btn) => {
    btn.addEventListener('pointerdown', () => {
      const inner = btn.closest('.cheat-section')?.querySelector('.cheat-formulas-inner');
      if (inner && inner.dataset.mathReady !== '1') {
        renderMathSafely(inner);
        inner.dataset.mathReady = '1';
      }
    }, { passive: true });

    btn.addEventListener('click', () => {
      const section = btn.closest('.cheat-section');
      if (!section) return;
      const isOpen = section.classList.contains('open');
      tg?.HapticFeedback?.selectionChanged?.();
      if (isOpen) closeCheatSection(section);
      else openCheatSection(section);
    });
  });


  openOfficialPdf?.addEventListener('click', () => {
    const url = 'https://testportal.gov.ua/wp-content/uploads/2022/04/ZNO_Math_dovidkovy-materialy.pdf';
    tg?.HapticFeedback?.impactOccurred?.('light');
    if (tg?.openLink) tg.openLink(url, { try_instant_view: false });
    else window.open(url, '_blank', 'noopener,noreferrer');
  });

  // Telegram Mini App should behave like an app, not a zoomable website.
  document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view || 'tests'));
  });

  window.addEventListener('resize', () => updateNavIndicator(state.currentView), { passive: true });
  reportClose.addEventListener('click', closeReport);
  reportOverlay.addEventListener('click', (event) => { if (event.target === reportOverlay) closeReport(); });
  reportReasons.querySelectorAll('.report-reason').forEach((btn) => {
    btn.addEventListener('click', () => submitReport(btn.dataset.reason || 'Інше'));
  });

  async function loadTopics() {
    let topics = FALLBACK_TOPICS;

    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/topics?v=3`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Помилка /api/topics');

      const freshTopics = await res.json();
      if (Array.isArray(freshTopics) && freshTopics.some((t) => t.key === 'logarithms')) {
        topics = freshTopics;
      } else {
        console.warn('Отримано застарілий список тем — використовую актуальний локальний список.');
      }
    } catch (err) {
      console.error('Помилка завантаження тем:', err);
    }

    loadedTopics = topics;
    topicSelect.innerHTML = loadedTopics
      .map((t) => `<option value="${escapeHtml(t.key)}">${escapeHtml(t.label)}</option>`)
      .join('');

    let savedTopic = '';
    try { savedTopic = localStorage.getItem('nmt_topic') || ''; } catch (_) {}

    if (savedTopic && loadedTopics.some((t) => t.key === savedTopic)) {
      topicSelect.value = savedTopic;
    } else if (loadedTopics.some((t) => t.key === 'mixed')) {
      topicSelect.value = 'mixed';
    }

    renderTopicList();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  (async function init() {
    try {
      // Static Site відкривається одразу, а тут у фоні будимо Web Service.
      // Поки він прокидається, користувач бачить наш startup screen, а не Render.
      await waitForBackend();

      await loadTopics();

      // Спочатку намагаємось підтягнути збережений прогрес
      const progressLoaded = await loadProgress();

      // Одним запитом беремо відразу кілька завдань; перше показуємо, решта лишаються в буфері.
      await ensureQuestionQueue(4);
      await loadQuestion();

      // Після першого paint тихо прогріваємо важчі екрани у фоні.
      const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 500));

      // Якщо Telegram не встиг віддати initData —
      // пробуємо підтягнути прогрес ще раз
      if (!progressLoaded) {
        await loadProgress();
      }
    } catch (err) {
      console.error('INIT ERROR:', err);
      renderError(err?.message || 'Не вдалося запустити застосунок. Спробуйте ще раз.');
    }
  })();
