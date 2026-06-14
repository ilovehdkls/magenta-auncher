const { globalShortcut } = require('electron');

const WINDOW_W = 980;
const WINDOW_H = 640;
const WM_INITMENU = 0x0116;
const WM_SYSCOMMAND = 0x0112;
const WM_CONTEXTMENU = 0x007b;
const WM_NCRBUTTONUP = 0x00a5;
const SC_KEYMENU = 0xF100;
const SC_MOUSEMENU = 0xF090;

function suppressWindowsSystemMenu(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;

  const swallow = () => {
    if (win.isDestroyed()) return;
    win.setEnabled(false);
    win.setEnabled(true);
  };

  win.on('system-context-menu', (event) => {
    event.preventDefault();
    swallow();
  });

  win.hookWindowMessage(WM_INITMENU, swallow);
  win.hookWindowMessage(WM_CONTEXTMENU, swallow);
  win.hookWindowMessage(WM_NCRBUTTONUP, swallow);

  win.hookWindowMessage(WM_SYSCOMMAND, (wParam) => {
    if (!wParam || wParam.length < 4) return;
    const cmd = wParam.readUInt32LE(0) & 0xFFF0;
    if (cmd === SC_KEYMENU || cmd === SC_MOUSEMENU) swallow();
  });
}

function applyWindowLock(win) {
  if (!win || win.isDestroyed()) return;

  win.setResizable(false);
  win.setMaximizable(false);
  win.setFullScreenable(false);
  win.setMinimumSize(WINDOW_W, WINDOW_H);
  win.setMaximumSize(WINDOW_W, WINDOW_H);
  win.setContentProtection(true);

  const wc = win.webContents;
  wc.setVisualZoomLevelLimits(1, 1);
  wc.setZoomFactor(1);

  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = String(input.key || '');
    const blocked =
      key === 'F11' ||
      key === 'F12' ||
      key === 'PrintScreen' ||
      (input.alt && (key === ' ' || input.code === 'Space')) ||
      (input.control && (key === '+' || key === '-' || key === '=' || key === '0' || key === 'Add' || key === 'Subtract')) ||
      (input.control && input.shift && key.toLowerCase() === 'i');
    if (blocked) event.preventDefault();
  });

  wc.on('zoom-changed', () => {
    wc.setZoomFactor(1);
  });

  wc.on('context-menu', (event) => {
    event.preventDefault();
  });

  suppressWindowsSystemMenu(win);

  win.on('enter-full-screen', () => win.setFullScreen(false));
  win.on('maximize', () => { if (!win.isDestroyed()) win.unmaximize(); });
}

function registerScreenshotBlock() {
  const keys = ['PrintScreen', 'CommandOrControl+Shift+S', 'Alt+PrintScreen'];
  for (const accel of keys) {
    try { globalShortcut.register(accel, () => {}); } catch (_) {}
  }
}

function unregisterScreenshotBlock() {
  try { globalShortcut.unregisterAll(); } catch (_) {}
}

module.exports = {
  WINDOW_W,
  WINDOW_H,
  applyWindowLock,
  registerScreenshotBlock,
  unregisterScreenshotBlock
};
