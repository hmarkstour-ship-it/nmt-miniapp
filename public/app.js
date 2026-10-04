const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();

  function syncTelegramTheme() {
    // v1.0.5: NMT landing info-note contrast hotfix (based on v1.0.4).
    document.documentElement.style.colorScheme = 'dark';
    document.body?.classList.remove('telegram-dark');
    document.body?.classList.add('fixed-premium-theme');
    try { tg?.setHeaderColor?.('#17191d'); } catch (_) {}
    try { tg?.setBackgroundColor?.('#17191d'); } catch (_) {}
    try { tg?.setBottomBarColor?.('#17191d'); } catch (_) {}
  }
  syncTelegramTheme();
  tg?.onEvent?.('themeChanged', syncTelegramTheme);

  // Frontend працює окремо як Render Static Site.
  // API лишається на Web Service, який може засинати на Free-плані.
  const API_BASE = 'https://nmt-miniapp.onrender.com';
  const FETCH_TIMEOUT_MS = 30000;
  const QUESTION_TIMEOUT_MS = 55000;
  const BACKEND_WAKE_MAX_MS = 75000;
  const BUILD_VERSION = 'launch-polish-v1.0.5';
  const APP_VERSION = '1.0.5';
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

    setStartupStatus('НМТ запускається…', 'Готуємо твою підготовку');

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

    throw new Error('Сервер не встиг запуститися. Спробуй ще раз.');
  }

  const state = {
    correct: 0,
    wrong: 0,
    currentQuestion: null,
    selectedIndex: null,
    answered: false,
    questionShownAtMs: null,
    questionQueue: [],
    batchPromise: null,
    batchTopic: null,
    batchToken: 0,
    currentView: 'tests',
    viewScroll: { tests: 0, nmt: 0, cheatsheet: 0, profile: 0 },
  };

  let profileLoaded = false;
  let profileDirty = true;
  window.addEventListener('nmt:finished', () => { profileDirty = true; });

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
  const onboardingOverlay = document.getElementById('onboardingOverlay');
  const onboardingStage = document.getElementById('onboardingStage');
  const onboardingProgress = document.getElementById('onboardingProgress');
  const onboardingSkip = document.getElementById('onboardingSkip');
  const onboardingBack = document.getElementById('onboardingBack');
  const onboardingNext = document.getElementById('onboardingNext');
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
    if (!root) return false;

    if (window.NMTMath?.render) {
      const ok = window.NMTMath.render(root);
      if (ok) return true;
    }

    // CDN може завантажитися на долю секунди пізніше за основний HTML.
    if (attempt < 20 && typeof window.renderMathInElement !== 'function') {
      setTimeout(() => renderMathSafely(root, attempt + 1), 120);
      return false;
    }

    return false;
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
    mixed: { icon: 'NMT', subtitle: 'Завдання з усіх тем НМТ' },
    numbers: { icon: '123', subtitle: 'Числа, дроби та обчислення' },
    percents: { icon: '%', subtitle: 'Відсотки, пропорції та практичні задачі' },
    powers_roots: { icon: '√', subtitle: 'Степені, корені та перетворення' },
    logarithms: { icon: 'log', subtitle: 'Логарифми, властивості та рівняння' },
    equations: { icon: 'x', subtitle: 'Лінійні, квадратні та інші рівняння' },
    inequalities: { icon: '≤', subtitle: 'Нерівності та метод інтервалів' },
    systems: { icon: '{ }', subtitle: 'Системи рівнянь і нерівностей' },
    functions: { icon: 'f', subtitle: 'Функції, графіки та їхні властивості' },
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
    streakEl.innerHTML = `<span>✓ ${state.correct}</span><i></i><span>× ${state.wrong}</span>`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  const ONBOARDING_VERSION = 'launch-v1';
  const ONBOARDING_SLIDES = [
    {
      icon: '∞',
      eyebrow: 'Тести',
      title: 'Тренуйся без кінця',
      text: 'Отримуй змішані завдання з усієї програми НМТ. Ми спеціально чергуємо теми й структури, щоб тренування не перетворювалось на заучування шаблонів.',
    },
    {
      icon: '1·2·3',
      eyebrow: 'Пояснення',
      title: 'Коротко й по кроках',
      text: 'Після відповіді бачиш короткий розв’язок у 2–4 кроки. Якщо щось незрозуміло — попроси пояснити простіше або детальніше.',
    },
    {
      icon: '22',
      eyebrow: 'Пробний НМТ',
      title: 'Перевір себе в режимі тесту',
      text: '22 завдання, таймер, збереження прогресу й повний розбір після завершення — без підказок під час проходження.',
    },
  ];
  let onboardingIndex = 0;
  let onboardingManual = false;

  function onboardingStorageKey() {
    const id = tg?.initDataUnsafe?.user?.id || 'local';
    return `nmt_onboarding_${ONBOARDING_VERSION}_${id}`;
  }

  function hasCompletedOnboarding() {
    try { return localStorage.getItem(onboardingStorageKey()) === '1'; }
    catch (_) { return false; }
  }

  function markOnboardingDone() {
    try { localStorage.setItem(onboardingStorageKey(), '1'); } catch (_) {}
  }

  function onboardingIllustration(index) {
    const illustrations = [
      `<svg viewBox="0 0 360 280" role="img" aria-label="Нескінченні змішані тести">
        <defs>
          <linearGradient id="obGoldA" x1="0" x2="1"><stop stop-color="#C6A15B"/><stop offset="1" stop-color="#D5B56E"/></linearGradient>
        </defs>
        <rect x="48" y="20" width="264" height="240" rx="34" fill="#25282E" stroke="rgba(255,255,255,.08)"/>
        <rect x="76" y="50" width="90" height="16" rx="8" fill="rgba(214,179,106,.18)"/>
        <rect x="76" y="86" width="194" height="12" rx="6" fill="#555960"/>
        <rect x="76" y="108" width="160" height="12" rx="6" fill="#3A3E45"/>
        <rect x="76" y="148" width="208" height="44" rx="15" fill="#2B2F35" stroke="rgba(255,255,255,.07)"/>
        <circle cx="100" cy="170" r="10" fill="url(#obGoldA)"/>
        <rect x="121" y="164" width="118" height="12" rx="6" fill="#62666D"/>
        <path d="M118 221h124" stroke="#3E4249" stroke-width="12" stroke-linecap="round"/>
        <path d="M118 221h78" stroke="url(#obGoldA)" stroke-width="12" stroke-linecap="round"/>
        <circle cx="280" cy="50" r="26" fill="rgba(214,179,106,.13)"/>
        <path d="M269 50h22M280 39v22" stroke="#C6A15B" stroke-width="4" stroke-linecap="round"/>
      </svg>`,
      `<svg viewBox="0 0 360 280" role="img" aria-label="Коротке пояснення по кроках">
        <rect x="43" y="23" width="274" height="234" rx="34" fill="#25282E" stroke="rgba(255,255,255,.08)"/>
        <circle cx="87" cy="74" r="17" fill="rgba(214,179,106,.16)"/><text x="87" y="80" text-anchor="middle" font-size="16" font-family="Arial" font-weight="700" fill="#D5B56E">1</text>
        <rect x="119" y="67" width="150" height="13" rx="6.5" fill="#565A61"/>
        <circle cx="87" cy="128" r="17" fill="rgba(214,179,106,.16)"/><text x="87" y="134" text-anchor="middle" font-size="16" font-family="Arial" font-weight="700" fill="#D5B56E">2</text>
        <rect x="119" y="121" width="120" height="13" rx="6.5" fill="#565A61"/>
        <circle cx="87" cy="182" r="17" fill="rgba(214,179,106,.16)"/><text x="87" y="188" text-anchor="middle" font-size="16" font-family="Arial" font-weight="700" fill="#D5B56E">3</text>
        <rect x="119" y="175" width="165" height="13" rx="6.5" fill="#565A61"/>
        <rect x="75" y="218" width="210" height="18" rx="9" fill="#23332C"/>
        <path d="M253 51l10 10 20-25" fill="none" stroke="#6FAF8E" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      `<svg viewBox="0 0 360 280" role="img" aria-label="Пробний НМТ">
        <rect x="49" y="20" width="262" height="240" rx="34" fill="#25282E" stroke="rgba(255,255,255,.08)"/>
        <rect x="77" y="50" width="86" height="16" rx="8" fill="rgba(214,179,106,.18)"/>
        <circle cx="260" cy="62" r="25" fill="#2B2F35"/>
        <path d="M260 49v14l10 6" fill="none" stroke="#C6A15B" stroke-width="4" stroke-linecap="round"/>
        <rect x="77" y="99" width="205" height="12" rx="6" fill="#565A61"/>
        <rect x="77" y="122" width="174" height="12" rx="6" fill="#3D4148"/>
        <g fill="#2B2F35" stroke="rgba(255,255,255,.07)"><rect x="77" y="157" width="92" height="42" rx="13"/><rect x="190" y="157" width="92" height="42" rx="13"/></g>
        <rect x="77" y="219" width="205" height="16" rx="8" fill="#3A3E45"/>
        <rect x="77" y="219" width="134" height="16" rx="8" fill="#C6A15B"/>
      </svg>`
    ];
    return illustrations[index] || illustrations[0];
  }

  function renderOnboardingSlide() {
    if (!onboardingStage) return;
    const slide = ONBOARDING_SLIDES[onboardingIndex] || ONBOARDING_SLIDES[0];
    onboardingStage.innerHTML = `
      <div class="onboarding-illustration">${onboardingIllustration(onboardingIndex)}</div>
      <div class="onboarding-copy">
        <div class="onboarding-eyebrow">${escapeHtml(slide.eyebrow)}</div>
        <h3>${escapeHtml(slide.title)}</h3>
        <p>${escapeHtml(slide.text)}</p>
      </div>`;
    onboardingProgress?.querySelectorAll('span').forEach((dot, i) => dot.classList.toggle('active', i === onboardingIndex));
    if (onboardingBack) onboardingBack.hidden = onboardingIndex === 0;
    if (onboardingNext) onboardingNext.textContent = onboardingIndex === ONBOARDING_SLIDES.length - 1 ? 'Почати' : 'Далі';
  }

  function openOnboarding({ manual = false } = {}) {
    if (!onboardingOverlay) return;
    onboardingManual = manual;
    onboardingIndex = 0;
    renderOnboardingSlide();
    onboardingOverlay.classList.add('show');
    onboardingOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    window.NMTUX?.haptic?.('light');
  }

  function closeOnboarding({ complete = true } = {}) {
    if (!onboardingOverlay) return;
    if (complete && !onboardingManual) markOnboardingDone();
    onboardingOverlay.classList.remove('show');
    onboardingOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function maybeShowFirstRunOnboarding() {
    if (hasCompletedOnboarding()) return;
    setTimeout(() => openOnboarding({ manual: false }), 240);
  }

  function closeSettingsScreen() {
    document.getElementById('appSettingsScreen')?.remove();
    document.body.classList.remove('modal-open');
  }

  function openTelegramSupport() {
    const url = 'https://t.me/Lazaran';
    try {
      if (typeof tg?.openTelegramLink === 'function') tg.openTelegramLink(url);
      else window.open(url, '_blank', 'noopener');
    } catch (_) {
      window.open(url, '_blank', 'noopener');
    }
  }

  const ACTIVITY_SESSION_ID = (() => {
    try {
      let id = sessionStorage.getItem('nmt_activity_session_v1');
      if (!id) {
        id = window.crypto?.randomUUID?.() || `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('nmt_activity_session_v1', id);
      }
      return id;
    } catch (_) {
      return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  })();
  let activityTimer = null;
  let adminRefreshTimer = null;

  async function sendActivityHeartbeat() {
    const initData = tg?.initData || '';
    if (!initData) return false;
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/activity/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, sessionId: ACTIVITY_SESSION_ID }),
      }, 9000);
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  function startActivityTracking() {
    if (activityTimer) return;
    sendActivityHeartbeat();
    activityTimer = setInterval(() => {
      if (document.visibilityState === 'visible') sendActivityHeartbeat();
    }, 45000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sendActivityHeartbeat();
    });
  }

  function getAdminToken() {
    try { return sessionStorage.getItem('nmt_admin_token_v1') || ''; } catch (_) { return ''; }
  }

  function setAdminToken(token) {
    try {
      if (token) sessionStorage.setItem('nmt_admin_token_v1', token);
      else sessionStorage.removeItem('nmt_admin_token_v1');
    } catch (_) {}
  }

  function closeAdminPanel() {
    if (adminRefreshTimer) clearInterval(adminRefreshTimer);
    adminRefreshTimer = null;
    document.getElementById('adminPanelScreen')?.remove();
    document.getElementById('adminLoginOverlay')?.remove();
    if (!document.getElementById('appSettingsScreen')) document.body.classList.remove('modal-open');
  }

  function formatAdminNumber(value) {
    return new Intl.NumberFormat('uk-UA').format(Number(value) || 0);
  }

  function formatAdminMinutes(value) {
    const minutes = Number(value) || 0;
    if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} хв`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h} год ${m} хв`;
  }

  function adminChartMarkup(daily = []) {
    const points = Array.isArray(daily) ? daily : [];
    const max = Math.max(1, ...points.map((x) => Number(x.users) || 0));
    return points.map((item, index) => {
      const value = Number(item.users) || 0;
      const height = Math.max(value ? 8 : 2, Math.round((value / max) * 100));
      const date = new Date(`${item.day}T12:00:00`);
      const label = index % 3 === 0 || index === points.length - 1
        ? new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' }).format(date)
        : '';
      return `<div class="admin-chart-column" title="${escapeHtml(item.day)} · ${value}">
        <div class="admin-chart-value">${value || ''}</div>
        <div class="admin-chart-rail"><span style="height:${height}%"></span></div>
        <small>${escapeHtml(label)}</small>
      </div>`;
    }).join('');
  }

  async function fetchAdminStats(token = getAdminToken()) {
    const res = await fetchWithTimeout(`${API_BASE}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }, 12000);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) setAdminToken('');
      throw new Error(data.error || 'Не вдалося завантажити адмін-статистику.');
    }
    return data;
  }

  async function refreshAdminPanel(root, { quiet = false } = {}) {
    const content = root?.querySelector('[data-admin-content]');
    const updated = root?.querySelector('[data-admin-updated]');
    if (!content) return;
    if (!quiet) content.classList.add('loading');
    try {
      const data = await fetchAdminStats();
      const m = data.summary || {};
      content.innerHTML = `
        <div class="admin-live-card">
          <span class="admin-live-dot"></span>
          <div><strong>${formatAdminNumber(m.active_now)}</strong><small>активні зараз</small></div>
          <p>Онлайн = активність за останні 2 хвилини</p>
        </div>
        <div class="admin-stat-grid">
          <article><strong>${formatAdminNumber(m.total_users)}</strong><span>всього користувачів</span></article>
          <article><strong>${formatAdminNumber(m.active_today)}</strong><span>за сьогодні</span></article>
          <article><strong>${formatAdminNumber(m.active_7d)}</strong><span>за 7 днів</span></article>
          <article><strong>${formatAdminNumber(m.active_30d)}</strong><span>за 30 днів</span></article>
          <article><strong>${formatAdminMinutes(m.avg_session_minutes)}</strong><span>середня сесія</span></article>
          <article><strong>+${formatAdminNumber(m.new_users_7d)}</strong><span>нових за 7 днів</span></article>
        </div>
        <section class="admin-analytics-card">
          <div class="admin-card-head"><div><small>АКТИВНІСТЬ</small><strong>Останні 14 днів</strong></div></div>
          <div class="admin-chart">${adminChartMarkup(data.daily)}</div>
        </section>
        <section class="admin-mini-stats">
          <div><strong>${formatAdminNumber(m.total_sessions)}</strong><span>сесій загалом</span></div>
          <div><strong>${formatAdminNumber(m.answers_7d)}</strong><span>відповідей за 7 днів</span></div>
          <div><strong>${formatAdminNumber(m.finished_nmt_30d)}</strong><span>НМТ завершено за 30 днів</span></div>
        </section>`;
      if (updated) updated.textContent = `Оновлено ${new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.generated_at || Date.now()))}`;
    } catch (err) {
      if (!getAdminToken()) {
        closeAdminPanel();
        openAdminLogin();
        return;
      }
      content.innerHTML = `<div class="admin-error-card">${escapeHtml(err.message)}</div>`;
    } finally {
      content.classList.remove('loading');
    }
  }

  function openAdminPanel() {
    document.getElementById('adminLoginOverlay')?.remove();
    document.getElementById('adminPanelScreen')?.remove();
    if (!getAdminToken()) return openAdminLogin();
    document.body.insertAdjacentHTML('beforeend', `
      <section class="admin-panel-screen" id="adminPanelScreen" role="dialog" aria-modal="true" aria-label="Адмін-панель">
        <div class="admin-panel-shell">
          <header class="admin-panel-head">
            <button type="button" class="admin-panel-back" data-admin-close aria-label="Закрити">←</button>
            <div><small>NMT CONTROL</small><strong>Адмін-панель</strong></div>
            <button type="button" class="admin-panel-refresh" data-admin-refresh aria-label="Оновити">↻</button>
          </header>
          <div class="admin-panel-meta"><span data-admin-updated>Завантаження…</span><span>v${APP_VERSION}</span></div>
          <div class="admin-panel-content" data-admin-content><div class="admin-panel-loader"><span></span><p>Завантажуємо статистику…</p></div></div>
        </div>
      </section>`);
    document.body.classList.add('modal-open');
    const root = document.getElementById('adminPanelScreen');
    root?.querySelector('[data-admin-close]')?.addEventListener('click', closeAdminPanel);
    root?.querySelector('[data-admin-refresh]')?.addEventListener('click', () => {
      window.NMTUX?.playSound?.('tap');
      refreshAdminPanel(root);
    });
    refreshAdminPanel(root);
    if (adminRefreshTimer) clearInterval(adminRefreshTimer);
    adminRefreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && document.getElementById('adminPanelScreen')) refreshAdminPanel(root, { quiet: true });
    }, 30000);
    window.NMTUX?.haptic?.('light');
  }

  function openAdminLogin() {
    document.getElementById('adminLoginOverlay')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div class="admin-login-overlay" id="adminLoginOverlay" role="dialog" aria-modal="true" aria-label="Вхід в адмін-панель">
        <section class="admin-login-card">
          <button type="button" class="admin-login-close" data-admin-login-close aria-label="Закрити">×</button>
          <div class="admin-login-mark">N</div>
          <small>ПРИХОВАНИЙ РЕЖИМ</small>
          <h3>Адмін-панель</h3>
          <p>Введи пароль, щоб відкрити статистику застосунку.</p>
          <form data-admin-login-form>
            <input type="password" inputmode="numeric" autocomplete="current-password" maxlength="16" placeholder="Пароль" aria-label="Пароль адмін-панелі" required>
            <button class="primary-btn" type="submit">Увійти</button>
          </form>
          <div class="admin-login-error" data-admin-login-error></div>
        </section>
      </div>`);
    document.body.classList.add('modal-open');
    const overlay = document.getElementById('adminLoginOverlay');
    const input = overlay?.querySelector('input');
    const form = overlay?.querySelector('[data-admin-login-form]');
    const error = overlay?.querySelector('[data-admin-login-error]');
    overlay?.querySelector('[data-admin-login-close]')?.addEventListener('click', () => {
      overlay.remove();
      if (!document.getElementById('appSettingsScreen')) document.body.classList.remove('modal-open');
    });
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.querySelector('[data-admin-login-close]')?.click();
    });
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const password = input?.value || '';
      if (!password) return;
      button.disabled = true;
      if (error) error.textContent = '';
      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, initData: tg?.initData || '' }),
        }, 12000);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) throw new Error(data.error || 'Не вдалося увійти.');
        setAdminToken(data.token);
        window.NMTUX?.playSound?.('confirm');
        window.NMTUX?.haptic?.('success');
        openAdminPanel();
      } catch (err) {
        if (error) error.textContent = err.message;
        window.NMTUX?.haptic?.('error');
      } finally {
        button.disabled = false;
      }
    });
    setTimeout(() => input?.focus(), 160);
  }

  function bindSecretAdminEntry(root) {
    const version = root?.querySelector('[data-version-secret]');
    if (!version) return;
    let taps = 0;
    let resetTimer = null;
    version.addEventListener('click', () => {
      taps += 1;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { taps = 0; }, 2500);
      window.NMTUX?.playSound?.('tap');
      if (taps < 5) return;
      taps = 0;
      clearTimeout(resetTimer);
      window.NMTUX?.haptic?.('selection');
      if (getAdminToken()) openAdminPanel();
      else openAdminLogin();
    });
  }

  function openSettingsScreen() {
    document.getElementById('appSettingsScreen')?.remove();
    const soundEnabled = window.NMTUX?.getSoundEnabled?.() !== false;
    document.body.insertAdjacentHTML('beforeend', `
      <section class="app-settings-screen" id="appSettingsScreen" aria-label="Налаштування" role="dialog" aria-modal="true">
        <div class="app-settings-shell">
          <header class="app-settings-head">
            <button class="app-settings-back" type="button" data-settings-back aria-label="Назад">←</button>
            <strong>Налаштування</strong>
            <span class="app-settings-head-spacer"></span>
          </header>

          <div class="app-settings-intro">
            <h2>Налаштування</h2>
            <p>Лише основні речі — без зайвих перемикачів.</p>
          </div>

          <div class="app-settings-group">
            <button class="app-settings-row" type="button" data-settings-sound>
              <span class="app-settings-icon" aria-hidden="true">♪</span>
              <span class="app-settings-copy"><strong>Звуки</strong><small>Тихі звуки відповідей, вибору в НМТ та завершення тесту</small></span>
              <span class="premium-switch ${soundEnabled ? 'on' : ''}" data-settings-sound-switch aria-hidden="true"><i></i></span>
            </button>
          </div>

          <div class="app-settings-group">
            <button class="app-settings-row" type="button" data-settings-tutorial>
              <span class="app-settings-icon" aria-hidden="true">?</span>
              <span class="app-settings-copy"><strong>Як це працює</strong><small>Ще раз відкрити короткий тур по застосунку</small></span>
              <span class="app-settings-chevron" aria-hidden="true">›</span>
            </button>
            <button class="app-settings-row" type="button" data-settings-report>
              <span class="app-settings-icon" aria-hidden="true">!</span>
              <span class="app-settings-copy"><strong>Повідомити про проблему</strong><small>Скинь скрін і короткий опис у Telegram: @Lazaran</small></span>
              <span class="app-settings-chevron" aria-hidden="true">›</span>
            </button>
          </div>

          <button class="app-settings-version" type="button" data-version-secret>NMT Math · v${APP_VERSION}</button>
        </div>
      </section>`);
    document.body.classList.add('modal-open');

    const root = document.getElementById('appSettingsScreen');
    root?.querySelector('[data-settings-back]')?.addEventListener('click', () => {
      window.NMTUX?.playSound?.('tap');
      closeSettingsScreen();
    });
    root?.querySelector('[data-settings-sound]')?.addEventListener('click', () => {
      const current = window.NMTUX?.getSoundEnabled?.() !== false;
      const next = !current;
      window.NMTUX?.setSoundEnabled?.(next);
      root.querySelector('[data-settings-sound-switch]')?.classList.toggle('on', next);
      if (next) window.NMTUX?.playSound?.('select');
      window.NMTUX?.haptic?.('selection');
    });
    root?.querySelector('[data-settings-tutorial]')?.addEventListener('click', () => {
      window.NMTUX?.playSound?.('tap');
      closeSettingsScreen();
      setTimeout(() => openOnboarding({ manual: true }), 70);
    });
    root?.querySelector('[data-settings-report]')?.addEventListener('click', () => {
      window.NMTUX?.playSound?.('tap');
      openTelegramSupport();
    });
    bindSecretAdminEntry(root);
    window.NMTUX?.haptic?.('light');
  }

  function formatJoinDate(value) {
    if (!value) return 'Профіль';
    try {
      return 'У застосунку з ' + new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date(value));
    } catch (_) {
      return 'Профіль';
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

    const dayWord = (value) => {
      const n = Math.abs(Number(value) || 0);
      const mod100 = n % 100;
      const mod10 = n % 10;
      if (mod100 >= 11 && mod100 <= 14) return 'днів';
      if (mod10 === 1) return 'день';
      if (mod10 >= 2 && mod10 <= 4) return 'дні';
      return 'днів';
    };

    const taskWord = (value) => {
      const n = Math.abs(Number(value) || 0);
      const mod100 = n % 100;
      const mod10 = n % 10;
      if (mod100 >= 11 && mod100 <= 14) return 'завдань';
      if (mod10 === 1) return 'завдання';
      if (mod10 >= 2 && mod10 <= 4) return 'завдання';
      return 'завдань';
    };

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
      const recent = data.recent_7_days || {};
      const recentTotal = Number(recent.total) || 0;
      const recentAccuracy = Math.max(0, Math.min(100, Number(recent.accuracy) || 0));
      const nmt = data.nmt || {};
      const strongest = data.strongest_topic || null;

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
                <div class="topic-stat-meta">${rowCorrect} правильних відповідей із ${rowTotal}</div>
                <div class="topic-stat-bar-new"><div class="topic-stat-fill-new" style="width:${rowAccuracy}%"></div></div>
              </div>`;
          }).join('')
        : `<div class="profile-empty-state">Результати за темами з’являться після кількох відповідей.</div>`;

      const lastNmt = Number(nmt.completed) > 0
        ? `<strong>${nmt.last_scaled_score != null ? Number(nmt.last_scaled_score) : '&lt;100'} із 200</strong><small>Останній завершений пробний тест</small>`
        : `<strong>Результату ще немає</strong><small>Пройди пробний НМТ, щоб він з’явився тут</small>`;

      const strongestMarkup = strongest
        ? `<strong>${escapeHtml(stripLeadingEmoji(strongest.label || strongest.topic))}</strong><small>Точність — ${Number(strongest.accuracy) || 0}%</small>`
        : `<strong>Ще визначаємо</strong><small>Потрібно трохи більше відповідей</small>`;

      profileContent.innerHTML = `
        <section class="profile-identity-card">
          <div class="profile-avatar-new">${avatarMarkup}</div>
          <div class="profile-identity">
            <div class="profile-identity-overline">NMT MATH</div>
            <div class="profile-name-new">${escapeHtml(data.first_name || 'Учень')}</div>
            <div class="profile-since-new">${escapeHtml(formatJoinDate(data.created_at))}</div>
          </div>
          <div class="profile-streak-pill" aria-label="Серія ${streak} ${dayWord(streak)}">
            <span class="profile-streak-flame" aria-hidden="true">🔥</span>
            <span class="profile-streak-copy"><small>Серія</small><strong>${streak} ${dayWord(streak)}</strong></span>
          </div>
        </section>

        <section class="profile-metric-strip">
          <article class="profile-metric-card profile-metric-primary">
            <span class="profile-metric-label">Точність</span>
            <strong>${accuracy}%</strong>
            <div class="profile-metric-track"><span style="width:${accuracy}%"></span></div>
            <small>за всі тренування</small>
          </article>
          <article class="profile-metric-card">
            <span class="profile-metric-label">7 днів</span>
            <strong>${recentTotal}</strong>
            <small>${taskWord(recentTotal)} · ${recentTotal ? `${recentAccuracy}% правильних` : 'ще без відповідей'}</small>
          </article>
          <article class="profile-metric-card">
            <span class="profile-metric-label">Серія</span>
            <strong>${streak}</strong>
            <small>${dayWord(streak)} · рекорд — ${bestStreak} ${dayWord(bestStreak)}</small>
          </article>
        </section>

        <section class="profile-snapshot-grid">
          <article class="profile-snapshot-card">
            <div class="profile-snapshot-icon">↗</div>
            <span>Сильна тема</span>
            <div>${strongestMarkup}</div>
          </article>
          <article class="profile-snapshot-card profile-snapshot-dark">
            <div class="profile-snapshot-icon">22</div>
            <span>Пробний НМТ</span>
            <div>${lastNmt}</div>
          </article>
        </section>

        <section class="profile-quick-actions">
          <button type="button" data-profile-action="tests"><span>→</span><div><strong>Тренуватись</strong><small>Продовжити практику</small></div><i>›</i></button>
          <button type="button" data-profile-action="nmt"><span>22</span><div><strong>Пробний НМТ</strong><small>Перевірити себе</small></div><i>›</i></button>
        </section>

        <section class="profile-settings-card" aria-label="Налаштування">
          <button class="profile-setting-row profile-setting-row-main" type="button" data-open-settings>
            <span class="profile-setting-icon" aria-hidden="true">⚙</span>
            <span class="profile-setting-copy"><strong>Налаштування</strong><small>Звуки, допомога та зв’язок</small></span>
            <span class="profile-setting-chevron">›</span>
          </button>
        </section>

        <details class="profile-disclosure profile-disclosure-v3">
          <summary>
            <div><strong>Статистика</strong><span>${Number(data.total) || 0} ${taskWord(Number(data.total) || 0)} за весь час</span></div>
            <span class="profile-disclosure-arrow">⌄</span>
          </summary>
          <div class="profile-disclosure-body">
            <div class="profile-stat-grid-new">
              <div class="profile-stat-new"><strong>${Number(data.total) || 0}</strong><span>розв’язано</span></div>
              <div class="profile-stat-new"><strong>${Number(data.correct) || 0}</strong><span>правильно</span></div>
              <div class="profile-stat-new"><strong>${Number(data.wrong) || 0}</strong><span>помилок</span></div>
            </div>
          </div>
        </details>

        <details class="profile-disclosure profile-disclosure-v3">
          <summary>
            <div><strong>Теми</strong><span>${Array.isArray(data.topic_stats) ? data.topic_stats.length : 0} у статистиці</span></div>
            <span class="profile-disclosure-arrow">⌄</span>
          </summary>
          <div class="profile-disclosure-body">
            <div class="topic-stat-list-new">${topicRows}</div>
          </div>
        </details>`;

      profileContent.querySelectorAll('[data-profile-action]').forEach((button) => {
        button.addEventListener('click', () => switchView(button.dataset.profileAction));
      });

      profileContent.querySelector('[data-open-settings]')?.addEventListener('click', openSettingsScreen);

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
      result.innerHTML = `<div class="status" style="min-height:90px"><div class="spinner"></div><span>ШІ готує пояснення…</span></div>`;
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/explain-more`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg?.initData || null,
          mode,
          topic: q.topic || topicSelect.value,
          difficulty: q.difficulty || 'NMT HARD',
          question: {
            question: q.question,
            options: q.options,
            correct_index: q.correct_index,
            selected_index: state.selectedIndex,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка ШІ');

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
        <button class="primary-btn" id="retryBtn">Спробуй ще раз</button>
      </div>`;
    document.getElementById('retryBtn').addEventListener('click', loadQuestion);
  }

  function cleanExplanationStep(value = '') {
    return String(value)
      .replace(/^\s*\d+[.)]\s*/, '')
      .replace(/^Використовуємо\s+/iu, 'Беремо ')
      .replace(/^Підставляємо\s+/iu, 'Маємо ')
      .replace(/^Отримуємо\s+/iu, 'Звідси ')
      .replace(/^Обчислюємо\s+/iu, 'Рахуємо ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getExplanationSteps(q) {
    const source = Array.isArray(q?.solution?.steps) && q.solution.steps.length
      ? q.solution.steps
      : Array.isArray(q?.explanation_steps) && q.explanation_steps.length
        ? q.explanation_steps
        : typeof q?.explanation === 'string'
          ? q.explanation.split(/\n+|;\s+|(?=\s*\d+[.)]\s+)/)
          : [];

    const unique = [];
    for (const raw of source) {
      const step = cleanExplanationStep(raw);
      if (!step || unique.includes(step)) continue;
      if (/^Відповідь\s*:/iu.test(step)) continue;
      unique.push(step);
      if (unique.length >= 4) break;
    }

    return unique.length ? unique : ['Короткий розв’язок для цього завдання тимчасово недоступний.'];
  }

  function getStructuredSolution(q) {
    return {
      steps: getExplanationSteps(q),
      answer: q?.solution?.answer || (q?.type === 'choice' ? q?.options?.[q?.correct_index] : q?.correct_display) || '—',
    };
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

  const ENGINE_DEBUG = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(window.location.search).get('debug') === '1';

  function engineDebugMarkup(q) {
    if (!ENGINE_DEBUG) return '';
    const m = q?.runtime_meta || {};
    const rows = [
      ['ENGINE', m.engine || 'NMT Engine 4.0 AI Hybrid'],
      ['BANK ITEM', m.bank_item_id || q?.id || '—'],
      ['BLUEPRINT', q?.blueprint_id || '—'],
      ['VARIANT', q?.variant_key || '—'],
      ['COMPLEXITY', m.complexity_score ?? q?.bank_meta?.complexity_score ?? '—'],
      ['QUALITY', m.quality_score ?? q?.bank_meta?.quality_score ?? '—'],
      ['NOVELTY', m.novelty_score ?? q?.bank_meta?.novelty_score ?? '—'],
      ['NMT', m.nmt_similarity ?? q?.bank_meta?.nmt_similarity ?? '—'],
      ['VISUAL', m.visual_renderer ?? q?.bank_meta?.visual?.renderer ?? 'none'],
    ];
    return `<div class="engine-debug">${rows.map(([k,v]) => `<span><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</span>`).join('')}</div>`;
  }

  function safeDiagramSvg(svg) {
    if (typeof svg !== 'string') return '';
    const value = svg.trim();
    if (!value.startsWith('<svg') || !value.endsWith('</svg>')) return '';
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
      .replace(/javascript:/gi, '');
  }

  function renderQuestion(q) {
    if (window.NMTMath?.validateQuestion && !window.NMTMath.validateQuestion(q)) {
      console.warn('Question skipped: invalid math payload', q?.id || q?.bank_id || q?.question);
      renderLoading('Підбираємо коректно оформлене завдання…');
      setTimeout(() => loadQuestion({ forceFresh: true }), 0);
      return;
    }

    hideStartupScreen();
    state.currentQuestion = q;
    state.selectedIndex = null;
    state.answered = false;
    state.questionShownAtMs = Date.now();

    if (q.progress) {
      state.correct = Number(q.progress.correct) || 0;
      state.wrong = Number(q.progress.wrong) || 0;
      updateStreak();
      console.log('PROGRESS LOADED:', q.progress);
    }

    const letters = ['А', 'Б', 'В', 'Г', 'Д'];
    const solution = getStructuredSolution(q);

    cardArea.innerHTML = `
      <div class="card card-enter">
        <div class="card-top">
          <div class="card-label">Змішаний тренувальний потік</div>
          <button class="report-btn" id="reportBtn" type="button" aria-label="Повідомити про проблему"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20V5.5M6 6h9.2l-1.5 3 1.5 3H6"/></svg></button>
        </div>
        <div class="question-text">${escapeHtml(q.question)}</div>
        ${engineDebugMarkup(q)}
        ${q.diagram_svg ? `<div class="training-diagram">${safeDiagramSvg(q.diagram_svg)}</div>` : ''}
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
            <span>Пояснення</span>
          </div>
          <div class="solution-topic">${escapeHtml(q.topic_label || 'Тема НМТ')}</div>
          <ol class="explanation-steps explanation-steps-compact">
            ${solution.steps.map((step) => `<li class="explanation-step">${escapeHtml(step)}</li>`).join('')}
          </ol>
          <div class="solution-answer"><span>Відповідь</span><strong>${escapeHtml(solution.answer)}</strong></div>
          <div class="ai-help" id="aiHelp">
            <div class="ai-help-title">Хочеш інше пояснення?</div>
            <div class="ai-help-actions">
              <button class="ai-chip" type="button" data-ai-mode="simple">Пояснити простіше</button>
              <button class="ai-chip" type="button" data-ai-mode="detailed">Пояснити детальніше</button>
            </div>
            <div class="ai-help-result" id="aiHelpResult"></div>
          </div>
        </div>
        <div class="action-stack">
          <button class="primary-btn" id="checkBtn" type="button" disabled>Перевірити відповідь</button>
          <button class="secondary-btn" id="regenerateBtn" type="button">↻ Інше завдання</button>
        </div>
      </div>`;

    const mathRendered = renderMathSafely(cardArea);
    if (!mathRendered && typeof window.renderMathInElement === 'function') {
      console.warn('Rendered question rejected by KaTeX; loading another item.');
      renderLoading('Виправляємо математичне оформлення…');
      setTimeout(() => loadQuestion({ forceFresh: true }), 0);
      return;
    }

    cardArea.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => selectAnswer(Number(btn.dataset.index)));
    });

    document.getElementById('checkBtn').addEventListener('click', () => {
      if (state.answered) loadQuestion();
      else submitAnswer();
    });

    document.getElementById('regenerateBtn').addEventListener('click', () => {
      window.NMTUX?.haptic?.('light');
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

    window.NMTUX?.unlockAudio?.();
    window.NMTUX?.haptic?.('selection');
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

    const card = cardArea.querySelector('.card');
    card?.classList.remove('feedback-correct', 'feedback-wrong');
    card?.classList.add(isCorrect ? 'feedback-correct' : 'feedback-wrong');

    if (isCorrect) {
      window.NMTUX?.haptic?.('success');
      window.NMTUX?.playSound?.('correct');
    } else {
      window.NMTUX?.haptic?.('error');
      window.NMTUX?.playSound?.('wrong');
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
          questionBankId: q.bank_id || null,
          selectedIndex,
          responseMs: state.questionShownAtMs ? Math.max(0, Date.now() - state.questionShownAtMs) : null,
          clientAnswerId: globalThis.crypto?.randomUUID?.() || `ans-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    const topic = 'mixed';
    const res = await fetchWithTimeout(`${API_BASE}/api/questions-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        difficulty: 'NMT HARD',
        initData: tg?.initData || null,
        count: Math.max(1, Math.min(5, Number(count) || 4)),
      }),
    }, QUESTION_TIMEOUT_MS);

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не вдалося підготувати завдання.');
    return data;
  }

  function ensureQuestionQueue(targetSize = 4) {
    const topic = 'mixed';
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
        : (err?.message || 'Немає з’єднання із сервером. Спробуй ще раз.'));
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

    // Keep the selected row fully visible instead of reopening the sheet
    // at a half-scrolled position left over from the previous visit.
    requestAnimationFrame(() => {
      const active = topicList.querySelector('.topic-item.active');
      if (!active) {
        topicList.scrollTop = 0;
        return;
      }
      const target = active.offsetTop - Math.max(8, (topicList.clientHeight - active.offsetHeight) / 2);
      topicList.scrollTop = Math.max(0, target);
    });
  }

  function closeTopicSheet() {
    topicOverlay.classList.remove('show');
    topicOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  topicPicker?.addEventListener('click', openTopicSheet);
  topicSheetClose?.addEventListener('click', closeTopicSheet);
  topicOverlay?.addEventListener('click', (event) => {
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
    btn.addEventListener('click', () => {
      window.NMTUX?.playSound?.('tap');
      switchView(btn.dataset.view || 'tests');
    });
  });

  window.addEventListener('resize', () => updateNavIndicator(state.currentView), { passive: true });
  reportClose.addEventListener('click', closeReport);
  reportOverlay.addEventListener('click', (event) => { if (event.target === reportOverlay) closeReport(); });
  reportReasons.querySelectorAll('.report-reason').forEach((btn) => {
    btn.addEventListener('click', () => submitReport(btn.dataset.reason || 'Інше'));
  });

  onboardingSkip?.addEventListener('click', () => closeOnboarding({ complete: true }));
  onboardingBack?.addEventListener('click', () => {
    window.NMTUX?.playSound?.('tap');
    onboardingIndex = Math.max(0, onboardingIndex - 1);
    renderOnboardingSlide();
    window.NMTUX?.haptic?.('selection');
  });
  onboardingNext?.addEventListener('click', () => {
    window.NMTUX?.unlockAudio?.();
    window.NMTUX?.playSound?.('tap');
    if (onboardingIndex >= ONBOARDING_SLIDES.length - 1) {
      if (!onboardingManual) markOnboardingDone();
      closeOnboarding({ complete: false });
      window.NMTUX?.haptic?.('light');
      return;
    }
    onboardingIndex += 1;
    renderOnboardingSlide();
    window.NMTUX?.haptic?.('selection');
  });

  async function loadTopics() {
    // Engine 4.1: training is intentionally one endless mixed stream.
    // Topic-specific practice is removed from the product UI.
    loadedTopics = [{ key: 'mixed', label: '🎯 Змішані завдання НМТ' }];
    topicSelect.innerHTML = '<option value="mixed">Змішані завдання НМТ</option>';
    topicSelect.value = 'mixed';
    try { localStorage.removeItem('nmt_topic'); } catch (_) {}
    if (topicPickerTitle) topicPickerTitle.textContent = 'Змішані завдання НМТ';
    if (topicPickerSubtitle) topicPickerSubtitle.textContent = 'Безкінечний тренувальний потік';
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
      startActivityTracking();

      await loadTopics();

      // Спочатку намагаємось підтягнути збережений прогрес
      const progressLoaded = await loadProgress();
      sendActivityHeartbeat();

      // Одним запитом беремо відразу кілька завдань; перше показуємо, решта лишаються в буфері.
      await ensureQuestionQueue(4);
      await loadQuestion();
      maybeShowFirstRunOnboarding();

      // Після першого paint тихо прогріваємо важчі екрани у фоні.
      const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 500));

      // Якщо Telegram не встиг віддати initData —
      // пробуємо підтягнути прогрес ще раз
      if (!progressLoaded) {
        await loadProgress();
      }
    } catch (err) {
      console.error('INIT ERROR:', err);
      renderError(err?.message || 'Не вдалося запустити застосунок. Спробуй ще раз.');
    }
  })();
