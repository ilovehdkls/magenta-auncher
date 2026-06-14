let store = {};
let session = null;
let currentPage = 'home';
let launching = false;
let promoTimer = 0;
const loaderPct = { stable: 0, beta: 0 };
const loaderTarget = { stable: 0, beta: 0 };
let loaderRaf = 0;

const RING_LEN = 2 * Math.PI * 52;
const BOOT_STEPS = [
  { text: 'Initializing core...', pct: 6, ms: 620 },
  { text: 'Loading assets...', pct: 18, ms: 780 },
  { text: 'Verifying protection...', pct: 34, ms: 840 },
  { text: 'Preparing client vault...', pct: 52, ms: 900 },
  { text: 'Syncing configuration...', pct: 68, ms: 820 },
  { text: 'Loading UI modules...', pct: 84, ms: 760 },
  { text: 'Almost ready...', pct: 96, ms: 680 },
  { text: 'Welcome', pct: 100, ms: 520 }
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const api = () => window.magenta;

function showToast(text, ok = true) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text;
  el.className = `toast no-drag show ${ok ? 'ok' : 'err'}`;
  setTimeout(() => el.classList.remove('show'), 2600);
}

function bindWindowControls() {
  const min = () => api().minimize();
  const close = () => api().close();
  $('#btn-min')?.addEventListener('click', min);
  $('#btn-close')?.addEventListener('click', close);
  $('#btn-min-auth')?.addEventListener('click', min);
  $('#btn-close-auth')?.addEventListener('click', close);
}

function bindInputGuards() {
  document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
  document.addEventListener('mousedown', (e) => { if (e.button === 2) e.preventDefault(); }, true);
  document.addEventListener('mouseup', (e) => { if (e.button === 2) e.preventDefault(); }, true);
  document.addEventListener('auxclick', (e) => { if (e.button === 2) e.preventDefault(); }, true);
  document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F11' || e.key === 'F12') e.preventDefault();
    if (e.altKey && e.key === ' ') e.preventDefault();
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) e.preventDefault();
  });
}

async function runBootSplash() {
  const splash = $('#boot-splash');
  const fill = $('#boot-bar-fill');
  const label = $('#boot-label');
  const appEl = $('#app');
  if (!splash || !fill || !label || !appEl) return;
  for (const step of BOOT_STEPS) {
    label.textContent = step.text;
    fill.style.width = `${step.pct}%`;
    await new Promise((r) => setTimeout(r, step.ms));
  }
  splash.classList.add('boot-done');
  appEl.classList.remove('is-booting');
  setTimeout(() => splash.remove(), 550);
}

function showAuth() {
  const auth = $('#view-auth');
  const shell = $('#view-shell');
  shell?.classList.remove('view-active');
  setTimeout(() => {
    auth?.classList.add('view-active');
    $$('.anim-in').forEach((el) => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  }, 80);
}

function showShell() {
  const auth = $('#view-auth');
  const shell = $('#view-shell');
  auth?.classList.remove('view-active');
  setTimeout(() => {
    shell?.classList.add('view-active');
    fillUserChip();
    navigatePage('home', false);
  }, 120);
}

function navigatePage(name, animate = true) {
  const prev = document.getElementById(`page-${currentPage}`);
  const next = document.getElementById(`page-${name}`);
  if (!next || currentPage === name) return;
  if (animate && prev && prev !== next) {
    prev.classList.add('page-exit');
    prev.classList.remove('page-active');
    setTimeout(() => prev.classList.remove('page-exit'), 400);
  } else if (prev) {
    prev.classList.remove('page-active', 'page-exit');
  }
  currentPage = name;
  next.classList.add('page-active');
  $$('.nav-btn[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
  $$('#page-settings .anim-in').forEach((el) => {
    if (name === 'settings') {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    }
  });
}

function fillUserChip() {
  if (!session) return;
  const name = session.login || 'User';
  $('#user-name').textContent = name.length > 10 ? `${name.slice(0, 9)}…` : name;
  $('#user-avatar').textContent = (name[0] || 'M').toUpperCase();
}

function setRingProgress(client, pct) {
  const ring = document.querySelector(`[data-ring="${client}"]`);
  if (!ring) return;
  ring.style.strokeDashoffset = `${RING_LEN - (RING_LEN * Math.min(100, pct)) / 100}`;
}

function tickLoaderPct() {
  let animating = false;
  for (const client of ['stable', 'beta']) {
    const diff = loaderTarget[client] - loaderPct[client];
    if (Math.abs(diff) > 0.4) {
      loaderPct[client] += diff * 0.14;
      animating = true;
    } else {
      loaderPct[client] = loaderTarget[client];
    }
    const el = document.querySelector(`[data-pct="${client}"]`);
    const v = Math.round(loaderPct[client]);
    if (el) el.textContent = `${v}%`;
    setRingProgress(client, loaderPct[client]);
  }
  loaderRaf = animating ? requestAnimationFrame(tickLoaderPct) : 0;
}

function setLoaderPct(client, pct) {
  loaderTarget[client] = Math.min(100, Math.max(0, pct));
  if (!loaderRaf) loaderRaf = requestAnimationFrame(tickLoaderPct);
}

function setLoaderStatus(client, text) {
  const el = document.querySelector(`[data-status="${client}"]`);
  if (!el || el.textContent === text) return;
  el.classList.add('swap');
  setTimeout(() => {
    el.textContent = text;
    el.classList.remove('swap');
  }, 180);
}

function showLoader(client) {
  const card = document.querySelector(`#card-${client}`);
  const loader = document.querySelector(`#loader-${client}`);
  loaderPct[client] = 0;
  loaderTarget[client] = 0;
  setRingProgress(client, 0);
  const pctEl = document.querySelector(`[data-pct="${client}"]`);
  if (pctEl) pctEl.textContent = '0%';
  setLoaderStatus(client, 'Loading...');
  card?.classList.add('is-loading', 'focused');
  card?.classList.remove('blurred');
  loader?.removeAttribute('hidden');
  requestAnimationFrame(() => loader?.classList.add('visible'));
}

function hideLoader(client) {
  const card = document.querySelector(`#card-${client}`);
  const loader = document.querySelector(`#loader-${client}`);
  loader?.classList.remove('visible');
  setTimeout(() => {
    loader?.setAttribute('hidden', '');
    card?.classList.remove('is-loading');
  }, 420);
}

function onLaunchProgress({ client, pct, label }) {
  if (!client) return;
  setLoaderPct(client, pct ?? 0);
  if (label) setLoaderStatus(client, label);
}

function setPromoSlide(idx) {
  $$('.promo-slide').forEach((s) => s.classList.toggle('active', Number(s.dataset.slide) === idx));
  $$('.dot').forEach((d) => d.classList.toggle('active', Number(d.dataset.dot) === idx));
}

function initPromoCarousel() {
  let idx = 0;
  const total = $$('.promo-slide').length || 3;
  promoTimer = setInterval(() => {
    idx = (idx + 1) % total;
    setPromoSlide(idx);
  }, 5000);
  $$('.dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      idx = Number(dot.dataset.dot);
      setPromoSlide(idx);
    });
  });
}

function focusCard(client) {
  $$('.game-card').forEach((c) => {
    const isTarget = c.id === `card-${client}`;
    c.classList.toggle('focused', isTarget);
    c.classList.toggle('blurred', !isTarget);
  });
}

function updateRamTrack() {
  const input = $('#set-ram');
  if (!input) return;
  const min = Number(input.min) || 1024;
  const max = Number(input.max) || 8192;
  const val = Number(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--pct', `${pct}%`);
}

async function playClient(client) {
  if (launching) return;
  launching = true;
  focusCard(client);
  $$('.game-card').forEach((c) => {
    if (c.id !== `card-${client}`) c.classList.add('blurred');
  });
  const btn = document.querySelector(`[data-play="${client}"]`);
  if (btn) btn.disabled = true;
  showLoader(client);
  await persistSettings();
  const res = await api().launchClient(client);
  if (res.ok) {
    setLoaderPct(client, 100);
    setLoaderStatus(client, 'Launching...');
    await new Promise((r) => setTimeout(r, 1400));
    showToast('Client launched', true);
  } else {
    showToast(res.error || 'Error', false);
  }
  hideLoader(client);
  if (btn) btn.disabled = false;
  launching = false;
}

async function init() {
  if (!api()) return;
  bindWindowControls();
  bindInputGuards();
  initPromoCarousel();
  const bootPromise = runBootSplash();
  store = await api().loadStore();
  session = await api().getSession();
  api().onInstallProgress(onLaunchProgress);
  api().onProtectionThreat(() => showToast('Threat detected', false));
  bindAuth();
  bindNav();
  bindSettings();
  bindPlay();
  applySettingsToUI();
  updateRamTrack();
  $$('.ring-fg').forEach((ring) => {
    ring.style.strokeDasharray = `${RING_LEN}`;
    ring.style.strokeDashoffset = `${RING_LEN}`;
  });
  await bootPromise;
  session ? showShell() : showAuth();
}

function bindAuth() {
  $('#toggle-pass')?.addEventListener('click', () => {
    const inp = $('#auth-password');
    const visible = inp.type === 'text';
    inp.type = visible ? 'password' : 'text';
    $('#eye-icon-use')?.setAttribute('href', visible ? 'icons.svg#i-eye' : 'icons.svg#i-eye-off');
  });

  let isRegisterMode = false;

  $('#auth-toggle')?.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    $('#auth-title').textContent = isRegisterMode ? 'Create account' : 'Welcome back!';
    $('#auth-subtitle').textContent = isRegisterMode
      ? 'Create a local account'
      : 'Sign in to your account';
    $('#auth-submit-text').textContent = isRegisterMode ? 'Register' : 'Sign In';
    $('#auth-toggle-text').textContent = isRegisterMode
      ? 'Already have an account? Sign In'
      : "Don't have an account? Register";
  });

  $('#auth-submit').onclick = async () => {
    const login = $('#auth-login').value.trim();
    const password = $('#auth-password').value;
    const errEl = $('#auth-error');
    const btn = $('#auth-submit');
    errEl.textContent = '';
    btn.disabled = true;

    let res;
    if (isRegisterMode) {
      res = await api().register({ login, password });
    } else {
      res = await api().login({ login, password });
    }

    btn.disabled = false;

    if (!res.ok) {
      errEl.textContent = res.error || 'Error';
      return;
    }
    session = res.session;
    if (session.activated) {
      showShell();
    } else {
      showActivate();
    }
  };
}

function showActivate() {
  const auth = $('#view-auth');
  const shell = $('#view-shell');
  auth?.classList.remove('view-active');
  shell?.classList.add('view-active');
  fillUserChip();
  navigatePage('settings', false);
  showToast('Enter activation key in Settings', false);
}

function bindNav() {
  $$('.nav-btn[data-nav]').forEach((btn) => {
    btn.onclick = () => navigatePage(btn.dataset.nav);
  });
  $('#btn-logout').onclick = async () => {
    await api().logout();
    session = null;
    showAuth();
  };
}

function bindPlay() {
  $$('[data-play]').forEach((btn) => {
    btn.onclick = () => playClient(btn.dataset.play);
  });
  $('#card-stable')?.addEventListener('mouseenter', () => focusCard('stable'));
  $('#card-beta')?.addEventListener('mouseenter', () => focusCard('beta'));
  $('#page-home')?.addEventListener('mouseleave', () => focusCard('stable'));
}

function applySettingsToUI() {
  const ram = store.ramMb || 2048;
  $('#set-ram').value = ram;
  $('#set-ram-num').textContent = ram;
  if (!$('#set-path').value) $('#set-path').value = store.installPath || '';
}

function bindSettings() {
  const syncRam = (v) => {
    $('#set-ram').value = v;
    $('#set-ram-num').textContent = v;
    updateRamTrack();
  };
  $('#set-ram').oninput = (e) => syncRam(e.target.value);
  $('#set-ram').onchange = () => persistSettings();
  $('#open-resources').onclick = () => {
    const p = $('#set-path').value || store.installPath;
    if (p) api().openFolder(p);
  };

  $('#btn-activate').onclick = async () => {
    const key = $('#activation-key').value.trim();
    if (!key) { showToast('Enter activation key', false); return; }
    const res = await api().activate({ key });
    if (res.ok) {
      session = res.session;
      showToast('Activated successfully', true);
    } else {
      showToast(res.error || 'Activation failed', false);
    }
  };
}

async function persistSettings() {
  store = {
    ...store,
    ramMb: Number($('#set-ram').value) || 2048,
    installPath: $('#set-path').value || store.installPath
  };
  await api().saveStore(store);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
} else {
  init().catch(console.error);
}

window.addEventListener('beforeunload', () => {
  if (promoTimer) clearInterval(promoTimer);
  if (loaderRaf) cancelAnimationFrame(loaderRaf);
});
